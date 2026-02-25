---
name: hashtag-optimizer
description: "Analyzes hashtag performance per platform/niche/post-type. Builds ranked hashtag sets (discovery, niche, branded). Tests new hashtags, retires dead ones. Learns and evolves per client."
---

# SKILL: Hashtag Optimizer Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Replaces guesswork hashtag strategies with data-driven hashtag management. Maintains per-client hashtag libraries organized by category and performance tier. Continuously tests new hashtags, tracks reach/engagement contribution per hashtag, and retires underperformers. Each client gets an evolving, optimized hashtag strategy tailored to their niche and audience.

---

## File Location

```
agents/hashtag-optimizer.ts
lib/ai/prompts/hashtag-optimizer.ts
lib/ai/schemas/hashtag-optimizer.ts
inngest/functions/hashtag-analysis.ts
```

---

## Hashtag Categories

| Category | Purpose | Example |
|----------|---------|---------|
| Discovery | High-volume, broad reach, attracts new followers | #SmallBusiness, #FoodPorn |
| Niche | Medium-volume, targeted to specific community | #VeganBakingTips, #SaaSFounders |
| Branded | Client-specific, builds brand recognition | #MadeByBrandName, #BrandNameCommunity |
| Trending | Temporary, ride current trends | #Veganuary, #SuperBowlSnacks |
| Competitor | Used by competitors' audiences | Discovered via Competitor Intelligence |
| Banned/Shadowban | Known to trigger platform penalties | Auto-detected and blacklisted |

---

## Output Schema

```typescript
const HashtagAnalysisSchema = z.object({
  platformAnalysis: z.record(z.string(), z.object({
    optimalCount: z.number()
      .describe("Best number of hashtags for this platform based on performance data"),
    topPerformers: z.array(z.object({
      hashtag: z.string(),
      category: z.enum(["discovery", "niche", "branded", "trending", "competitor"]),
      avgReachContribution: z.number(),
      avgEngagementRate: z.number(),
      timesUsed: z.number(),
      trend: z.enum(["rising", "stable", "declining", "new"]),
    })).max(20),
    underperformers: z.array(z.object({
      hashtag: z.string(),
      reason: z.string(),
      recommendation: z.enum(["retire", "reduce_frequency", "test_different_content_type"]),
    })),
    newToTest: z.array(z.object({
      hashtag: z.string(),
      category: z.string(),
      estimatedVolume: z.string(),
      rationale: z.string(),
    })).max(10),
    bannedDetected: z.array(z.object({
      hashtag: z.string(),
      platform: z.string(),
      reason: z.string(),
    })),
  })),

  recommendedSets: z.array(z.object({
    name: z.string().describe("'Product Launch Mix', 'Educational Content', 'Behind The Scenes'"),
    platform: z.string(),
    contentType: z.string(),
    hashtags: z.array(z.string()),
    mix: z.object({
      discovery: z.number(),
      niche: z.number(),
      branded: z.number(),
    }).describe("Count of each category in this set"),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model HashtagLibrary {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  platform        Platform
  hashtag         String
  category        String   // "discovery", "niche", "branded", "trending", "competitor"
  status          String   @default("active") // "active", "testing", "retired", "banned"
  timesUsed       Int      @default(0)
  avgReach        Float?
  avgEngagement   Float?
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, platform, hashtag])
  @@index([organizationId, platform, status])
}

model HashtagSet {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name            String
  platform        Platform
  contentType     String?
  hashtags        String[]
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, platform, name])
}
```

---

## Schedule

```typescript
// Weekly: analyze hashtag performance and update library
export const hashtagAnalysis = inngest.createFunction(
  { id: "hashtag-analysis" },
  { cron: "0 5 * * 2" },  // Tuesday 5am
  async ({ step }) => {
    // 1. Pull engagement data for all posts from last 7 days
    // 2. Correlate hashtags with reach/engagement per post
    // 3. Update HashtagLibrary stats
    // 4. Run LLM to discover new hashtags to test
    // 5. Flag underperformers for retirement
    // 6. Update recommended HashtagSets
  }
);

// On-demand: Content Creator requests hashtags for a specific post
// This is a synchronous call, not a cron job
```

---

## Integration

```
Hashtag Optimizer Agent
├── recommendedSets → Content Creator (attach optimal hashtags per post)
├── bannedDetected → Compliance Agent (add to safety blocklist)
├── topPerformers → Analytics Agent (include in reports)
├── competitorHashtags ← Competitor Intelligence Agent (discover what competitors use)
└── trendingHashtags ← Trend Scout Agent (inject trending hashtags)
```

---

## Content Creator Integration

When Content Creator generates a post, it calls Hashtag Optimizer synchronously:

```typescript
// Inside ContentCreatorAgent.execute():
const hashtagSets = await prisma.hashtagSet.findMany({
  where: { organizationId, platform, contentType },
});

// Include in system prompt:
// "Use these hashtag sets optimized for this content type: ${JSON.stringify(hashtagSets)}"
// "Do NOT use any hashtags from the banned list: ${bannedHashtags}"
```
