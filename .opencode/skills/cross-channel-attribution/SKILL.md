---
name: cross-channel-attribution
description: "Maps the customer journey across social touchpoints. Tracks follower → visitor → subscriber → customer path. Identifies which platform/content drives each funnel stage. Multi-touch attribution modeling."
---

# SKILL: Cross-Channel Attribution Agent

> **Prerequisite**: Read `base-agent` and `roi-attribution` skills first.

---

## Purpose

While ROI Attribution tracks direct conversions, Cross-Channel Attribution maps the full customer journey across multiple social touchpoints. Identifies how platforms work together: Instagram builds awareness, LinkedIn generates leads, email nurtures, and a retargeted Facebook ad closes the sale. Answers "which platform and content type is most effective at each stage of the funnel?"

---

## File Location

```
agents/cross-channel-attribution.ts
lib/ai/prompts/cross-channel-attribution.ts
lib/ai/schemas/cross-channel-attribution.ts
inngest/functions/journey-analysis.ts
```

---

## Journey Tracking

```typescript
interface CustomerJourney {
  visitorId: string;         // Anonymous cookie/device ID
  touchpoints: Array<{
    timestamp: Date;
    channel: string;          // "instagram", "facebook", "linkedin", "email", "website", "google_ad"
    action: string;           // "saw_post", "clicked_link", "visited_site", "subscribed", "added_to_cart", "purchased"
    contentId?: string;       // Which specific post drove this action
    platform?: string;
    value?: number;           // Revenue for purchase events
  }>;
  outcome: "converted" | "active" | "dormant" | "lost";
  totalValue: number;
  journeyDuration: number;   // Days from first touch to conversion
}
```

---

## Attribution Models

| Model | How It Works | Best For |
|-------|-------------|----------|
| First Touch | 100% credit to first interaction | Understanding awareness drivers |
| Last Touch | 100% credit to final interaction | Understanding conversion drivers |
| Linear | Equal credit to all touchpoints | Fair overall picture |
| Time Decay | More credit to recent touchpoints | Understanding recent influence |
| Position Based | 40% first, 40% last, 20% middle | Balanced understanding |
| Data-Driven | ML-weighted based on actual patterns | Most accurate, needs volume |

---

## Output Schema

```typescript
const CrossChannelReportSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),

  journeyInsights: z.object({
    avgTouchpointsToConvert: z.number(),
    avgDaysToConvert: z.number(),
    mostCommonJourneyPath: z.array(z.string()),
    topJourneyPaths: z.array(z.object({
      path: z.array(z.string()),
      frequency: z.number(),
      avgValue: z.number(),
    })).max(5),
  }),

  channelRoles: z.record(z.string(), z.object({
    primaryRole: z.enum(["awareness", "consideration", "conversion", "retention"]),
    firstTouchConversions: z.number(),
    lastTouchConversions: z.number(),
    assistedConversions: z.number(),
    avgPositionInJourney: z.number().describe("1 = first touch, higher = later"),
    bestPairedWith: z.string().describe("Which channel it works best alongside"),
    revenueContribution: z.record(z.string(), z.number())
      .describe("Revenue attributed under each model"),
  })),

  contentTypeJourneyMap: z.array(z.object({
    contentType: z.string(),
    funnelStage: z.enum(["awareness", "consideration", "conversion"]),
    effectiveness: z.number().min(0).max(1),
    avgPosition: z.number(),
    exampleContent: z.string(),
  })),

  synergies: z.array(z.object({
    channelPair: z.array(z.string()),
    synergy: z.string().describe("How these channels amplify each other"),
    evidence: z.string(),
    recommendation: z.string(),
  })),

  gaps: z.array(z.object({
    gap: z.string(),
    funnelStage: z.string(),
    impact: z.string(),
    suggestedFix: z.string(),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model JourneyTouchpoint {
  id              String   @id @default(uuid())
  organizationId  String
  visitorId       String   // Anonymous ID
  channel         String
  action          String
  contentId       String?
  platform        String?
  eventValue      Float?
  sessionData     Json?
  occurredAt      DateTime
  createdAt       DateTime @default(now())

  @@index([organizationId, visitorId, occurredAt])
  @@index([organizationId, channel])
}

model JourneyAnalysis {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  periodStart     DateTime
  periodEnd       DateTime
  journeyInsights Json
  channelRoles    Json
  synergies       Json
  gaps            Json
  createdAt       DateTime @default(now())

  @@index([organizationId, periodStart])
}
```

---

## Schedule

```typescript
// Monthly: full journey analysis (needs volume to be meaningful)
export const journeyAnalysis = inngest.createFunction(
  { id: "journey-analysis" },
  { cron: "0 8 1 * *" },  // 1st of month
  async ({ step }) => {
    // 1. Aggregate touchpoints into journeys per visitor
    // 2. Apply attribution models
    // 3. Run LLM for insights, synergies, gaps
    // 4. Feed to Reporting Narrator + Strategy Agent
  }
);
```

---

## Integration

```
Cross-Channel Attribution Agent
├── channelRoles → Strategy Agent (allocate effort to channels by funnel role)
├── synergies → Calendar Optimizer (coordinate cross-platform posting)
├── gaps → Content Creator (create content for underserved funnel stages)
├── journeyInsights → Reporting Narrator (include in monthly deep dives)
├── contentTypeJourneyMap → Ad Copy Agent (use right content type per funnel stage)
└── avgDaysToConvert → ROI Attribution (time-adjusted revenue attribution)
```
