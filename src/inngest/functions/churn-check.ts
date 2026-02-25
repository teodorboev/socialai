import { inngest } from "../client";
import { ChurnPredictionAgent } from "@/agents/churn-prediction";
import { prisma } from "@/lib/prisma";

export const churnCheck = inngest.createFunction(
  {
    id: "churn-check",
    name: "Churn Check",
    retries: 2,
  },
  {
    cron: "0 9 * * 1", // Weekly on Monday at 9 AM
  },
  async ({ step }) => {
    // Get all active organizations (paid plans)
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { in: ["GROWTH", "PRO", "ENTERPRISE", "MANAGED_STANDARD", "MANAGED_PREMIUM"] as any },
        },
        include: {
          members: { where: { role: "OWNER" }, take: 1 },
          socialAccounts: { where: { isActive: true } },
          content: { where: { status: "PUBLISHED" }, take: 100 },
          schedules: { where: { status: "PENDING" } },
        },
        take: 50,
      });
    });

    const results = [];

    for (const org of organizations) {
      const result = await step.run(`analyze-churn-${org.id}`, async () => {
        const agent = new ChurnPredictionAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          metrics: {
            postsThisMonth: org.content.filter((c: any) => {
              const created = new Date(c.createdAt);
              const monthAgo = new Date();
              monthAgo.setMonth(monthAgo.getMonth() - 1);
              return created > monthAgo;
            }).length,
            scheduledPosts: org.schedules.length,
            connectedAccounts: org.socialAccounts.length,
          },
          activityHistory: {
            lastContentCreated: org.content[0]?.createdAt,
            accountAgeDays: Math.floor((Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
          },
        });
      });

      if (result.success && result.data) {
        const churnData = result.data as any;
        
        if (churnData.riskLevel === "HIGH" || churnData.riskLevel === "CRITICAL") {
          // Create escalation
          await step.run(`create-churn-alert-${org.id}`, async () => {
            await prisma.escalation.create({
              data: {
                organizationId: org.id,
                agentName: "CHURN_PREDICTION",
                reason: `Churn risk detected: ${churnData.riskLevel}`,
                context: churnData,
                priority: churnData.riskLevel === "CRITICAL" ? "HIGH" : "MEDIUM",
                status: "OPEN",
              },
            });
          });
        }

        results.push({ orgId: org.id, riskLevel: churnData.riskLevel, score: churnData.riskScore });
      }
    }

    return { organizationsAnalyzed: results.length, atRisk: results.filter((r: any) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL").length };
  }
);
