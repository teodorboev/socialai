import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { PredictiveContentSchema, PredictiveContentInputSchema, type PredictiveContentInput, type PredictiveContent } from "@/lib/ai/schemas/predictive-content";

export class PredictiveContentAgent extends BaseAgent {
  constructor() {
    super("PREDICTIVE_CONTENT", "claude-sonnet-4-20250514");
  }

  async execute(input: PredictiveContentInput): Promise<AgentResult<PredictiveContent>> {
    const parsedInput = PredictiveContentInputSchema.parse(input);

    const systemPrompt = `You are a Content Performance Prediction Expert specializing in social media analytics.

Your role is to predict how content will perform before it's published, helping optimize for maximum engagement and ROI.

CONTEXT:
- Brand: ${parsedInput.brandName}
- Analyzing ${parsedInput.contentOptions.length} content options for prediction

INPUT CONTENT OPTIONS:
${parsedInput.contentOptions.map((c, i) => `${i + 1}. ${c.platform}/${c.contentType}: "${c.caption.substring(0, 100)}..."`).join("\n")}

HISTORICAL DATA:
${JSON.stringify(parsedInput.historicalData || {}, null, 2)}

CURRENT CONTEXT:
${JSON.stringify(parsedInput.context || {}, null, 2)}

ANALYSIS FRAMEWORK:
1. Analyze each content option against historical performance patterns
2. Consider platform-specific algorithms and user behavior
3. Factor in current trends and competitive landscape
4. Evaluate hashtag effectiveness
5. Assess optimal timing based on audience activity patterns

PREDICTION METHODOLOGY:
- Use historical engagement rates as baseline
- Adjust for content type, length, media, timing
- Factor in trend relevance and competition
- Consider audience demographics and preferences

IMPORTANT:
- Provide realistic predictions based on data patterns
- Identify specific risk factors for each content piece
- Give actionable optimization suggestions
- Include confidence score (lower if limited historical data)

Respond with a JSON object matching this schema:
${JSON.stringify(PredictiveContentSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Predict performance for ${parsedInput.contentOptions.length} content options for ${parsedInput.brandName}.`,
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

    const parsed = PredictiveContentSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Determine if we should escalate
    const hasLowConfidence = parsed.predictions.some(p => p.confidenceScore < 0.5);
    const shouldEscalate = parsed.confidenceScore < 0.5 || hasLowConfidence;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): Insufficient historical data for accurate predictions`
        : undefined,
      tokensUsed,
    };
  }
}
