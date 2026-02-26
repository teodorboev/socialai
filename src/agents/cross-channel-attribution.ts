import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { CrossChannelAttributionSchema, CrossChannelAttributionInputSchema, type CrossChannelAttributionInput, type CrossChannelAttribution } from "@/lib/ai/schemas/cross-channel-attribution";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CrossChannelAttributionAgent extends BaseAgent {
  constructor() {
    super("CROSS_CHANNEL_ATTRIBUTION");
    this.setTaskType("analysis");
  }

  async execute(input: CrossChannelAttributionInput): Promise<AgentResult<CrossChannelAttribution>> {
    const parsedInput = CrossChannelAttributionInputSchema.parse(input);

    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("CROSS_CHANNEL_ATTRIBUTION", "main", {
        brandName: parsedInput.brandName,
        channels: parsedInput.channels.join(", "),
        dateRange: `${parsedInput.dateRange.start} to ${parsedInput.dateRange.end}`,
        customerData: parsedInput.customerData ? JSON.stringify(parsedInput.customerData.slice(0, 20)) : "",
      }, parsedInput.organizationId);
    } catch {
      // Fallback to inline prompt
      systemPrompt = `You are a Cross-Channel Attribution Expert specializing in tracking customer journeys across multiple touchpoints.

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
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<CrossChannelAttribution>({
      system: systemPrompt,
      userMessage: `Analyze cross-channel attribution for ${parsedInput.brandName}.`,
      maxTokens: 3000,
      organizationId: parsedInput.organizationId,
      schema: CrossChannelAttributionSchema,
    });

    if (!data) {
      throw new Error("Failed to parse cross-channel attribution response");
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
