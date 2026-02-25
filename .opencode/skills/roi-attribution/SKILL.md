---
name: roi-attribution
description: "Connects social activity to business outcomes. Tracks UTM links, correlates posts with traffic/conversion spikes, attributes revenue to specific content. Integrates with GA4, Shopify, WooCommerce, CRM. Answers 'is social making me money?'"
---

# SKILL: ROI Attribution Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Answers the single most important question every client has: "Is social media actually making me money?" Connects social media activity to measurable business outcomes — website traffic, leads, conversions, and revenue. Attributes results to specific posts, campaigns, platforms, and content types. Produces reports that justify social media spend with real numbers.

Clients who see revenue attribution never cancel.

---

## File Location

```
agents/roi-attribution.ts
lib/ai/prompts/roi-attribution.ts
lib/ai/schemas/roi-attribution.ts
lib/integrations/analytics-connectors.ts
inngest/functions/roi-tracking.ts
```

---

## Data Sources

| Source | What It Provides | Integration |
|--------|-----------------|-------------|
| Google Analytics 4 | Website traffic, events, conversions, revenue | GA4 Data API |
| Shopify | Orders, revenue, cart data | Shopify Admin API |
| WooCommerce | Orders, revenue | WooCommerce REST API |
| Stripe | Payment events, subscription data | Stripe API (already integrated) |
| Meta Pixel | FB/IG ad conversions, website actions | Meta Conversions API |
| UTM parameters | Campaign/source/medium tracking | Parsed from URLs |
| Link shortener | Click tracking per post | Bitly API or custom shortener |
| CRM (HubSpot, etc.) | Lead creation, deal progression | HubSpot API |

---

## UTM Strategy

Every link published by the platform gets auto-tagged:

```
https://client.com/product?
  utm_source=instagram
  &utm_medium=organic
  &utm_campaign=summer-collection
  &utm_content=post-{contentId}
  &utm_term={postType}
```

This ties every click back to a specific post in the system.

---

## Output Schema

```typescript
const ROIReportSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),

  toplineMetrics: z.object({
    totalSocialTraffic: z.number(),
    totalSocialConversions: z.number(),
    totalSocialRevenue: z.number(),
    costOfAIOperations: z.number().describe("LLM costs, image generation, etc."),
    netROI: z.number().describe("Revenue minus platform cost"),
    roiMultiplier: z.number().describe("Revenue / cost ratio"),
  }),

  platformAttribution: z.record(z.string(), z.object({
    traffic: z.number(),
    conversions: z.number(),
    revenue: z.number(),
    costPerConversion: z.number(),
    topConvertingContentType: z.string(),
    funnelRole: z.enum(["awareness", "consideration", "conversion", "mixed"]),
  })),

  contentAttribution: z.array(z.object({
    contentId: z.string(),
    platform: z.string(),
    caption: z.string().max(100),
    clicks: z.number(),
    conversions: z.number(),
    revenue: z.number(),
    conversionRate: z.number(),
    attribution: z.enum(["direct", "assisted", "first_touch", "last_touch"]),
  })).max(20),

  campaignAttribution: z.array(z.object({
    campaignName: z.string(),
    totalPosts: z.number(),
    totalClicks: z.number(),
    totalConversions: z.number(),
    totalRevenue: z.number(),
    bestPerformingPost: z.string(),
  })),

  funnelAnalysis: z.object({
    awarenessToConsideration: z.number().describe("% of social visitors who engage further"),
    considerationToConversion: z.number(),
    averageTimeToConvert: z.string(),
    topConversionPaths: z.array(z.string()),
  }),

  insights: z.array(z.object({
    insight: z.string(),
    evidence: z.string(),
    recommendation: z.string(),
    estimatedImpact: z.string(),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model AnalyticsConnection {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  provider        String   // "ga4", "shopify", "woocommerce", "hubspot", "stripe"
  credentials     String   @db.Text // Encrypted
  config          Json     // Provider-specific: GA4 property ID, Shopify store URL, etc.
  isEnabled       Boolean  @default(true)
  lastSyncedAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, provider])
}

model AttributionEvent {
  id              String   @id @default(uuid())
  organizationId  String
  contentId       String?
  platform        String?
  campaign        String?
  eventType       String   // "click", "page_view", "add_to_cart", "purchase", "lead", "signup"
  eventValue      Float?   // Revenue amount for purchases
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
  utmContent      String?
  sessionId       String?
  occurredAt      DateTime
  createdAt       DateTime @default(now())

  @@index([organizationId, occurredAt])
  @@index([organizationId, contentId])
  @@index([organizationId, campaign])
}

model ROIReport {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  periodStart     DateTime
  periodEnd       DateTime
  toplineMetrics  Json
  platformData    Json
  contentData     Json
  insights        Json
  createdAt       DateTime @default(now())

  @@index([organizationId, periodStart])
}
```

---

## Schedule

```typescript
// Daily: sync attribution events from connected sources
export const roiDataSync = inngest.createFunction(
  { id: "roi-data-sync" },
  { cron: "0 2 * * *" },
  async ({ step }) => {
    // For each org with analytics connections:
    // Pull GA4 events, Shopify orders, etc. since last sync
    // Match UTM parameters to content IDs
    // Store as AttributionEvents
  }
);

// Weekly: generate ROI analysis report
export const roiAnalysis = inngest.createFunction(
  { id: "roi-analysis" },
  { cron: "0 9 * * 1" },
  async ({ step }) => {
    // Aggregate attribution events
    // Run LLM analysis for insights and recommendations
    // Feed to Reporting Narrator for client-ready report
  }
);
```

---

## Integration

```
ROI Attribution Agent
├── toplineMetrics → Reporting Narrator (include ROI in weekly/monthly reports)
├── platformAttribution → Strategy Agent (allocate effort to highest-ROI platforms)
├── contentAttribution → Content Creator (create more of what converts)
├── contentAttribution → A/B Testing (test variations of top converters)
├── funnelAnalysis → Ad Copy Agent (target ads at funnel bottlenecks)
└── insights → Churn Prediction (strong ROI = low churn risk)
```
