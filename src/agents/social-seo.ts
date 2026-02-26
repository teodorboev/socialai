import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { SocialSeoSchema, SocialSeoInputSchema, type SocialSeoInput, type SocialSeo } from "@/lib/ai/schemas/social-seo";

export class SocialSEOAgent extends BaseAgent {
  constructor() {
    super("SOCIAL_SEO");
  }

  async execute(input: SocialSeoInput): Promise<AgentResult<SocialSeo>> {
    const parsedInput = SocialSeoInputSchema.parse(input);

    const systemPrompt = `You are a Social Media SEO Expert specializing in optimizing content for discoverability on social platforms.

Your role is to analyze and optimize content for social search and discovery.

BRAND: ${parsedInput.brandName}
INDUSTRY: ${parsedInput.industry}
TARGET KEYWORDS: ${parsedInput.targetKeywords.join(", ")}

CONTENT TO OPTIMIZE:
${parsedInput.contentToOptimize?.map((c, i) => 
  `${i + 1}. [${c.platform}]: "${c.caption.substring(0, 100)}..."\n   Hashtags: ${c.hashtags.join(", ")}`
).join("\n") || "No content provided"}

CURRENT BIO: ${parsedInput.currentBio || "Not provided"}

COMPETITORS: ${parsedInput.competitors?.join(", ") || "Not provided"}

ANALYSIS FRAMEWORK:
1. Analyze target keywords for relevance and opportunity
2. Evaluate current content for keyword optimization
3. Assess hashtag strategy (primary, secondary, branded, trending)
4. Optimize social profile for discoverability
5. Identify quick wins with high impact

SOCIAL SEARCH FACTORS:
- Keyword usage in captions and bios
- Hashtag relevance and mix
- Engagement signals
- Content relevance
- Profile completeness

Respond with a JSON object matching this schema:
${JSON.stringify(SocialSeoSchema.shape, null, 2)}`;

    const result = await this.callLLM<SocialSeo>({
      system: systemPrompt,
      userMessage: `Perform SEO analysis for ${parsedInput.brandName} in the ${parsedInput.industry} industry.`,
      schema: SocialSeoSchema,
      maxTokens: 3000,
    });

    if (!result.data) {
      throw new Error("Failed to generate structured SEO analysis");
    }

    // Escalate if SEO score is very low
    const shouldEscalate = result.data.overallSeoScore < 0.3 || result.data.confidenceScore < 0.5;

    return {
      success: true,
      data: result.data,
      confidenceScore: result.data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low SEO score (${result.data.overallSeoScore}) or insufficient data for analysis`
        : undefined,
      tokensUsed: result.tokensUsed,
    };
  }
}
