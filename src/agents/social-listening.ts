import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { ListeningReportSchema, type SocialListeningInput } from "@/lib/ai/schemas/social-listening";
import { buildSocialListeningPrompt } from "@/lib/ai/prompts/social-listening";

export class SocialListeningAgent extends BaseAgent {
  constructor() {
    super("SOCIAL_LISTENING");
  }

  async execute(input: SocialListeningInput): Promise<AgentResult<z.infer<typeof ListeningReportSchema>>> {
    const systemPrompt = `You are a social listening and brand monitoring expert. You analyze mentions, detect sentiment, and identify opportunities. Always respond with valid JSON matching the required schema.`;

    const userPrompt = buildSocialListeningPrompt(input);

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    const parsed = this.parseJsonResponse(text);
    const validated = ListeningReportSchema.parse(parsed);

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
      tokensUsed,
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
