import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { PredictiveContentSchema, PredictiveContentInputSchema, type PredictiveContentInput, type PredictiveContent } from "@/lib/ai/schemas/predictive-content";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class PredictiveContentAgent extends BaseAgent {
  constructor() {
    super("PREDICTIVE_CONTENT");
    this.setTaskType("analysis");
  }

  async execute(input: PredictiveContentInput): Promise<AgentResult<PredictiveContent>> {
    const parsedInput = PredictiveContentInputSchema.parse(input);

    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("PREDICTIVE_CONTENT", "main", {
        brandName: parsedInput.brandName,
        contentOptions: JSON.stringify(parsedInput.contentOptions),
        historicalData: JSON.stringify(parsedInput.historicalData || {}),
        context: JSON.stringify(parsedInput.context || {}),
      }, parsedInput.organizationId);
    } catch {
      systemPrompt = `You are a Content Performance Prediction Expert specializing in social media analytics.

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
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<PredictiveContent>({
      system: systemPrompt,
      userMessage: `Predict performance for ${parsedInput.contentOptions.length} content options for ${parsedInput.brandName}.`,
      maxTokens: 3000,
      organizationId: parsedInput.organizationId,
      schema: PredictiveContentSchema,
    });

    if (!data) throw new Error("Failed to parse predictive content response");

    const hasLowConfidence = data.predictions.some(p => p.confidenceScore < 0.5);
    const shouldEscalate = data.confidenceScore < 0.5 || hasLowConfidence;

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${data.confidenceScore}): Insufficient historical data for accurate predictions`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
