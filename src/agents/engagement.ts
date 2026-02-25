import { BaseAgent } from "./shared/base-agent";
import type { AgentName, Platform, EngagementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EngagementResponseSchema, type EngagementResponse } from "@/lib/ai/schemas/engagement";
import { buildEngagementPrompt, shouldForceEscalate } from "@/lib/ai/prompts/engagement";

interface EngagementInput {
  organizationId: string;
  platform: Platform;
  brandConfig: {
    brandName: string;
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    faqKnowledge: Array<{
      question: string;
      answer: string;
      category: string;
    }>;
    doNots: string[];
  };
  engagement: {
    type: EngagementType;
    authorName: string;
    authorUsername: string;
    body: string;
    parentContent?: string;
  };
  conversationHistory?: Array<{
    role: "brand" | "user";
    author: string;
    body: string;
    timestamp: string;
  }>;
}

export class EngagementAgent extends BaseAgent {
  constructor() {
    super("ENGAGEMENT");
  }

  async execute(input: EngagementInput) {
    const { platform, brandConfig, engagement, conversationHistory } = input;

    const systemPrompt = buildEngagementPrompt({
      ...input,
      platform: platform.toString(),
    });

    const userMessage = `Analyze and respond to this ${engagement.type.toLowerCase()}.`;

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage,
      maxTokens: 2000,
    });

    // Parse the JSON response
    let parsed: EngagementResponse;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = EngagementResponseSchema.parse(JSON.parse(jsonMatch[0]));
    } catch (parseError) {
      console.error("Failed to parse engagement response:", parseError, text);
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: "Failed to parse AI response",
        tokensUsed,
      };
    }

    // Check for forced escalation rules
    const forceEscalation = shouldForceEscalate(input, {
      category: parsed.category,
      sentiment: parsed.sentiment,
    });

    const shouldEscalate = forceEscalation?.force || parsed.confidenceScore < 0.7;
    const priority = forceEscalation?.priority || (parsed.confidenceScore < 0.6 ? "HIGH" : "MEDIUM");

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: forceEscalation?.reason || (shouldEscalate ? `Low confidence (${parsed.confidenceScore}): ${parsed.reasoning}` : undefined),
      tokensUsed,
    };
  }
}

// Process a single engagement item
export async function processEngagement(
  organizationId: string,
  engagementId: string
): Promise<void> {
  // Fetch the engagement from DB
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      socialAccount: true,
      content: true,
    },
  });

  if (!engagement) {
    console.error(`Engagement ${engagementId} not found`);
    return;
  }

  // Fetch brand config
  const brandConfig = await prisma.brandConfig.findUnique({
    where: { organizationId },
  });

  if (!brandConfig) {
    console.error(`Brand config for org ${organizationId} not found`);
    return;
  }

  const agent = new EngagementAgent();

  try {
    const result = await agent.run(organizationId, {
      organizationId,
      platform: engagement.platform,
      brandConfig: {
        brandName: brandConfig.brandName,
        voiceTone: brandConfig.voiceTone as any,
        faqKnowledge: (brandConfig.faqKnowledge as any) || [],
        doNots: brandConfig.doNots,
      },
      engagement: {
        type: engagement.engagementType,
        authorName: engagement.authorName || "",
        authorUsername: engagement.authorUsername || "",
        body: engagement.body || "",
        parentContent: engagement.content?.caption,
      },
    });

    if (result.success && result.data) {
      const response = result.data as EngagementResponse;

      // Update the engagement with AI response
      await prisma.engagement.update({
        where: { id: engagementId },
        data: {
          aiResponse: response.response,
          sentiment: response.sentiment as any,
          aiResponseStatus: mapSuggestedActionToStatus(response.suggestedAction),
          confidenceScore: response.confidenceScore,
          isEscalated: shouldEscalate(response),
        },
      });

      // If auto_respond, send the response
      if (response.suggestedAction === "auto_respond" && response.shouldRespond) {
        // TODO: Call platform API to post the response
        console.log(`Would auto-respond to engagement ${engagementId}: ${response.response}`);
      }

      // Create escalation if needed
      if (shouldEscalate(response) || response.suggestedAction === "escalate") {
        await prisma.escalation.create({
          data: {
            organizationId,
            agentName: "ENGAGEMENT",
            reason: `${response.category}: ${response.reasoning}`,
            context: {
              engagementId,
              response: response.response,
              confidence: response.confidenceScore,
            },
            referenceType: "engagement",
            referenceId: engagementId,
            priority: mapSentimentToPriority(response.sentiment),
            status: "OPEN",
          },
        });
      }
    }
  } catch (error) {
    console.error(`Failed to process engagement ${engagementId}:`, error);
    await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        aiResponseStatus: "PENDING_REVIEW",
        isEscalated: true,
      },
    });
  }
}

function mapSuggestedActionToStatus(action: string): "AUTO_RESPONDED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SKIPPED" {
  switch (action) {
    case "auto_respond":
      return "AUTO_RESPONDED";
    case "queue_for_review":
      return "PENDING_REVIEW";
    case "escalate":
    case "escalate_to_dm":
      return "PENDING_REVIEW";
    case "skip":
      return "SKIPPED";
    default:
      return "PENDING_REVIEW";
  }
}

function shouldEscalate(response: EngagementResponse): boolean {
  return (
    response.suggestedAction === "escalate" ||
    response.suggestedAction === "escalate_to_dm" ||
    response.category === "crisis" ||
    response.sentiment === "URGENT"
  );
}

function mapSentimentToPriority(sentiment: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  switch (sentiment) {
    case "URGENT":
      return "CRITICAL";
    case "NEGATIVE":
      return "HIGH";
    case "NEUTRAL":
      return "MEDIUM";
    case "POSITIVE":
      return "LOW";
    default:
      return "MEDIUM";
  }
}
