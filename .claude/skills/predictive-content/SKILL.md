---
name: predictive-content
description: "Predicts how content will perform BEFORE publishing using historical data. Scores drafts on predicted engagement, reach, virality. Recommends modifications to improve predictions. Turns content from guesswork into data science."
---

# SKILL: Predictive Content Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Uses the client's historical performance data, audience patterns, and platform trends to predict how a piece of draft content will perform before it's published. Provides a performance prediction score and specific recommendations to improve it. This is the "crystal ball" that no human social media manager can replicate at scale.

---

## File Location

```
agents/predictive-content.ts
lib/ai/prompts/predictive-content.ts
lib/ai/schemas/predictive-content.ts
lib/prediction/features.ts
inngest/functions/content-prediction.ts
```

---

## When It Runs

Synchronous — called in the content pipeline after Content Creator generates a post but before scheduling:

```
Content Creator → Predictive Content → [score adjustments] → Compliance → Publisher
```

Also available on-demand from the dashboard when a user edits or creates content manually.

---

## Feature Extraction

```typescript
interface PredictionFeatures {
  // Content features
  captionLength: number;
  sentenceCount: number;
  questionCount: number;
  emojiCount: number;
  hashtagCount: number;
  hasCallToAction: boolean;
  hasMention: boolean;
  hasUrl: boolean;
  readabilityScore: number;
  contentType: string;
  topic: string;
  sentiment: string;
  hookType: string;         // "question", "statistic", "story", "bold_claim", "how_to"

  // Temporal features
  scheduledDayOfWeek: number;
  scheduledHourUtc: number;
  isWeekend: boolean;
  daysUntilNextHoliday: number;
  isInPeakWindow: boolean;  // From Audience Intelligence

  // Historical context
  orgAvgEngagement30d: number;
  orgAvgEngagementForContentType: number;
  orgAvgEngagementForTopic: number;
  orgAvgEngagementForDayTime: number;
  orgBestPerformingHookType: string;
  daysSinceLastPostSameTopic: number;
  postsThisWeekSamePlatform: number;

  // Platform context
  platformAvgEngagement: number;  // Industry benchmark
  trendingTopicsOverlap: number;  // Does the topic overlap with trending?
}
```

---

## Output Schema

```typescript
const PredictionOutputSchema = z.object({
  contentId: z.string(),

  prediction: z.object({
    predictedEngagementRate: z.number(),
    predictedReach: z.number(),
    performancePercentile: z.number().min(0).max(100)
      .describe("Predicted rank among this client's posts. 80 = better than 80% of their posts"),
    viralityProbability: z.number().min(0).max(1)
      .describe("Chance of this post significantly outperforming average"),
    confidenceInterval: z.object({
      low: z.number(),
      high: z.number(),
    }).describe("Expected engagement rate range"),
  }),

  strengthAnalysis: z.array(z.object({
    factor: z.string(),
    impact: z.enum(["strong_positive", "positive", "neutral", "negative", "strong_negative"]),
    explanation: z.string(),
  })),

  improvements: z.array(z.object({
    suggestion: z.string(),
    predictedLift: z.string().describe("'Estimated +15-25% engagement'"),
    effort: z.enum(["trivial", "minor_edit", "rewrite", "format_change"]),
    example: z.string().optional().describe("Concrete example of the suggestion applied"),
  })).max(5),

  alternativeVersions: z.array(z.object({
    description: z.string(),
    caption: z.string(),
    predictedEngagement: z.number(),
    changesMade: z.string(),
  })).max(2).optional(),

  timingRecommendation: z.object({
    currentSlot: z.object({ day: z.string(), hour: z.number() }),
    optimalSlot: z.object({ day: z.string(), hour: z.number() }),
    expectedLiftFromRescheduling: z.string(),
  }),

  publishRecommendation: z.enum([
    "strong_publish",   // Predicted top 20% — publish as-is
    "publish",          // Predicted above average — good to go
    "publish_with_edits", // Below average but fixable — apply suggestions
    "consider_rewrite",   // Predicted bottom 30% — significant changes needed
    "hold",               // Predicted poor performance — consider not publishing
  ]),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are a content performance prediction specialist for ${brandName} on ${platform}.

You have access to this client's historical performance data:
- Average engagement rate: ${avgEngagement}%
- Top performing content types: ${topTypes}
- Best hooks: ${bestHooks}
- Best posting times: ${bestTimes}
- Topics that resonate: ${topTopics}
- Topics that underperform: ${weakTopics}

DRAFT CONTENT TO EVALUATE:
"${caption}"
Type: ${contentType}
Scheduled: ${scheduledTime}
Hashtags: ${hashtags}

Based on historical patterns and the features of this content, predict performance and provide actionable improvements.

RULES:
1. Be calibrated — don't predict everything will be "great" or "terrible". Use the historical data.
2. Specific suggestions only — "make it better" is useless. "Change the opening from a statement to a question — questions get 23% more comments for this client" is useful.
3. If the content is genuinely good, say so. Don't invent problems.
4. Compare to THIS client's data, not generic benchmarks.
5. Factor in content fatigue — if they've posted about this topic 3 times this week, predict lower engagement.
```

---

## Learning Loop

After every post publishes and accumulates 7 days of data:

```typescript
// Compare prediction vs actual
const accuracy = {
  contentId: post.id,
  predictedEngagement: prediction.predictedEngagementRate,
  actualEngagement: post.engagementRate,
  error: Math.abs(prediction.predictedEngagementRate - post.engagementRate),
  percentileAccuracy: Math.abs(prediction.performancePercentile - actualPercentile),
};

// Store for model calibration
await prisma.predictionAccuracy.create({ data: accuracy });

// Recalibrate: if predictions are consistently high/low, adjust
```

---

## Database

```prisma
model ContentPrediction {
  id                    String   @id @default(uuid())
  contentId             String   @unique
  organizationId        String
  predictedEngagement   Float
  predictedReach        Int?
  performancePercentile Int
  publishRecommendation String
  improvements          Json
  features              Json      // Feature vector used for prediction
  actualEngagement      Float?    // Filled after publish + 7 days
  actualReach           Int?
  predictionError       Float?    // Filled after comparison
  createdAt             DateTime  @default(now())
  evaluatedAt           DateTime? // When actual vs predicted was compared

  @@index([organizationId, createdAt])
}
```

---

## Integration

```
Predictive Content Agent
├── publishRecommendation → Content pipeline (gate: "hold" prevents scheduling)
├── improvements → Content Creator (auto-apply trivial fixes)
├── timingRecommendation → Calendar Optimizer (adjust schedule)
├── predictionAccuracy → Self (recalibrate model over time)
└── alternativeVersions → Review queue (show alternatives alongside original)
```
