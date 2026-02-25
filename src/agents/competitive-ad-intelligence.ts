import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { CompetitiveAdIntelligenceSchema, CompetitiveAdIntelligenceInputSchema, type CompetitiveAdIntelligenceInput, type CompetitiveAdIntelligence } from "@/lib/ai/schemas/competitive-ad-intelligence";

export class CompetitiveAdIntelligenceAgent extends BaseAgent {
  constructor() {
    super("COMPETITIVE_AD_INTELLIGENCE", "claude-sonnet-4-20250514");
  }

  async execute(input: CompetitiveAdIntelligenceInput): Promise<AgentResult<CompetitiveAdIntelligence>> {
    const parsedInput = CompetitiveAdIntelligenceInputSchema.parse(input);

    const systemPrompt = `You are a Competitive Advertising Intelligence Expert.

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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Analyze competitor ads for ${parsedInput.brandName}.` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = CompetitiveAdIntelligenceSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.5,
      tokensUsed,
    };
  }
}
