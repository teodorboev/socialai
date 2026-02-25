---
name: competitive-ad-intelligence
description: "Monitors competitors' paid advertising across Meta Ad Library, TikTok Creative Center, LinkedIn Ad Library. Tracks active ads, estimated spend, creative formats, messaging angles, landing pages. Identifies campaign launches and suggests counter-positioning."
---

# SKILL: Competitive Ad Intelligence Agent

> **Prerequisite**: Read `base-agent` and `competitor-intelligence` skills first.

---

## Purpose

Monitors what competitors are spending money to promote. Tracks their active paid social campaigns across all major ad libraries, analyzes creative formats, messaging angles, targeting signals, and landing pages. Identifies when competitors launch new campaigns, estimates their spend levels, and suggests counter-positioning strategies. Knowing where competitors put their ad dollars reveals their true strategic priorities.

---

## File Location

```
agents/competitive-ad-intelligence.ts
lib/ai/prompts/competitive-ad-intelligence.ts
lib/ai/schemas/competitive-ad-intelligence.ts
lib/integrations/ad-libraries.ts
inngest/functions/ad-intelligence-scan.ts
```

---

## Data Sources

| Source | What It Provides | Access Method |
|--------|-----------------|---------------|
| Meta Ad Library | All active FB/IG ads for any page | Meta Ad Library API (free, public) |
| TikTok Creative Center | Top-performing TikTok ads | TikTok Creative Center API |
| LinkedIn Ad Library | Active LinkedIn sponsored content | LinkedIn Ad Library (web scrape) |
| Google Ads Transparency | Active Google/YouTube ads | Google Ads Transparency Center |

All ad libraries are public and free to access — this is publicly available competitive intelligence.

---

## Output Schema

```typescript
const AdIntelligenceSchema = z.object({
  scanDate: z.string(),

  competitorAdActivity: z.array(z.object({
    competitor: z.string(),
    platform: z.string(),
    totalActiveAds: z.number(),
    newAdsSinceLastScan: z.number(),
    estimatedSpendLevel: z.enum(["minimal", "moderate", "significant", "heavy"])
      .describe("Based on ad volume, platforms, and longevity"),

    adBreakdown: z.object({
      formats: z.record(z.string(), z.number())
        .describe("{ 'single_image': 5, 'video': 3, 'carousel': 2 }"),
      objectives: z.array(z.string()),
      themes: z.array(z.string())
        .describe("Main messaging themes: 'holiday sale', 'new product', 'brand awareness'"),
      ctas: z.array(z.string()),
      landingPages: z.array(z.string()),
    }),

    topAds: z.array(z.object({
      adId: z.string().optional(),
      platform: z.string(),
      format: z.string(),
      headline: z.string().optional(),
      bodyText: z.string().max(300),
      cta: z.string(),
      landingPage: z.string().optional(),
      startedAt: z.string().optional(),
      longevity: z.string().describe("How long it's been running — longer = likely performing well"),
      analysis: z.string().describe("What makes this ad effective or notable"),
    })).max(5),

    strategicInsights: z.array(z.string())
      .describe("What their ad strategy reveals about their business priorities"),
  })),

  campaignAlerts: z.array(z.object({
    competitor: z.string(),
    alertType: z.enum([
      "new_campaign_launch",
      "spend_increase",
      "new_messaging_angle",
      "targeting_your_audience",
      "holiday_push",
      "product_launch",
      "competitive_attack",
    ]),
    description: z.string(),
    urgency: z.enum(["fyi", "action_recommended", "urgent"]),
    evidence: z.string(),
  })),

  counterPositioning: z.array(z.object({
    competitorAction: z.string(),
    suggestedResponse: z.string(),
    responseType: z.enum([
      "counter_ad",           // Run your own ad targeting the same audience
      "organic_content",      // Create organic content differentiating from their message
      "ignore",               // Not worth responding to
      "differentiate",        // Highlight what you do that they don't
      "undercut",             // Offer a better deal
      "outflank",             // Target an adjacent audience they're missing
    ]),
    timing: z.string(),
    suggestedAdCopy: z.string().optional(),
    estimatedBudgetNeeded: z.string().optional(),
  })),

  marketOverview: z.object({
    totalCompetitorAds: z.number(),
    mostActiveCompetitor: z.string(),
    dominantFormat: z.string(),
    dominantTheme: z.string(),
    industryAdTrend: z.enum(["increasing", "stable", "decreasing"]),
    whitespace: z.array(z.string())
      .describe("Messaging angles or formats no competitor is using"),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model CompetitorAd {
  id              String   @id @default(uuid())
  organizationId  String
  competitorName  String
  platform        String
  adLibraryId     String?
  format          String
  headline        String?
  bodyText        String?  @db.Text
  cta             String?
  landingPage     String?
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  isActive        Boolean  @default(true)
  screenshotUrl   String?
  analysis        String?  @db.Text

  @@unique([organizationId, platform, adLibraryId])
  @@index([organizationId, competitorName, isActive])
  @@index([organizationId, firstSeenAt])
}

model AdIntelligenceReport {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  scanDate        DateTime
  competitorData  Json
  alerts          Json
  counterPositioning Json
  marketOverview  Json
  createdAt       DateTime @default(now())

  @@index([organizationId, scanDate])
}
```

---

## Schedule

```typescript
// Daily: scan ad libraries for changes
export const adIntelligenceScan = inngest.createFunction(
  { id: "ad-intelligence-scan" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    // 1. For each org's tracked competitors
    // 2. Query Meta Ad Library, TikTok Creative Center, etc.
    // 3. Identify new ads, removed ads, long-running ads
    // 4. Store/update CompetitorAd records
  }
);

// Weekly: deep analysis with LLM
export const adIntelligenceAnalysis = inngest.createFunction(
  { id: "ad-intelligence-analysis" },
  { cron: "0 7 * * 2" },  // Tuesday
  async ({ step }) => {
    // 1. Aggregate weekly ad data
    // 2. Run LLM analysis for insights, alerts, counter-positioning
    // 3. Feed to Strategy Agent, Ad Copy Agent, Reporting Narrator
  }
);

// Real-time: alert on major campaign launches
export const adIntelligenceAlert = inngest.createFunction(
  { id: "ad-intelligence-alert" },
  { event: "competitor/major-ad-activity" },
  async ({ event, step }) => {
    // Triggered when daily scan detects >5 new ads from one competitor
    // or a significant messaging shift
    // Immediate notification to dashboard
  }
);
```

---

## Integration

```
Competitive Ad Intelligence Agent
├── counterPositioning → Ad Copy Agent (create counter-ads)
├── counterPositioning → Content Creator (organic counter-content)
├── campaignAlerts → Strategy Agent (adjust strategy in response)
├── campaignAlerts → Pricing Intelligence (cross-reference pricing moves)
├── whitespace → Content Creator + Ad Copy (exploit gaps competitors miss)
├── topAds → A/B Testing (test similar approaches for client)
└── marketOverview → Reporting Narrator (include in competitive section of reports)
```
