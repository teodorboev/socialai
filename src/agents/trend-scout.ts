import { BaseAgent, type OrgContext } from "./shared/base-agent";
import type { AgentName } from "@prisma/client";
import { TrendReportSchema, type TrendReport } from "@/lib/ai/schemas/trends";

interface TrendScoutInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    industry: string;
    contentThemes: string[];
    competitors?: Array<{ name: string; platform: string; handle: string }>;
  };
  connectedPlatforms: string[];
}

export class TrendScoutAgent extends BaseAgent {
  constructor() {
    super("TREND_SCOUT");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as TrendScoutInput;

    try {
      return await this.getPromptFromTemplate("main", {
        brandName: input.brandConfig.brandName,
        industry: input.brandConfig.industry,
        contentThemes: JSON.stringify(input.brandConfig.contentThemes),
        competitors: JSON.stringify(input.brandConfig.competitors || []),
        connectedPlatforms: JSON.stringify(input.connectedPlatforms),
      });
    } catch {
      return `You are a trend analyst for ${input.brandConfig.brandName} in the ${input.brandConfig.industry} industry.

Your job is to identify trending topics, viral moments, and content opportunities that are relevant to this brand. Consider:

1. Current social media trends on: ${input.connectedPlatforms.join(", ")}
2. Industry-specific news and developments
3. Seasonal events and holidays
4. Relevant hashtags and memes
5. Competitor activity

For each trend identified, assess:
- Relevance to the brand (0-1)
- Category: viral, seasonal, industry, meme, news, hashtag
- Sentiment: positive, neutral, negative
- Which platforms it's relevant on
- Content opportunities (what kind of posts could capitalize on this trend)
- Urgency: high (act today), medium (this week), low (this month)

Be specific and actionable. Focus on trends that would genuinely fit the brand, not just what's popular.

Respond with a single JSON object. No markdown, no backticks.`;
    }
  }

  async execute(input: TrendScoutInput) {
    const { brandConfig, connectedPlatforms } = input;

    const orgContext: OrgContext = {
      organizationId: input.organizationId,
      brandConfig,
      connectedPlatforms,
    };

    const systemPrompt = await this.buildCachedPrompt(orgContext);

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: `Identify the top 5-10 trends for ${brandConfig.brandName} this week. Include relevant hashtags and content angles.`,
      maxTokens: 3000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    let parsed: TrendReport;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = TrendReportSchema.parse(JSON.parse(jsonMatch[0]));
    } catch (parseError) {
      console.error("Failed to parse trend report:", parseError, text);
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: "Failed to parse AI response",
        tokensUsed,
      };
    }

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.6,
      tokensUsed,
    };
  }
}
