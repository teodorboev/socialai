import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { CrossChannelAttributionSchema, CrossChannelAttributionInputSchema, type CrossChannelAttributionInput, type CrossChannelAttribution } from "@/lib/ai/schemas/cross-channel-attribution";

export class CrossChannelAttributionAgent extends BaseAgent {
  constructor() {
    super("CROSS_CHANNEL_ATTRIBUTION", "claude-sonnet-4-20250514");
  }

  async execute(input: CrossChannelAttributionInput): Promise<AgentResult<CrossChannelAttribution>> {
    const parsedInput = CrossChannelAttributionInputSchema.parse(input);

    const systemPrompt = `You are a Cross-Channel Attribution Expert specializing in tracking customer journeys across multiple touchpoints.

Your role is to analyze how different channels contribute to conversions and optimize the marketing mix.

BRAND: ${parsedInput.brandName}
CHANNELS: ${parsedInput.channels.join(", ")}
DATE RANGE: ${parsedInput.dateRange.start} to ${parsedInput.dateRange.end}

CUSTOMER JOURNEY DATA:
${parsedInput.customerData ? JSON.stringify(parsedInput.customerData.slice(0, 20), null, 2) : "Not provided"}

ATTRIBUTION MODELS TO CALCULATE:
1. First Touch: 100% credit to first interaction
2. Last Touch: 100% credit to last interaction before conversion
3. Linear: Equal credit across all touchpoints
4. Time Decay: More credit to recent touchpoints
5. Position Based: 40% first, 40% last, 20% distributed in middle

ANALYSIS FRAMEWORK:
1. Map customer journeys across channels
2. Apply multiple attribution models
3. Compare channel performance across models
4. Identify insights and patterns
5. Recommend optimal channel mix

Respond with a JSON object matching this schema:
${JSON.stringify(CrossChannelAttributionSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Analyze cross-channel attribution for ${parsedInput.brandName}.` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = CrossChannelAttributionSchema.parse(JSON.parse(jsonMatch[0]));
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
