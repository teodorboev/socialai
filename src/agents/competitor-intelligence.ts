import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { CompetitorReportSchema, type CompetitorIntelInput } from "@/lib/ai/schemas/competitor-intelligence";
import { buildCompetitorIntelPrompt } from "@/lib/ai/prompts/competitor-intelligence";

export class CompetitorIntelligenceAgent extends BaseAgent {
  constructor() {
    super("COMPETITOR_INTELLIGENCE");
  }

  async execute(input: CompetitorIntelInput): Promise<AgentResult<z.infer<typeof CompetitorReportSchema>>> {
    const systemPrompt = `You are an expert competitive intelligence analyst specializing in social media marketing. You analyze competitor strategies and provide actionable insights. Always respond with valid JSON that matches the required schema.`;

    const userPrompt = buildCompetitorIntelPrompt(input);

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
    });

    // Parse and validate the response
    const parsed = this.parseJsonResponse(text);
    const validated = CompetitorReportSchema.parse(parsed);

    // Determine if we should escalate
    const shouldEscalate = validated.confidenceScore < 0.6 || validated.gaps.some((g) => g.priority === "high");

    return {
      success: true,
      data: validated,
      confidenceScore: validated.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `High priority gaps identified: ${validated.gaps.filter((g) => g.priority === "high").map((g) => g.gap).join(", ")}`
        : undefined,
      tokensUsed,
    };
  }

  private parseJsonResponse(text: string): unknown {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
