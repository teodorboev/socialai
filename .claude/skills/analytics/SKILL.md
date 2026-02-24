---
name: analytics
description: "Analytics agent with two modes: data collection (no LLM) and AI-powered reporting. Metrics per platform, feedback loops to other agents, weekly reports."
---

# SKILL: Analytics Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Pulls performance data from all connected social platforms, stores snapshots, identifies trends, generates reports, and produces actionable recommendations that feed back into the Strategy and Content Creator agents. This agent closes the optimization loop.

---

## File Location

```
agents/analytics.ts
lib/ai/prompts/analytics.ts
lib/ai/schemas/analytics.ts
inngest/functions/analytics-snapshot.ts
inngest/functions/analytics-report.ts
```

---

## Two Modes of Operation

### Mode 1: Data Collection (No LLM — pure API calls)

Runs hourly/daily. Pulls raw metrics from platform APIs and stores in `analytics_snapshots`.

```typescript
interface SnapshotInput {
  organizationId: string;
  socialAccountId: string;
  platform: Platform;
}

// Output: writes directly to analytics_snapshots table
// Fields: followers, impressions, reach, engagementRate, clicks, shares, saves, topContent
```

Inngest schedule: `0 */6 * * *` (every 6 hours) for metrics, `0 2 * * *` (daily at 2am) for full snapshot.

### Mode 2: Analysis & Reporting (LLM-powered)

Runs weekly. Takes accumulated snapshot data, analyzes trends, and generates a human-readable report with recommendations.

```typescript
interface AnalyticsReportInput {
  organizationId: string;
  dateRange: { start: Date; end: Date };
  snapshots: AnalyticsSnapshot[];     // Raw data for the period
  contentPerformance: Array<{         // How each piece of content performed
    contentId: string;
    platform: string;
    contentType: string;
    caption: string;
    impressions: number;
    engagement: number;
    engagementRate: number;
    clicks: number;
    shares: number;
    saves: number;
    publishedAt: Date;
  }>;
  previousRecommendations?: string;   // Last report's recs (to track if they were followed)
}
```

---

## Output Schema (Report Mode)

```typescript
const AnalyticsReportSchema = z.object({
  summary: z.string()
    .describe("2-3 sentence executive summary of the period"),
  metrics: z.object({
    totalImpressions: z.number(),
    totalEngagements: z.number(),
    averageEngagementRate: z.number(),
    followerGrowth: z.number(),
    bestPerformingPlatform: z.string(),
    bestPerformingContentType: z.string(),
  }),
  topContent: z.array(z.object({
    contentId: z.string(),
    whyItWorked: z.string(),
  })).max(5),
  underperformers: z.array(z.object({
    contentId: z.string(),
    whyItUnderperformed: z.string(),
  })).max(3),
  trends: z.array(z.string())
    .describe("Emerging patterns: posting times, content types, themes gaining traction"),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    expectedImpact: z.string(),
    targetAgent: z.enum(["CONTENT_CREATOR", "STRATEGY", "PUBLISHER", "ENGAGEMENT", "VISUAL"])
      .describe("Which agent should act on this recommendation"),
  })),
  optimalPostingTimes: z.record(z.string(), z.array(z.string()))
    .describe("Updated optimal posting times per platform based on data"),
  confidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt (Report Mode)

```
You are a data-driven social media analyst for ${brandName}.

You have been given performance data for the past ${periodDays} days across all platforms.
Your job is to:
1. Summarize performance clearly for a non-technical business owner
2. Identify what worked and why
3. Identify what didn't work and why
4. Spot emerging trends in the data
5. Produce specific, actionable recommendations
6. Calculate optimal posting times from the data

Be specific with numbers. "Engagement increased" is useless. "Engagement rate increased from 2.1% to 3.4% (+62%), driven primarily by carousel posts on Instagram" is useful.

Every recommendation must name which AI agent should act on it and what the expected impact is.
```

---

## Metrics to Track Per Platform

| Metric | Instagram | Facebook | TikTok | Twitter | LinkedIn |
|--------|-----------|----------|--------|---------|----------|
| Followers | ✅ | ✅ (Page likes) | ✅ | ✅ | ✅ |
| Impressions | ✅ | ✅ | ✅ (Views) | ✅ | ✅ |
| Reach | ✅ | ✅ | ✅ | ❌ | ✅ |
| Engagement Rate | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clicks | ✅ (link) | ✅ | ✅ (profile) | ✅ | ✅ |
| Shares | ✅ | ✅ | ✅ | ✅ (Retweets) | ✅ |
| Saves | ✅ | ✅ | ✅ (Favorites) | ✅ (Bookmarks) | ❌ |
| Comments | ✅ | ✅ | ✅ | ✅ (Replies) | ✅ |
| Video views | ✅ (Reels) | ✅ | ✅ | ✅ | ✅ |
| Story views | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Feedback Loop

The Analytics Agent's `recommendations` output feeds directly into other agents:

```
Analytics Agent
├── recommendations[targetAgent=CONTENT_CREATOR] → Adjusts content themes, types, length
├── recommendations[targetAgent=STRATEGY]        → Updates content plan priorities
├── recommendations[targetAgent=PUBLISHER]       → Updates posting schedule/times
├── recommendations[targetAgent=ENGAGEMENT]      → Adjusts response strategy
├── recommendations[targetAgent=VISUAL]          → Changes visual style direction
└── optimalPostingTimes                          → Overrides Publisher defaults
```

Store recommendations in a `recommendations` JSON field on the latest ContentPlan so other agents can read them.

---

## Report Delivery

Weekly reports are:
1. Stored in database as JSON (for dashboard rendering)
2. Rendered as an email via Resend (clean HTML template)
3. Available in dashboard as a formatted report page

```typescript
// inngest/functions/analytics-report.ts
export const weeklyAnalyticsReport = inngest.createFunction(
  { id: "weekly-analytics-report" },
  { cron: "0 9 * * 1" },  // Every Monday at 9am
  async ({ step }) => {
    // 1. Get all active orgs
    // 2. For each, gather last 7 days of snapshots + content performance
    // 3. Run AnalyticsAgent in report mode
    // 4. Store report
    // 5. Send email via Resend
  }
);
```
