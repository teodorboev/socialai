---
name: social-seo
description: "Optimizes content for social search (IG Search, TikTok Search, YouTube, Pinterest SEO). Researches trending queries per platform, optimizes captions with searchable keywords, tracks search rankings. Social search is replacing Google for Gen Z."
---

# SKILL: Social SEO Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Social platforms are becoming search engines. Gen Z uses TikTok and Instagram before Google. This agent optimizes every piece of content for discoverability through platform-native search, ensures alt text is search-optimized, researches trending search queries per platform, and tracks where the client ranks for key terms.

---

## File Location

```
agents/social-seo.ts
lib/ai/prompts/social-seo.ts
lib/ai/schemas/social-seo.ts
inngest/functions/social-seo-research.ts
```

---

## Platform Search Mechanics

| Platform | Search Factors | Optimization Levers |
|----------|---------------|---------------------|
| Instagram | Caption keywords, hashtags, alt text, username, bio | Front-load keywords in caption, searchable alt text, keyword-rich bio |
| TikTok | Caption text, spoken words in video, text overlays, sounds | Keyword-rich captions, trending sounds, text overlay keywords |
| YouTube | Title, description, tags, transcript, engagement | SEO title, keyword-rich description, chapter timestamps |
| Pinterest | Pin title, description, board names, alt text | Long-tail keyword descriptions, SEO board names |
| LinkedIn | Post text, article title, hashtags | Industry keywords in first 2 lines, relevant hashtags |

---

## Output Schema

```typescript
const SocialSEOSchema = z.object({
  keywordResearch: z.object({
    primaryKeywords: z.array(z.object({
      keyword: z.string(),
      platform: z.string(),
      searchVolume: z.enum(["high", "medium", "low"]),
      competition: z.enum(["high", "medium", "low"]),
      trending: z.boolean(),
      relevanceScore: z.number().min(0).max(1),
    })),
    longTailKeywords: z.array(z.object({
      keyword: z.string(),
      parentKeyword: z.string(),
      platform: z.string(),
      opportunity: z.enum(["high", "medium", "low"]),
    })),
    emergingQueries: z.array(z.object({
      query: z.string(),
      platform: z.string(),
      growthRate: z.string(),
      contentGap: z.boolean().describe("True if few results exist for this query"),
    })),
  }),

  contentOptimization: z.object({
    contentId: z.string().optional(),
    originalCaption: z.string().optional(),
    optimizedCaption: z.string(),
    keywordsInserted: z.array(z.string()),
    altText: z.string()
      .describe("Search-optimized alt text — descriptive AND keyword-rich"),
    suggestedTitle: z.string().optional()
      .describe("For YouTube/Pinterest where titles matter"),
    seoScore: z.number().min(0).max(100),
    improvements: z.array(z.object({
      change: z.string(),
      reason: z.string(),
    })),
  }),

  rankingTracker: z.array(z.object({
    keyword: z.string(),
    platform: z.string(),
    currentPosition: z.number().nullable(),
    previousPosition: z.number().nullable(),
    change: z.enum(["improved", "stable", "declined", "new", "not_ranking"]),
    topCompetitorContent: z.string().optional(),
  })).optional(),

  contentSuggestions: z.array(z.object({
    searchQuery: z.string(),
    platform: z.string(),
    suggestedContentType: z.string(),
    suggestedAngle: z.string(),
    estimatedSearchVolume: z.string(),
    reasoning: z.string(),
  })).describe("Content ideas based on search gaps"),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model SocialSEOKeyword {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  keyword         String
  platform        Platform
  searchVolume    String
  competition     String
  isTracked       Boolean  @default(false)
  currentRank     Int?
  previousRank    Int?
  lastCheckedAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, platform, keyword])
  @@index([organizationId, isTracked])
}
```

---

## Schedule

```typescript
// Weekly: research trending search queries per platform
export const seoResearch = inngest.createFunction(
  { id: "social-seo-research" },
  { cron: "0 5 * * 2" },  // Tuesday 5am
  async ({ step }) => {
    // 1. For each org: pull industry keywords
    // 2. Research trending queries per platform (Google Trends, platform explore pages)
    // 3. Identify content gaps
    // 4. Update keyword library
    // 5. Feed content suggestions to Strategy Agent
  }
);

// On content creation: optimize for SEO
// Called synchronously in the content pipeline
```

---

## Integration

```
Social SEO Agent
├── optimizedCaption → Content Creator (apply SEO improvements)
├── altText → Visual Agent (ensure images have search-optimized alt text)
├── contentSuggestions → Strategy Agent (SEO-driven content ideas)
├── keywordResearch → Hashtag Optimizer (align hashtags with search terms)
├── rankingTracker → Analytics / Reporting Narrator
└── emergingQueries → Trend Scout (cross-reference with trending topics)
```
