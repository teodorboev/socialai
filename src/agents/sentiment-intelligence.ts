import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { SentimentIntelligenceSchema, SentimentIntelligenceInputSchema, type SentimentIntelligenceInput, type SentimentIntelligence } from "@/lib/ai/schemas/sentiment-intelligence";

export class SentimentIntelligenceAgent extends BaseAgent {
  constructor() {
    super("SENTIMENT_INTELLIGENCE", "claude-sonnet-4-20250514");
  }

  async execute(input: SentimentIntelligenceInput): Promise<AgentResult<SentimentIntelligence>> {
    const parsedInput = SentimentIntelligenceInputSchema.parse(input);

    const systemPrompt = `You are a Sentiment Intelligence Expert specializing in deep analysis of brand perception and customer sentiment.

Your role is to analyze mentions and conversations about the brand to understand perception.

BRAND: ${parsedInput.brandName}
PLATFORMS: ${parsedInput.platforms.join(", ")}
DATE RANGE: ${parsedInput.dateRange.start} to ${parsedInput.dateRange.end}
KEYWORDS TO TRACK: ${parsedInput.keywords?.join(", ") || "All mentions"}

MENTIONS DATA:
${parsedInput.mentions ? parsedInput.mentions.slice(0, 50).map(m => 
  `[${m.platform}] ${m.author || "Anonymous"}: "${m.content.substring(0, 200)}"`
).join("\n") : "No mention data provided"}

ANALYSIS FRAMEWORK:
1. Classify sentiment (positive/negative/neutral) for each mention
2. Calculate overall sentiment score (-1 to 1)
3. Break down by platform
4. Identify emerging issues and themes
5. Provide actionable recommendations

SENTIMENT SCORING:
- Very Negative: -1.0 to -0.7
- Negative: -0.7 to -0.3
- Neutral: -0.3 to 0.3
- Positive: 0.3 to 0.7
- Very Positive: 0.7 to 1.0

CRITICAL ISSUES TO FLAG:
- Crisis-level negative sentiment
- Sudden spikes in negative mentions
- Recurring complaints
- Potential PR issues

Respond with a JSON object matching this schema:
${JSON.stringify(SentimentIntelligenceSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Perform deep sentiment analysis for ${parsedInput.brandName} across ${parsedInput.platforms.join(", ")}.`,
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

    const parsed = SentimentIntelligenceSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Escalate for critical issues or very negative sentiment
    const hasCriticalIssues = parsed.emergingIssues.some(i => i.severity === "critical");
    const isVeryNegative = parsed.overallSentiment.score < -0.5;
    const shouldEscalate = hasCriticalIssues || isVeryNegative || parsed.confidenceScore < 0.5;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Critical sentiment issues detected or severely negative perception (score: ${parsed.overallSentiment.score})`
        : undefined,
      tokensUsed,
    };
  }
}
