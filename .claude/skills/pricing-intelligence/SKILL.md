---
name: pricing-intelligence
description: "For e-commerce clients: monitors competitor pricing on social, tracks promotional patterns, suggests optimal timing for promotional content. Knows when competitors are running sales and recommends counter-positioning."
---

# SKILL: Dynamic Pricing Intelligence Agent

> **Prerequisite**: Read `base-agent` and `competitor-intelligence` skills first.

---

## Purpose

For e-commerce and retail clients: monitors competitor pricing and promotional activity visible on social media (ads, posts, stories mentioning prices or sales). Tracks promotional patterns (when competitors typically run sales), identifies pricing opportunities, and recommends optimal timing for the client's own promotional content. Prevents the client from launching a sale when a competitor is already dominating the discount conversation.

---

## File Location

```
agents/pricing-intelligence.ts
lib/ai/prompts/pricing-intelligence.ts
lib/ai/schemas/pricing-intelligence.ts
inngest/functions/pricing-scan.ts
```

---

## Data Sources

| Source | What It Captures |
|--------|-----------------|
| Meta Ad Library | Competitor ads mentioning prices, discounts, offers |
| Competitor social posts | Posts mentioning sales, new prices, limited-time offers |
| TikTok Creative Center | Competitor ad creative with pricing |
| Google Shopping | Current competitor pricing for comparable products |
| Client's own sales data | Historical promotion performance |

---

## Output Schema

```typescript
const PricingIntelSchema = z.object({
  competitorPromotions: z.array(z.object({
    competitor: z.string(),
    promotionType: z.enum(["percentage_off", "flat_discount", "bogo", "free_shipping", "bundle", "flash_sale", "clearance"]),
    discountAmount: z.string(),
    platforms: z.array(z.string()),
    startDate: z.string().optional(),
    estimatedEndDate: z.string().optional(),
    adSpendEstimate: z.enum(["low", "medium", "high"]).optional(),
    targetProducts: z.array(z.string()),
    urgencyLevel: z.enum(["routine", "aggressive", "major_event"]),
  })),

  promotionCalendarPatterns: z.array(z.object({
    competitor: z.string(),
    pattern: z.string().describe("'Runs 20% off every last weekend of the month'"),
    nextPredictedPromotion: z.string().optional(),
    confidence: z.number().min(0).max(1),
  })),

  recommendations: z.array(z.object({
    action: z.enum([
      "launch_counter_promotion",
      "hold_promotion",
      "differentiate_on_value",
      "launch_before_competitor",
      "bundle_strategy",
      "highlight_non_price_advantage",
    ]),
    reasoning: z.string(),
    timing: z.string(),
    suggestedOffer: z.string().optional(),
    contentAngle: z.string(),
    priority: z.enum(["immediate", "this_week", "plan_ahead"]),
  })),

  pricingOpportunities: z.array(z.object({
    opportunity: z.string(),
    marketContext: z.string(),
    suggestedAction: z.string(),
    estimatedImpact: z.string(),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model CompetitorPromotion {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  competitorName  String
  promotionType   String
  discountAmount  String?
  platforms       String[]
  detectedAt      DateTime @default(now())
  estimatedEnd    DateTime?
  sourceUrl       String?
  adSpendEstimate String?
  isActive        Boolean  @default(true)

  @@index([organizationId, isActive])
  @@index([organizationId, competitorName])
}
```

---

## Schedule

```typescript
// Daily: scan competitor social for pricing/promotion activity
export const pricingScan = inngest.createFunction(
  { id: "pricing-intelligence-scan" },
  { cron: "0 4 * * *" },
  async ({ step }) => {
    // 1. Scan Meta Ad Library for competitor ads with pricing language
    // 2. Check competitor social posts for sale/discount mentions
    // 3. Store new promotions
    // 4. Update active/inactive status of known promotions
  }
);

// Weekly: pattern analysis and recommendations
export const pricingAnalysis = inngest.createFunction(
  { id: "pricing-intelligence-analysis" },
  { cron: "0 7 * * 3" },  // Wednesday
  async ({ step }) => {
    // Run LLM analysis on accumulated data
    // Generate recommendations
    // Feed to Strategy Agent and Content Creator
  }
);
```

---

## Integration

```
Pricing Intelligence Agent
├── recommendations → Strategy Agent (incorporate pricing strategy into content plan)
├── recommendations → Content Creator (create counter-positioning content)
├── recommendations → Ad Copy Agent (time paid promotions around competitor gaps)
├── competitorPromotions → Competitor Intelligence (enrich competitor profiles)
└── pricingOpportunities → Reporting Narrator (include in weekly reports for e-commerce clients)
```
