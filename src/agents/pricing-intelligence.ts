import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { PricingIntelligenceSchema, PricingIntelligenceInputSchema, type PricingIntelligenceInput, type PricingIntelligence } from "@/lib/ai/schemas/pricing-intelligence";

export class PricingIntelligenceAgent extends BaseAgent {
  constructor() {
    super("PRICING_INTELLIGENCE", "claude-sonnet-4-20250514");
  }

  async execute(input: PricingIntelligenceInput): Promise<AgentResult<PricingIntelligence>> {
    const parsedInput = PricingIntelligenceInputSchema.parse(input);

    const systemPrompt = `You are a Pricing Intelligence Expert specializing in competitive pricing analysis.

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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Analyze pricing for ${parsedInput.brandName}.` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = PricingIntelligenceSchema.parse(JSON.parse(jsonMatch[0]));
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
