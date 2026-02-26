import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { CompetitiveAdIntelligenceSchema, CompetitiveAdIntelligenceInputSchema, type CompetitiveAdIntelligenceInput, type CompetitiveAdIntelligence } from "@/lib/ai/schemas/competitive-ad-intelligence";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CompetitiveAdIntelligenceAgent extends BaseAgent {
  constructor() {
    super("COMPETITIVE_AD_INTELLIGENCE");
    this.setTaskType("analysis");
  }

  async execute(input: CompetitiveAdIntelligenceInput): Promise<AgentResult<CompetitiveAdIntelligence>> {
    const parsedInput = CompetitiveAdIntelligenceInputSchema.parse(input);

    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("COMPETITIVE_AD_INTELLIGENCE", "main", {
        brandName: parsedInput.brandName,
        industry: parsedInput.industry,
        competitors: parsedInput.competitors.join(", "),
        platforms: parsedInput.platforms?.join(", ") || "All",
        adLibraryData: JSON.stringify(parsedInput.adLibraryData || []),
      }, parsedInput.organizationId);
    } catch {
      // Fallback to inline prompt
      systemPrompt = `You are a Competitive Advertising Intelligence Expert.

Your role is to analyze competitor ads and provide strategic recommendations.

BRAND: ${parsedInput.brandName}
INDUSTRY: ${parsedInput.industry}
COMPETITORS: ${parsedInput.competitors.join(", ")}
PLATFORMS: ${parsedInput.platforms?.join(", ") || "All"}

AD DATA:
${JSON.stringify(parsedInput.adLibraryData || [], null, 2)}

ANALYSIS:
1. Catalog competitor ads
2. Identify creative themes and patterns
3. Analyze strengths and weaknesses
4. Find gaps and opportunities
5. Recommend ad copy angles

Respond with a JSON object matching this schema:
${JSON.stringify(CompetitiveAdIntelligenceSchema.shape, null, 2)}`;
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<CompetitiveAdIntelligence>({
      system: systemPrompt,
      userMessage: `Analyze competitor ads for ${parsedInput.brandName}.`,
      maxTokens: 2500,
      organizationId: parsedInput.organizationId,
      schema: CompetitiveAdIntelligenceSchema,
    });

    if (!data) {
      throw new Error("Failed to parse competitive ad intelligence response");
    }

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate: data.confidenceScore < 0.5,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
