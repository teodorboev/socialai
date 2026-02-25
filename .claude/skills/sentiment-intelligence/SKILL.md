---
name: sentiment-intelligence
description: "Deep brand perception modeling beyond basic positive/negative. Tracks emotion categories (trust, excitement, frustration), maps sentiment to product lines, detects narrative shifts, produces brand health scores over time. Enterprise-grade social intelligence."
---

# SKILL: Sentiment Intelligence Agent

> **Prerequisite**: Read `base-agent` and `social-listening` skills first.

---

## Purpose

Goes far deeper than Social Listening's basic positive/neutral/negative classification. Builds a multi-dimensional brand perception model that tracks specific emotions, maps sentiment to product lines or services, identifies narrative themes in conversations about the brand, and produces a longitudinal "brand health" score. This is the intelligence layer that enterprise brands pay $50K+/year for from tools like Brandwatch.

---

## File Location

```
agents/sentiment-intelligence.ts
lib/ai/prompts/sentiment-intelligence.ts
lib/ai/schemas/sentiment-intelligence.ts
inngest/functions/sentiment-deep-analysis.ts
```

---

## Emotion Taxonomy

Beyond positive/negative, classify into:

| Category | Emotions | Business Meaning |
|----------|----------|-----------------|
| Trust | confidence, reliability, credibility | Brand equity, customer loyalty |
| Excitement | enthusiasm, anticipation, delight | Product launches, campaigns working |
| Frustration | anger, disappointment, impatience | Service issues, product problems |
| Loyalty | advocacy, pride, belonging | Community strength, NPS proxy |
| Confusion | uncertainty, misunderstanding | Messaging clarity issues |
| Indifference | apathy, disinterest | Content not resonating, brand fading |

---

## Output Schema

```typescript
const SentimentIntelligenceSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),

  brandHealthScore: z.number().min(0).max(100)
    .describe("Composite brand health: 80+ is strong, 50-79 is average, <50 needs attention"),
  previousScore: z.number(),
  scoreTrend: z.enum(["improving", "stable", "declining"]),

  emotionBreakdown: z.record(z.string(), z.object({
    percentage: z.number(),
    change: z.number().describe("Percentage point change from previous period"),
    trend: z.enum(["rising", "stable", "falling"]),
    topTriggers: z.array(z.string()).max(3)
      .describe("What's driving this emotion"),
    exampleMentions: z.array(z.string()).max(2),
  })),

  topicSentimentMap: z.array(z.object({
    topic: z.string().describe("Product line, service, feature, campaign, etc."),
    overallSentiment: z.number().min(-1).max(1),
    volume: z.number(),
    dominantEmotion: z.string(),
    trendDirection: z.enum(["improving", "stable", "declining"]),
    keyNarratives: z.array(z.string()),
  })),

  narrativeShifts: z.array(z.object({
    narrative: z.string().describe("The emerging story being told about the brand"),
    direction: z.enum(["new", "growing", "peaking", "fading"]),
    sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
    volume: z.number(),
    riskLevel: z.enum(["none", "low", "medium", "high"]),
    suggestedResponse: z.string(),
  })),

  competitiveSentiment: z.array(z.object({
    competitor: z.string(),
    theirHealthScore: z.number(),
    comparison: z.string(),
    clientAdvantage: z.string().optional(),
    clientVulnerability: z.string().optional(),
  })).optional(),

  earlyWarnings: z.array(z.object({
    signal: z.string(),
    currentLevel: z.string(),
    threshold: z.string(),
    timeToThreshold: z.string(),
    preventiveAction: z.string(),
  })),

  recommendations: z.array(z.object({
    area: z.string(),
    action: z.string(),
    expectedImpact: z.string(),
    priority: z.enum(["immediate", "this_week", "this_month"]),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model BrandHealthSnapshot {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  healthScore     Int
  emotionBreakdown Json
  topicSentiment  Json
  narrativeShifts Json
  earlyWarnings   Json
  periodStart     DateTime
  periodEnd       DateTime
  createdAt       DateTime @default(now())

  @@index([organizationId, periodStart])
}
```

---

## Schedule

```typescript
// Weekly: deep sentiment analysis
export const sentimentDeepAnalysis = inngest.createFunction(
  { id: "sentiment-deep-analysis" },
  { cron: "0 6 * * 1" },  // Monday 6am
  async ({ step }) => {
    // 1. Pull all mentions from Social Listening for the past week
    // 2. Run multi-dimensional emotion classification (LLM batch)
    // 3. Map emotions to topics/products
    // 4. Detect narrative shifts by comparing to previous weeks
    // 5. Calculate brand health score
    // 6. Generate early warnings
    // 7. Store snapshot
    // 8. Feed to Reporting Narrator
  }
);
```

---

## Integration

```
Sentiment Intelligence Agent
├── brandHealthScore → Reporting Narrator (headline metric in reports)
├── brandHealthScore → Churn Prediction (low brand health = client may blame platform)
├── topicSentimentMap → Strategy Agent (lean into positive topics, address negative)
├── narrativeShifts → Crisis Response (detect pre-crisis narratives early)
├── emotionBreakdown → Content Creator (match content tone to audience emotion)
├── earlyWarnings → Orchestrator (trigger preventive actions)
└── competitiveSentiment → Competitor Intelligence (enrich competitor reports)
```
