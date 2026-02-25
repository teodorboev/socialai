import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { AudienceReportSchema, type AudienceIntelInput } from "@/lib/ai/schemas/audience-intelligence";
import { buildAudienceIntelPrompt } from "@/lib/ai/prompts/audience-intelligence";

export class AudienceIntelligenceAgent extends BaseAgent {
  constructor() {
    super("AUDIENCE_INTELLIGENCE");
  }

  async execute(input: AudienceIntelInput): Promise<AgentResult<z.infer<typeof AudienceReportSchema>>> {
    const systemPrompt = `You are an audience intelligence expert. You analyze follower data and create detailed personas. Always respond with valid JSON matching the required schema.`;

    const userPrompt = buildAudienceIntelPrompt(input);

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
    });

    const parsed = this.parseJsonResponse(text);
    const validated = AudienceReportSchema.parse(parsed);

    const shouldEscalate = validated.confidenceScore < 0.5 || validated.audienceShifts.some((s) => s.direction === "emerging");

    return {
      success: true,
      data: validated,
      confidenceScore: validated.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence or emerging audience shifts detected: ${validated.audienceShifts.filter((s) => s.direction === "emerging").map((s) => s.shift).join(", ")}`
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
