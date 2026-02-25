---
name: inter-client-learning
description: "Anonymized, aggregated pattern learning across similar clients. If carousels outperform for ALL skincare brands, new skincare clients know that from day one. Network effect — the platform gets smarter with every client added."
---

# SKILL: Inter-Client Learning

> This is a SYSTEM skill — platform-level intelligence, not per-client.
> **Prerequisite**: Read `shared-memory`, `content-dna`, and `self-evaluation` skills first.

---

## Purpose

Right now, each client's AI learns in isolation. Client A discovers that carousel posts about ingredients outperform everything else after 3 months of trial and error. Client B, also a skincare brand, has to learn the same thing from scratch.

Inter-Client Learning aggregates anonymized performance patterns across all clients in similar industries. When a pattern appears across multiple clients (not just one), it becomes a "platform insight" that all similar clients benefit from. New clients get a warm start instead of a cold start.

This is the network effect that makes the platform exponentially more valuable with every client added. It's also the moat that no single-client tool can replicate.

---

## File Location

```
lib/network-intelligence/aggregator.ts
lib/network-intelligence/insights.ts
lib/network-intelligence/warm-start.ts
lib/network-intelligence/privacy.ts
```

---

## Privacy Architecture

**Absolute rule: no client ever sees another client's data. Period.**

```typescript
// lib/network-intelligence/privacy.ts

// What IS shared (anonymized, aggregated):
// ✅ "Carousel posts get 3.2x more engagement than static posts for skincare brands"
// ✅ "Question hooks outperform statement hooks for DTC brands"
// ✅ "Tuesday 9am is the best posting time for wellness brands on Instagram"
// ✅ "Hashtags with <50K volume outperform mega hashtags for small accounts"

// What is NEVER shared:
// ❌ Client names, handles, URLs
// ❌ Actual post captions, images, or content
// ❌ Specific engagement numbers or follower counts
// ❌ Individual client strategies
// ❌ Brand voice profiles, assets, or competitors
// ❌ Human feedback or corrections
// ❌ Any PII whatsoever

// Minimum aggregation threshold: insights require data from 5+ clients
const MIN_CLIENTS_FOR_INSIGHT = 5;
```

---

## Industry Classification

```typescript
// Clients are classified into industries during onboarding
// This determines which pool of aggregated data they benefit from

const INDUSTRY_TAXONOMY = {
  "beauty_skincare": { parent: "beauty", keywords: ["skincare", "beauty", "cosmetics", "serum", "moisturizer"] },
  "beauty_haircare": { parent: "beauty", keywords: ["haircare", "hair", "shampoo", "styling"] },
  "beauty_makeup": { parent: "beauty", keywords: ["makeup", "cosmetics", "foundation", "lipstick"] },
  "food_restaurant": { parent: "food", keywords: ["restaurant", "dining", "chef", "menu"] },
  "food_cpg": { parent: "food", keywords: ["food brand", "snacks", "organic food", "beverages"] },
  "fitness": { parent: "health", keywords: ["fitness", "gym", "workout", "training"] },
  "wellness": { parent: "health", keywords: ["wellness", "meditation", "supplements", "holistic"] },
  "saas": { parent: "technology", keywords: ["software", "saas", "app", "platform", "tool"] },
  "ecommerce_fashion": { parent: "ecommerce", keywords: ["fashion", "clothing", "apparel", "accessories"] },
  "ecommerce_home": { parent: "ecommerce", keywords: ["home decor", "furniture", "home goods"] },
  "real_estate": { parent: "services", keywords: ["real estate", "realtor", "property", "homes"] },
  "professional_services": { parent: "services", keywords: ["consulting", "agency", "accounting", "legal"] },
  "creator_influencer": { parent: "creator", keywords: ["influencer", "creator", "content creator"] },
  // ... expand as client base grows
};
```

---

## Aggregation Pipeline

```typescript
// Runs monthly (needs volume to be meaningful)
// Orchestrator triggers: only runs if platform has 50+ active clients

async function aggregateIndustryInsights(): Promise<void> {
  // 1. Group clients by industry
  const industries = await groupClientsByIndustry();

  for (const [industry, clients] of Object.entries(industries)) {
    if (clients.length < MIN_CLIENTS_FOR_INSIGHT) continue;

    // 2. Pull anonymized Content DNA fingerprints across all clients
    const allFingerprints = await getAnonymizedFingerprints(clients);

    // 3. Find patterns that hold across 5+ clients
    const patterns = findCrossClientPatterns(allFingerprints);

    // 4. Validate patterns (must be statistically significant)
    const validatedPatterns = validatePatterns(patterns);

    // 5. Store as platform insights
    for (const pattern of validatedPatterns) {
      await prisma.platformInsight.upsert({
        where: { industry_pattern_key: { industry, patternKey: pattern.key } },
        update: {
          pattern: pattern.description,
          evidence: pattern.evidence,
          clientCount: pattern.clientCount,
          confidence: pattern.confidence,
          updatedAt: new Date(),
        },
        create: {
          industry,
          patternKey: pattern.key,
          pattern: pattern.description,
          evidence: pattern.evidence,
          clientCount: pattern.clientCount,
          confidence: pattern.confidence,
          platform: pattern.platform,
          category: pattern.category,
        },
      });
    }
  }
}
```

---

## Platform Insights (What Gets Learned)

```typescript
interface PlatformInsight {
  id: string;
  industry: string;
  platform: string;
  category: string;         // "content_type", "hook", "timing", "hashtags", "visual", "format"
  patternKey: string;        // Unique identifier for deduplication
  pattern: string;           // Human-readable description
  evidence: {
    clientCount: number;     // How many clients this applies to
    avgLift: number;         // Average performance improvement
    consistency: number;     // How consistent across clients (0-1)
  };
  confidence: number;        // 0-1
  expiresAt?: Date;          // Some patterns are seasonal
}

// Example insights that might emerge:
const exampleInsights: PlatformInsight[] = [
  {
    industry: "beauty_skincare",
    platform: "instagram",
    category: "content_type",
    pattern: "Carousel posts about ingredient education get 3.2x higher engagement than single-image product shots",
    evidence: { clientCount: 12, avgLift: 3.2, consistency: 0.85 },
    confidence: 0.92,
  },
  {
    industry: "beauty_skincare",
    platform: "instagram",
    category: "hook",
    pattern: "Hooks starting with a number ('5 ingredients...', '3 signs...') outperform question hooks by 40%",
    evidence: { clientCount: 8, avgLift: 1.4, consistency: 0.78 },
    confidence: 0.84,
  },
  {
    industry: "saas",
    platform: "linkedin",
    category: "format",
    pattern: "Personal story posts from founder accounts get 5x more engagement than company page posts",
    evidence: { clientCount: 15, avgLift: 5.1, consistency: 0.91 },
    confidence: 0.95,
  },
  {
    industry: "food_restaurant",
    platform: "instagram",
    category: "timing",
    pattern: "Posts between 11am-1pm (lunch time) get 2.1x more saves than evening posts",
    evidence: { clientCount: 9, avgLift: 2.1, consistency: 0.82 },
    confidence: 0.87,
  },
  {
    industry: "ecommerce_fashion",
    platform: "tiktok",
    category: "visual",
    pattern: "User-try-on style videos outperform flat-lay product shots by 4.7x",
    evidence: { clientCount: 7, avgLift: 4.7, consistency: 0.88 },
    confidence: 0.90,
  },
];
```

---

## Warm Start for New Clients

When a new client onboards, the Onboarding Intelligence Agent pulls platform insights for their industry:

```typescript
// lib/network-intelligence/warm-start.ts

async function getWarmStartInsights(industry: string, platforms: string[]): Promise<PlatformInsight[]> {
  // Pull high-confidence insights for this industry
  const insights = await prisma.platformInsight.findMany({
    where: {
      industry,
      platform: { in: platforms },
      confidence: { gte: 0.75 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [
      { confidence: "desc" },
      { evidence: { path: ["clientCount"], sort: "desc" } },
    ],
    take: 20,
  });

  // Also pull parent industry insights (e.g., "beauty" for "beauty_skincare")
  const parentIndustry = INDUSTRY_TAXONOMY[industry]?.parent;
  if (parentIndustry) {
    const parentInsights = await prisma.platformInsight.findMany({
      where: {
        industry: parentIndustry,
        platform: { in: platforms },
        confidence: { gte: 0.85 }, // Higher threshold for parent category
      },
      take: 10,
    });
    insights.push(...parentInsights);
  }

  return insights;
}
```

Injected into the Content Creator's very first prompt for a new client:

```
INDUSTRY INTELLIGENCE (learned from similar brands in your industry):

1. Carousel posts about ingredient education significantly outperform single-image
   product shots (learned from 12 similar brands, 92% confidence)

2. Hooks starting with numbers outperform question hooks by ~40%
   (learned from 8 similar brands, 84% confidence)

3. Posts between 11am-1pm get more saves than evening posts
   (learned from 9 similar brands, 87% confidence)

Use these insights to inform your content creation. As we learn more about THIS
specific client's audience, their unique patterns will override these defaults.
```

---

## Database

```prisma
model PlatformInsight {
  id              String   @id @default(uuid())
  industry        String
  platform        String
  category        String
  patternKey      String
  pattern         String   @db.Text
  evidence        Json
  confidence      Float
  clientCount     Int
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([industry, patternKey])
  @@index([industry, platform, confidence])
}
```

---

## Insight Lifecycle

```
OBSERVATION
  Multiple clients show the same pattern independently
    ↓
VALIDATION
  Pattern appears in 5+ clients with >0.75 confidence
    ↓
PLATFORM INSIGHT
  Stored in PlatformInsight table
    ↓
DISTRIBUTION
  Applied to all clients in that industry (including new ones)
    ↓
DECAY
  If pattern stops holding (clients evolve), confidence decays
  Below 0.5 confidence → archived
    ↓
SEASONAL REFRESH
  Some patterns are seasonal → tagged with expiration
  Re-evaluated each cycle
```

---

## Confidence Decay

```typescript
// If an insight stops being true, its confidence decays

async function decayInsights(): Promise<void> {
  // For each insight: check if recent data still supports it
  const insights = await prisma.platformInsight.findMany({
    where: { confidence: { gt: 0.3 } },
  });

  for (const insight of insights) {
    const recentEvidence = await checkRecentEvidence(insight);

    if (recentEvidence.stillHolds) {
      // Reinforce: bump confidence slightly
      await prisma.platformInsight.update({
        where: { id: insight.id },
        data: { confidence: Math.min(insight.confidence + 0.02, 0.99) },
      });
    } else {
      // Decay: reduce confidence
      await prisma.platformInsight.update({
        where: { id: insight.id },
        data: { confidence: insight.confidence * 0.9 },
      });
    }
  }

  // Archive insights below threshold
  await prisma.platformInsight.deleteMany({
    where: { confidence: { lt: 0.3 } },
  });
}
```

---

## Network Effect Math

```
10 clients    → 0 cross-client patterns (not enough data)
50 clients    → ~15 validated patterns per industry
200 clients   → ~60 patterns, new clients get instant intelligence
1000 clients  → comprehensive industry playbooks, updated weekly

Every new client makes the platform smarter for ALL clients.
Every client leaving loses access to this collective intelligence.
This cannot be replicated by any single-client tool.
```

---

## Rules

1. **Privacy is non-negotiable.** No client data is ever exposed to another client. Insights are aggregated and anonymized.
2. **Minimum 5 clients per insight.** No pattern from 2-3 clients is trustworthy enough to generalize.
3. **Confidence scoring is honest.** Don't present a 0.6 confidence insight as fact. Present it as "emerging pattern."
4. **Client-specific data always overrides.** If a platform insight says "carousels win" but THIS client's carousels underperform, ignore the platform insight for them.
5. **Seasonal awareness.** Holiday patterns, summer patterns, back-to-school patterns — tag insights with seasonality so they don't pollute year-round recommendations.
6. **Decay stale insights.** Social media changes fast. An insight from 6 months ago may not hold today. Continuous validation required.
7. **Never mention other clients.** The AI says "brands in your industry tend to see..." not "our other clients have found..."
8. **Opt-out option.** Clients can opt out of contributing to anonymized learning. They still benefit from existing insights, but their data doesn't feed the pool.
