import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { PricingIntelligenceSchema, PricingIntelligenceInputSchema, type PricingIntelligenceInput, type PricingIntelligence } from "@/lib/ai/schemas/pricing-intelligence";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class PricingIntelligenceAgent extends BaseAgent {
  constructor() {
    super("PRICING_INTELLIGENCE");
    this.setTaskType("analysis");
  }

  async execute(input: PricingIntelligenceInput): Promise<AgentResult<PricingIntelligence>> {
    const parsedInput = PricingIntelligenceInputSchema.parse(input);

    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("PRICING_INTELLIGENCE", "main", {
        brandName: parsedInput.brandName,
        products: parsedInput.products.map(p => `${p.name}: $${p.currentPrice}`).join("\n"),
        competitors: parsedInput.competitors ? JSON.stringify(parsedInput.competitors) : "",
        marketData: JSON.stringify(parsedInput.marketData || {}),
      }, parsedInput.organizationId);
    } catch {
      systemPrompt = `You are a Pricing Intelligence Expert specializing in competitive pricing analysis.

Your role is to analyze competitor pricing and provide pricing recommendations.

BRAND: ${parsedInput.brandName}

PRODUCTS:
${parsedInput.products.map(p => `- ${p.name}: $${p.currentPrice}`).join("\n")}

COMPETITOR DATA:
${parsedInput.competitors ? JSON.stringify(parsedInput.competitors, null, 2) : "Not provided"}

MARKET DATA:
${JSON.stringify(parsedInput.marketData || {}, null, 2)}

ANALYSIS FRAMEWORK:
1. Compare your pricing to competitors
2. Analyze market positioning
3. Calculate optimal price points
4. Identify promotional opportunities
5. Consider demand elasticity

Respond with a JSON object matching this schema:
${JSON.stringify(PricingIntelligenceSchema.shape, null, 2)}`;
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<PricingIntelligence>({
      system: systemPrompt,
      userMessage: `Analyze pricing for ${parsedInput.brandName}.`,
      maxTokens: 2500,
      organizationId: parsedInput.organizationId,
      schema: PricingIntelligenceSchema,
    });

    if (!data) throw new Error("Failed to parse pricing intelligence response");

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
