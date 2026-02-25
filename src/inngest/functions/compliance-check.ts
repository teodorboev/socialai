import { inngest } from "../client";
import { ComplianceAgent } from "@/agents/compliance";
import { prisma } from "@/lib/prisma";

// Event-driven function for compliance checking - triggered on content publish
export const complianceCheck = inngest.createFunction(
  {
    id: "compliance-check",
    name: "Compliance Check",
    retries: 3,
  },
  {
    event: "content.compliance.check",
  },
  async ({ event, step }) => {
    const { organizationId, contentId } = event.data;

    const content = await step.run("get-content", async () => {
      return prisma.content.findUnique({
        where: { id: contentId },
      });
    });

    if (!content) {
      return { success: false, error: "Content not found" };
    }

    const org = await step.run("get-org", async () => {
      return prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          brandConfig: true,
        },
      });
    });

    const complianceResult = await step.run("check-compliance", async () => {
      const agent = new ComplianceAgent();
      return agent.run(organizationId, {
        organizationId,
        content: {
          caption: content.caption,
          hashtags: content.hashtags,
          mediaUrls: content.mediaUrls,
          platform: content.platform,
        },
        complianceRules: {
          industry: org?.brandConfig?.industry || "general",
          regulations: ["FTC", "GDPR"],
        },
      });
    });

    if (complianceResult.success && complianceResult.data) {
      const data = complianceResult.data as any;
      
      if (data.violations?.length > 0 || data.warnings?.length > 0) {
        // Block publishing if critical violations
        const hasCriticalViolations = data.violations?.some((v: any) => v.severity === "CRITICAL");

        await step.run("handle-compliance-result", async () => {
          // Log the compliance check
          await prisma.agentLog.create({
            data: {
              organizationId,
              agentName: "COMPLIANCE",
              action: "Content Compliance Check",
              inputSummary: { contentId },
              outputSummary: { violations: data.violations, warnings: data.warnings },
              confidenceScore: complianceResult.confidenceScore,
              status: hasCriticalViolations ? "ESCALATED" : "SUCCESS",
            },
          });

          // If critical violations, escalate
          if (hasCriticalViolations) {
            await prisma.escalation.create({
              data: {
                organizationId,
                agentName: "COMPLIANCE",
                reason: `Compliance violation detected: ${data.violations[0]?.rule}`,
                context: { contentId, violations: data.violations },
                priority: "HIGH",
                status: "OPEN",
                referenceType: "content",
                referenceId: contentId,
              },
            });
          }
        });

        return { 
          approved: !hasCriticalViolations, 
          violations: data.violations?.length || 0,
          warnings: data.warnings?.length || 0,
        };
      }

      return { approved: true, violations: 0, warnings: 0 };
    }

    // Default to approval if check fails
    return { approved: true };
  }
);
