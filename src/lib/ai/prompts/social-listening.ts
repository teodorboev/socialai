import type { SocialListeningInput } from "../schemas/social-listening";

export function buildSocialListeningPrompt(input: SocialListeningInput): string {
  return `You are a social listening analyst for ${input.brandConfig.brandName} in the ${input.brandConfig.industry} industry.

Analyze recent mentions and provide insights about brand sentiment, emerging conversations, and potential opportunities or risks.

BRAND:
- Name: ${input.brandConfig.brandName}
- Alternate names/hashtags: ${input.brandConfig.alternateNames.join(", ")}
- Competitors: ${input.brandConfig.competitors.join(", ")}

TRACKING:
- Keywords: ${input.trackingKeywords.join(", ")}
- Hashtags: ${input.trackingHashtags.join(", ")}
- Excluded: ${input.excludeKeywords.join(", ")}

SENTIMENT BASELINE:
- Positive: ${input.sentimentBaseline.positive}%
- Neutral: ${input.sentimentBaseline.neutral}%
- Negative: ${input.sentimentBaseline.negative}%

${input.recentMentions ? `RECENT MENTIONS (${input.recentMentions.length}):
${input.recentMentions.slice(0, 30).map((m) => `- @${m.author} (${m.platform}): ${m.body.substring(0, 200)} [${m.sentiment}]`).join("\n")}` : "No recent mentions provided."}

Your task:
1. Analyze the sentiment of mentions
2. Detect sentiment shifts from baseline
3. Identify alerts (spikes, crises, opportunities)
4. Find trending conversations to join
5. Spot UGC opportunities

Respond with JSON:
{
  "scannedAt": "${new Date().toISOString()}",
  "mentionCount": ${input.recentMentions?.length || 0},
  "sentimentBreakdown": {
    "positive": 0-100,
    "neutral": 0-100,
    "negative": 0-100,
    "urgent": 0-100
  },
  "sentimentShift": {
    "direction": "improving|stable|declining|crisis",
    "magnitude": 0-100,
    "explanation": "what changed and why"
  },
  "alerts": [
    {
      "type": "mention_spike|sentiment_drop|viral_mention|crisis_potential|ugc_opportunity|partnership_opportunity|competitive_mention|review_alert",
      "severity": "info|warning|critical",
      "title": "alert title",
      "description": "what's happening",
      "source": "where it came from",
      "url": "optional link",
      "suggestedAction": "what to do"
    }
  ],
  "topMentions": [
    {
      "platform": "Twitter|Instagram|Reddit|etc",
      "author": "username",
      "body": "the mention (max 500 chars)",
      "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
      "reach": estimated_views,
      "url": "optional link",
      "isUGC": true|false
    }
  ],
  "trendingConversations": [
    {
      "topic": "what people are talking about",
      "volume": estimated_mentions,
      "sentiment": "positive|neutral|negative",
      "relevance": "how relevant to brand",
      "opportunityToJoin": true|false,
      "suggestedResponse": "optional response idea"
    }
  ],
  "confidenceScore": 0.0-1.0
}`;
}
