import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { RoiAttributionSchema, RoiAttributionInputSchema, type RoiAttributionInput, type RoiAttribution } from "@/lib/ai/schemas/roi-attribution";

export class RoiAttributionAgent extends BaseAgent {
  constructor() {
    super("ROI_ATTRIBUTION", "claude-sonnet-4-20250514");
  }

  async execute(input: RoiAttributionInput): Promise<AgentResult<RoiAttribution>> {
    const parsedInput = RoiAttributionInputSchema.parse(input);

    const systemPrompt = `You are a Revenue Attribution Expert specializing in social media marketing analytics.

Your role is to analyze social media performance data and determine the revenue attribution from various channels and content pieces.

CONTEXT:
- Organization wants to understand ROI from social media efforts
- You need to attribute revenue across platforms and content types
- Consider both direct attribution (click-to-purchase) and indirect attribution (brand awareness driving later purchases)

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

ANALYSIS FRAMEWORK:
1. Calculate total social media attributed revenue
2. Break down by platform (Instagram, Facebook, TikTok, Twitter, LinkedIn)
3. Analyze content performance with ROI metrics
4. Map customer journeys and attribution paths
5. Provide actionable recommendations to improve ROI

IMPORTANT:
- If revenue data is incomplete, make reasonable estimates based on industry benchmarks
- Use engagement metrics to estimate indirect attribution
- Provide realistic, conservative estimates with transparent assumptions
- Include confidence score based on data quality (0.0 - 1.0)

Respond with a JSON object matching this schema:
${JSON.stringify(RoiAttributionSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze the ROI attribution for ${parsedInput.organizationId} for the period ${parsedInput.period.start} to ${parsedInput.period.end}. Provide detailed attribution analysis.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = RoiAttributionSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Determine if we should escalate based on confidence
    const shouldEscalate = parsed.confidenceScore < 0.6;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): Data quality may be insufficient for accurate attribution`
        : undefined,
      tokensUsed,
    };
  }
}
