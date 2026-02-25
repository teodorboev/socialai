---
name: social-listening
description: "Monitors brand mentions, keywords, and industry terms across the social web — even when not tagged. Detects sentiment shifts, reputation risks, and UGC opportunities. Sends real-time alerts."
---

# SKILL: Social Listening Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Goes beyond the Engagement Agent (which handles direct replies/DMs) to monitor the entire social web for brand mentions, keyword discussions, and industry conversations — even when the brand isn't tagged. Detects sentiment shifts early, flags reputation risks, finds user-generated content, and identifies conversation opportunities.

This is the brand's "radar system" across the open web.

---

## File Location

```
agents/social-listening.ts
lib/ai/prompts/social-listening.ts
lib/ai/schemas/social-listening.ts
lib/listening/sources.ts
inngest/functions/social-listening-scan.ts
```

---

## What It Monitors

| Source | What to Track | How |
|--------|--------------|-----|
| X/Twitter | Brand mentions, keywords, hashtags | X API v2 search endpoint |
| Reddit | Brand mentions in relevant subreddits | Reddit API |
| Instagram | Tagged posts, hashtag mentions | Meta Graph API |
| TikTok | Hashtag mentions, brand name in captions | TikTok Research API |
| LinkedIn | Brand mentions in posts | LinkedIn API (limited) |
| Google | New reviews, news articles | Google Alerts API / News API |
| Web/Forums | Blog mentions, forum discussions | NewsAPI, SerpAPI, or custom crawl |

---

## Input Interface

```typescript
interface SocialListeningInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    alternateNames: string[];      // Misspellings, abbreviations, hashtags
    industry: string;
    competitors: string[];
  };
  trackingKeywords: string[];      // From DB — managed in admin UI
  trackingHashtags: string[];
  excludeKeywords: string[];       // Filter noise: "not hiring", "stock price"
  sentimentBaseline: {
    positive: number;              // Historical average percentages
    neutral: number;
    negative: number;
  };
}
```

---

## Output Schema

```typescript
const ListeningReportSchema = z.object({
  scannedAt: z.string().datetime(),
  mentionCount: z.number(),
  sentimentBreakdown: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
    urgent: z.number(),
  }),
  sentimentShift: z.object({
    direction: z.enum(["improving", "stable", "declining", "crisis"]),
    magnitude: z.number().describe("Percentage point shift from baseline"),
    explanation: z.string(),
  }),
  alerts: z.array(z.object({
    type: z.enum([
      "mention_spike",           // Unusual volume of mentions
      "sentiment_drop",          // Negative sentiment increasing
      "viral_mention",           // Single mention getting huge traction
      "crisis_potential",        // Multiple negative signals converging
      "ugc_opportunity",         // User creating great content about the brand
      "partnership_opportunity", // Influencer or brand praising the client
      "competitive_mention",     // Brand mentioned alongside competitor
      "review_alert",           // New review on Google/Yelp/etc.
    ]),
    severity: z.enum(["info", "warning", "critical"]),
    title: z.string(),
    description: z.string(),
    source: z.string(),
    url: z.string().optional(),
    suggestedAction: z.string(),
  })),
  topMentions: z.array(z.object({
    platform: z.string(),
    author: z.string(),
    body: z.string().max(500),
    sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
    reach: z.number().describe("Estimated audience size of the author"),
    url: z.string().optional(),
    isUGC: z.boolean().describe("Is this user-generated content worth amplifying?"),
  })).max(20),
  trendingConversations: z.array(z.object({
    topic: z.string(),
    volume: z.number(),
    sentiment: z.string(),
    relevance: z.string(),
    opportunityToJoin: z.boolean(),
    suggestedResponse: z.string().optional(),
  })).max(5),
  confidenceScore: z.number().min(0).max(1),
});
```

---

## Alert Escalation Rules

| Alert Type | Severity Trigger | Action |
|-----------|-----------------|--------|
| mention_spike | >3x average hourly volume | Notify dashboard, email if >5x |
| sentiment_drop | >10% decline from baseline | Escalate as HIGH, email org admin |
| viral_mention | Single mention >10K impressions | Notify dashboard |
| crisis_potential | Multiple negative + spike | Escalate as CRITICAL, email immediately |
| ugc_opportunity | Positive + high reach + visual | Queue for Engagement Agent to respond |
| partnership_opportunity | Influencer praise | Escalate as MEDIUM to human |
| review_alert | New 1-2 star review | Escalate as HIGH |

---

## Database

```prisma
model ListeningMention {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  platform        String
  author          String
  authorHandle    String?
  body            String   @db.Text
  sentiment       Sentiment
  reach           Int      @default(0)
  url             String?
  isUGC           Boolean  @default(false)
  isProcessed     Boolean  @default(false)
  detectedAt      DateTime @default(now())

  @@index([organizationId, detectedAt])
  @@index([organizationId, sentiment])
}

model ListeningKeyword {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  keyword         String
  type            String   // "brand", "industry", "competitor", "hashtag"
  isEnabled       Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@unique([organizationId, keyword])
}
```

Admin UI: Dashboard → Listening → Keywords (add/remove tracked terms, hashtags, competitor names).

---

## Schedule

```typescript
// High-frequency scan: every 30 minutes
export const listeningScan = inngest.createFunction(
  { id: "social-listening-scan", retries: 2 },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    // 1. For each active org with listening enabled
    // 2. Query each source API for new mentions since last scan
    // 3. Store raw mentions in listening_mentions table
    // 4. Run sentiment classification (batch LLM call)
    // 5. Check alert conditions
    // 6. If alerts triggered → create escalation + push realtime notification
  }
);

// Daily: sentiment trend analysis
export const listeningDailyReport = inngest.createFunction(
  { id: "listening-daily-report" },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    // Aggregate mentions, run LLM analysis, update sentiment baseline
  }
);
```

---

## Integration

```
Social Listening Agent
├── ugc_opportunity alerts → Engagement Agent (respond and amplify)
├── partnership_opportunity → Influencer Scout Agent (add to pipeline)
├── sentiment trends → Analytics Agent (include in weekly report)
├── trending conversations → Trend Scout Agent (cross-reference)
├── crisis_potential → Orchestrator (trigger crisis protocol: pause publishing, escalate)
└── competitive mentions → Competitor Intelligence Agent (enrich data)
```
