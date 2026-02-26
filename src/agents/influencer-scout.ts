import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { InfluencerReportSchema, type InfluencerScoutInput } from "@/lib/ai/schemas/influencer-scout";

export class InfluencerScoutAgent extends BaseAgent {
  constructor() {
    super("INFLUENCER_SCOUT");
  }

  async execute(input: InfluencerScoutInput): Promise<AgentResult<z.infer<typeof InfluencerReportSchema>>> {
    const systemPrompt = `You are an influencer marketing specialist. You evaluate potential influencer partners based on authenticity, relevance, and fit. ALWAYS escalate to human - never auto-contact influencers. Always respond with valid JSON.`;

    const userPrompt = `For ${input.brandConfig.brandName} in ${input.brandConfig.industry} industry:

TARGET AUDIENCE: ${input.brandConfig.targetAudience.demographics}
INTERESTS: ${input.brandConfig.targetAudience.interests.join(", ")}
${input.budget ? `BUDGET: ${input.budget}` : ""}

CANDIDATES TO EVALUATE:
${input.candidateData.map((c) => `
${c.name} (@${c.handle}) - ${c.platform}
- Followers: ${c.followers}
- Engagement: ${c.avgEngagementRate}%
- Avg likes: ${c.avgLikes}, comments: ${c.avgComments}
- Frequency: ${c.postFrequency}
- Content types: ${c.topContentTypes.join(", ")}
${c.recentPosts ? `- Recent posts: ${c.recentPosts.length} analyzed` : ""}
`).join("\n")}

Evaluate each candidate and respond with JSON:
{
  "candidates": [
    {
      "name": "full name",
      "handle": "username",
      "platform": "Instagram|Twitter|TikTok|YouTube",
      "followers": 0,
      "tier": "nano|micro|mid|macro|mega",
      "scores": {
        "authenticityScore": 0.0-1.0,
        "relevanceScore": 0.0-1.0,
        "engagementQuality": 0.0-1.0,
        "audienceOverlap": 0.0-1.0,
        "overallFit": 0.0-1.0
      },
      "metrics": {
        "avgEngagementRate": 0.0,
        "avgLikes": 0,
        "avgComments": 0,
        "postFrequency": "weekly|monthly",
        "topContentTypes": ["type1"]
      },
      "redFlags": ["any red flags or leave empty"],
      "existingRelationship": "none|follows_brand|engaged_with_brand|mentioned_brand|existing_customer",
      "outreachSuggestion": {
        "approach": "dm|email|comment_first|send_product",
        "message": "personalized message",
        "reasoning": "why this approach"
      }
    }
  ],
  "summary": {
    "totalScanned": ${input.candidateData.length},
    "qualifiedCandidates": 0,
    "topRecommendation": "best candidate",
    "estimatedBudgetRange": "$$$",
    "suggestedCampaignType": "type"
  },
  "confidenceScore": 0.0-1.0
}

CRITICAL: Always recommend human review before any outreach.`;

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    const parsed = this.parseJsonResponse(text);
    const validated = InfluencerReportSchema.parse(parsed);

    // Always escalate - human must approve influencer outreach
    const qualifiedCount = validated.candidates.filter((c) => c.scores.overallFit >= 0.6 && c.scores.authenticityScore >= 0.5).length;

    return {
      success: true,
      data: validated,
      confidenceScore: validated.confidenceScore,
      shouldEscalate: true, // Always escalate - human decision required
      escalationReason: `Found ${qualifiedCount} qualified candidates - human review required before outreach`,
      tokensUsed,
    };
  }

  private parseJsonResponse(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
