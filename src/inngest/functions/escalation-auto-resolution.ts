import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { smartRouter, type SmartRouterRequest } from "@/lib/router";
import { z } from "zod";

/**
 * Escalation Auto-Resolution
 * 
 * Periodically checks open escalations and attempts to auto-resolve
 * those that can be handled by AI without human intervention.
 * 
 * Types of escalations that can potentially be auto-resolved:
 * - Low-confidence content (re-review with updated brand config)
 * - Simple questions that FAQ can answer
 * - Minor complaints that can be handled with templated responses
 */

// Schema for AI to determine if escalation can be auto-resolved
const EscalationAnalysisSchema = z.object({
  canAutoResolve: z.boolean().describe("Whether this escalation can be resolved by AI"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in auto-resolution"),
  resolutionType: z.enum([
    "approve_content",
    "reject_content", 
    "publish_draft",
    "send_templated_response",
    "skip_no_action_needed",
    "require_human",
  ]).describe("Type of resolution to apply"),
  resolutionDetails: z.string().describe("Specific details for the resolution"),
  reason: z.string().describe("Reasoning for the decision"),
});

type EscalationAnalysis = z.infer<typeof EscalationAnalysisSchema>;

export const autoResolveEscalations = inngest.createFunction(
  {
    id: "auto-resolve-escalations",
    name: "Auto Resolve Escalations",
    retries: 2,
  },
  {
    cron: "0 */2 * * *", // Every 2 hours
  },
  async ({ step }) => {
    // Step 1: Get all open escalations that haven't been auto-resolved
    const escalations = await step.run("fetch-open-escalations", async () => {
      return prisma.escalation.findMany({
        where: {
          status: "OPEN",
          // Skip if already resolved by auto-resolution (check resolution field)
          resolution: { not: { startsWith: "Auto-resolved:" } },
        },
        include: {
          organization: {
            include: {
              brandConfig: true,
            },
          },
        },
        take: 20, // Process max 20 at a time
        orderBy: [
          { priority: "desc" }, // Critical/High first
          { createdAt: "asc" }, // Oldest first
        ],
      });
    });

    const results = [];

    for (const escalation of escalations) {
      const result = await step.run(`resolve-escalation-${escalation.id}`, async () => {
        return resolveEscalation(escalation);
      });
      
      results.push({ escalationId: escalation.id, ...result });
    }

    return {
      processed: results.length,
      autoResolved: results.filter(r => r.resolved).length,
      results,
    };
  }
);

/**
 * Resolve a single escalation using AI
 */
async function resolveEscalation(escalation: any): Promise<{
  resolved: boolean;
  resolutionType?: string;
  reason?: string;
}> {
  const org = escalation.organization;
  const brandConfig = org.brandConfig;

  // Build context for the AI
  const context = buildEscalationContext(escalation);

  // Use SmartRouter to analyze and decide
  const systemPrompt = `You are an expert at deciding when escalations can be auto-resolved by AI.
  
BRAND CONFIG:
- Brand Name: ${brandConfig?.brandName || "Unknown"}
- Industry: ${brandConfig?.industry || "Unknown"}
- Do Nots: ${(brandConfig?.doNots || []).join(", ") || "None"}
- FAQ Knowledge: ${JSON.stringify(brandConfig?.faqKnowledge || {})}

RULES:
1. Only auto-resolve if you have HIGH confidence (>0.85) that AI can handle it
2. Content approval/rejection with clear brand guidelines → can auto-resolve
3. Simple FAQs in the knowledge base → can auto-resolve with templated response
4. Complex complaints, legal issues, refunds → NEVER auto-resolve, require human
5. Crisis situations → NEVER auto-resolve
6. Content that needs creative judgment → require human

Respond with JSON matching the required schema.`;

  const request: SmartRouterRequest = {
    agentName: "AUTO_RESOLUTION",
    messages: [{ role: "user", content: context }],
    systemPrompt,
    maxTokens: 1000,
    organizationId: org.id,
  };

  try {
    const response = await smartRouter.complete(request);
    const parsed = EscalationAnalysisSchema.parse(JSON.parse(response.content));

    // Only auto-resolve if confidence is high enough
    if (parsed.canAutoResolve && parsed.confidenceScore >= 0.85) {
      // Apply the resolution
      await applyResolution(escalation, parsed);
      
      // Update escalation status
      await prisma.escalation.update({
        where: { id: escalation.id },
        data: {
          status: "RESOLVED",
          resolution: `Auto-resolved: ${parsed.resolutionDetails}`,
          resolvedBy: "AUTO_RESOLUTION",
        },
      });

      return {
        resolved: true,
        resolutionType: parsed.resolutionType,
        reason: parsed.reason,
      };
    } else {
      // Cannot auto-resolve - log the attempt but keep it open
      return {
        resolved: false,
        resolutionType: parsed.resolutionType,
        reason: `AI confidence too low (${parsed.confidenceScore}): ${parsed.reason}`,
      };
    }
  } catch (error) {
    console.error("Failed to resolve escalation:", error);
    return { resolved: false };
  }
}

/**
 * Build context string for the AI based on escalation type
 */
function buildEscalationContext(escalation: any): string {
  const type = escalation.referenceType;
  const refId = escalation.referenceId;
  
  let context = `ESCALATION DETAILS:
- Agent: ${escalation.agentName}
- Reason: ${escalation.reason}
- Priority: ${escalation.priority}
- Created: ${escalation.createdAt}

`;

  switch (type) {
    case "content": {
      // Get the content details
      return context + `REFERENCE: Content review needed
CONTEXT: ${JSON.stringify(escalation.context || {}, null, 2)}

Analyze if this content can be approved or rejected based on brand guidelines.`;
    }
    
    case "engagement": {
      return context + `REFERENCE: Engagement response needed
CONTEXT: ${JSON.stringify(escalation.context || {}, null, 2)}

Analyze if this comment/DM can be responded to with a templated response or should be escalated to human.`;
    }
    
    default: {
      return context + `REFERENCE: General escalation
CONTEXT: ${JSON.stringify(escalation.context || {}, null, 2)}

Determine if this can be handled by AI or requires human attention.`;
    }
  }
}

/**
 * Apply the resolution based on analysis
 */
async function applyResolution(
  escalation: any, 
  analysis: EscalationAnalysis
): Promise<void> {
  const { referenceType, referenceId } = escalation;

  switch (analysis.resolutionType) {
    case "approve_content":
    case "publish_draft":
      if (referenceType === "content" && referenceId) {
        await prisma.content.update({
          where: { id: referenceId },
          data: { status: "APPROVED" },
        });
      }
      break;

    case "reject_content":
      if (referenceType === "content" && referenceId) {
        await prisma.content.update({
          where: { id: referenceId },
          data: { 
            status: "REJECTED",
            rejectionReason: analysis.resolutionDetails,
          },
        });
      }
      break;

    case "send_templated_response":
      if (referenceType === "engagement" && referenceId) {
        await prisma.engagement.update({
          where: { id: referenceId },
          data: {
            aiResponse: analysis.resolutionDetails,
            aiResponseStatus: "APPROVED",
          },
        });
      }
      break;

    case "skip_no_action_needed":
      // Just mark as resolved with no action
      break;

    case "require_human":
      // Shouldn't happen if we got here, but just in case
      throw new Error("AI decided human required");
  }
}

/**
 * Event: Trigger escalation resolution manually
 * This allows humans to request re-review of escalations
 */
export const triggerEscalationResolution = inngest.createFunction(
  {
    id: "trigger-escalation-resolution",
    name: "Trigger Escalation Resolution",
    retries: 2,
  },
  {
    event: "escalation/resolve",
  },
  async ({ event }) => {
    const { escalationId } = event.data;

    const escalation = await prisma.escalation.findUnique({
      where: { id: escalationId },
      include: {
        organization: {
          include: {
            brandConfig: true,
          },
        },
      },
    });

    if (!escalation || escalation.status !== "OPEN") {
      return { success: false, error: "Escalation not found or not open" };
    }

    const result = await resolveEscalation(escalation);
    return { success: result.resolved, ...result };
  }
);
