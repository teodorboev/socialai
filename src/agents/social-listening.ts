import { BaseAgent, type AgentResult, type OrgContext } from "./shared/base-agent";
import { z } from "zod";
import { ListeningReportSchema, type SocialListeningInput } from "@/lib/ai/schemas/social-listening";
import { buildSocialListeningPrompt } from "@/lib/ai/prompts/social-listening";

export class SocialListeningAgent extends BaseAgent {
  constructor() {
    super("SOCIAL_LISTENING");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as SocialListeningInput;

    try {
      return await this.getPromptFromTemplate("main", {
        organizationId: input.organizationId,
        brandName: input.brandConfig.brandName,
        industry: input.brandConfig.industry,
        competitors: JSON.stringify(input.brandConfig.competitors),
        trackingKeywords: JSON.stringify(input.trackingKeywords),
        trackingHashtags: JSON.stringify(input.trackingHashtags),
        sentimentBaseline: JSON.stringify(input.sentimentBaseline),
        recentMentions: input.recentMentions ? JSON.stringify(input.recentMentions) : "",
      });
    } catch {
      return `You are a social listening and brand monitoring expert. You analyze mentions, detect sentiment, and identify opportunities. Always respond with valid JSON matching the required schema.`;
    }
  }

  async execute(input: SocialListeningInput): Promise<AgentResult<z.infer<typeof ListeningReportSchema>>> {
    const orgContext: OrgContext = input as unknown as OrgContext;
    const cachedBlocks = await this.buildCachedPrompt(orgContext);
    const systemPrompt = cachedBlocks.map(b => b.text).join("\n\n");
    const userPrompt = buildSocialListeningPrompt(input);

    const result = await this.callLLM<z.infer<typeof ListeningReportSchema>>({
      system: systemPrompt,
      userMessage: userPrompt,
      schema: ListeningReportSchema,
      maxTokens: 4000,
    });

    if (!result.data) {
      throw new Error("No structured data returned from LLM");
    }

    const validated = result.data;

    // Escalate on critical alerts or crisis
    const criticalAlerts = validated.alerts.filter((a) => a.severity === "critical");
    const hasCrisis = validated.sentimentShift.direction === "crisis";
    const shouldEscalate = criticalAlerts.length > 0 || hasCrisis;

    return {
      success: true,
      data: validated,
      confidenceScore: validated.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Critical alerts: ${criticalAlerts.map((a) => a.title).join(", ")}${hasCrisis ? "; Sentiment crisis detected" : ""}`
        : undefined,
      tokensUsed: result.tokensUsed,
    };
  }

  private parseJsonResponse(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
