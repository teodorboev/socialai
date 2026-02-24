---
name: trend-scout
description: "Trend detection agent: data sources, relevance scoring, safety rules, urgent trend pipeline, competitor monitoring, integration with Content Creator."
---

# SKILL: Trend Scout Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Continuously monitors trending topics, viral content, competitor activity, and industry news across all platforms. Feeds relevant opportunities to the Content Creator and Strategy agents. Acts as the "always-on radar" that keeps content timely and culturally relevant.

---

## File Location

```
agents/trend-scout.ts
lib/ai/prompts/trend-scout.ts
lib/ai/schemas/trend-scout.ts
inngest/functions/trend-scan.ts
```

---

## Data Sources

| Source | What It Provides | How to Access |
|--------|-----------------|---------------|
| X/Twitter Trending | Trending hashtags, topics | X API v2 — `GET /2/trends/by/woeid` |
| TikTok Discover | Trending sounds, effects, hashtags | TikTok Research API or web scraping |
| Instagram Explore | Trending Reels audio, hashtag volumes | Meta Graph API (limited), third-party |
| Google Trends | Search interest over time | Google Trends API (unofficial) or SerpAPI |
| Reddit | Emerging discussions in niche subreddits | Reddit API |
| News APIs | Industry news, current events | NewsAPI, Google News RSS |
| Competitor monitoring | What competitors are posting | Platform APIs — fetch recent posts from competitor accounts |

---

## Output Schema

```typescript
const TrendReportSchema = z.object({
  scannedAt: z.string().datetime(),
  trends: z.array(z.object({
    topic: z.string(),
    description: z.string(),
    relevanceScore: z.number().min(0).max(1)
      .describe("How relevant this trend is to the brand's industry and audience"),
    urgency: z.enum(["immediate", "this_week", "this_month"])
      .describe("How quickly to act — viral moments are immediate, seasonal trends are this_month"),
    platforms: z.array(z.string())
      .describe("Which platforms this trend is active on"),
    contentSuggestion: z.string()
      .describe("Specific content idea for the brand to capitalize on this trend"),
    contentType: z.enum(["POST", "REEL", "STORY", "THREAD", "CAROUSEL"]),
    source: z.string(),
    riskLevel: z.enum(["safe", "moderate", "risky"])
      .describe("safe = universally fine; moderate = check brand guidelines; risky = could be controversial"),
  })),
  competitorActivity: z.array(z.object({
    competitor: z.string(),
    platform: z.string(),
    observation: z.string(),
    opportunity: z.string().optional(),
  })),
  confidenceScore: z.number().min(0).max(1),
});
```

---

## Execution Flow

```
Every 4 hours:
1. Fetch trending data from all sources
2. Filter by brand's industry, audience, content themes
3. Score relevance (0-1) for each trend
4. Generate content suggestions for relevant trends (relevanceScore ≥ 0.6)
5. Store trend report
6. For "immediate" urgency trends with high relevance:
   → Trigger Content Creator Agent to generate timely content
   → Notify via dashboard (Supabase Realtime)

Every 24 hours:
1. Fetch competitor recent posts (last 24h)
2. Analyze for patterns, viral content, strategy shifts
3. Add to trend report as competitorActivity
```

---

## Relevance Scoring

The LLM scores relevance based on:
1. **Industry match**: Is this trend in or adjacent to the brand's industry?
2. **Audience alignment**: Would the target audience care about this?
3. **Brand voice fit**: Can the brand comment on this authentically?
4. **Risk assessment**: Could this backfire? (Avoid political, divisive, tragedy-adjacent)
5. **Timeliness**: Is the brand early enough to ride this, or is it already played out?

Trends with `relevanceScore < 0.4` are discarded. Trends with `riskLevel = "risky"` always require human review regardless of relevance score.

---

## Integration with Content Creator

```typescript
// When Content Creator runs, it receives trend context:
const latestTrends = await prisma.agentLog.findFirst({
  where: {
    organizationId,
    agentName: "TREND_SCOUT",
    status: "SUCCESS",
  },
  orderBy: { createdAt: "desc" },
});

// Filter to relevant, safe, non-expired trends
const trendContext = latestTrends?.outputSummary?.trends
  ?.filter(t => t.relevanceScore >= 0.6 && t.riskLevel !== "risky")
  ?.map(t => `[${t.urgency.toUpperCase()}] ${t.topic}: ${t.contentSuggestion}`)
  ?.join("\n");

// Pass to Content Creator as trendContext parameter
```

---

## Schedule

```typescript
export const trendScan = inngest.createFunction(
  { id: "trend-scan", retries: 2 },
  { cron: "0 */4 * * *" },  // Every 4 hours
  async ({ step }) => {
    const orgs = await step.run("get-active-orgs", /* ... */);

    // Batch trend fetching (shared across orgs)
    const globalTrends = await step.run("fetch-global-trends", async () => {
      return {
        twitter: await fetchTwitterTrends(),
        google: await fetchGoogleTrends(),
        news: await fetchIndustryNews(),
      };
    });

    // Per-org: filter trends by relevance + check competitors
    for (const org of orgs) {
      await step.run(`analyze-trends-${org.id}`, async () => {
        const agent = new TrendScoutAgent();
        await agent.run(org.id, {
          organizationId: org.id,
          brandConfig: org.brandConfig,
          globalTrends,
          competitors: org.brandConfig.competitors,
        });
      });
    }
  }
);
```

---

## Safety Rules

1. **Never recommend jumping on tragedy-related trends** — natural disasters, mass violence, deaths
2. **Never recommend political content** unless the brand is explicitly political
3. **Flag divisive trends as "risky"** — even if relevant, let humans decide
4. **Check trend age** — if a meme/trend is >72 hours old on TikTok, it's likely too late
5. **Competitor mentions** — observation only. Never recommend directly copying or calling out competitors
