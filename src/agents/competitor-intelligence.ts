import { BaseAgent, type AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { CompetitorReportSchema, type CompetitorIntelInput } from "@/lib/ai/schemas/competitor-intelligence";
import { buildCompetitorIntelPrompt } from "@/lib/ai/prompts/competitor-intelligence";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CompetitorIntelligenceAgent extends BaseAgent {
  constructor() {
    super("COMPETITOR_INTELLIGENCE");
    this.setTaskType("analysis");
  }

  async execute(input: CompetitorIntelInput): Promise<AgentResult<z.infer<typeof CompetitorReportSchema>>> {
    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("COMPETITOR_INTELLIGENCE", "main", {
        organizationId: input.organizationId,
        brandName: input.brandConfig.brandName,
        industry: input.brandConfig.industry || "",
        competitors: JSON.stringify(input.competitors),
        previousReport: input.previousReport ? JSON.stringify(input.previousReport) : "",
        clientMetrics: JSON.stringify(input.clientMetrics),
      }, input.organizationId);
    } catch {
      systemPrompt = `You are an expert competitive intelligence analyst specializing in social media marketing. You analyze competitor strategies and provide actionable insights. Always respond with valid JSON that matches the required schema.`;
    }

    const userPrompt = buildCompetitorIntelPrompt(input);

    const { text, tokensUsed, inputTokens, outputTokens } = await this.callLLM({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
      organizationId: input.organizationId,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

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
      inputTokens,
      outputTokens,
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
