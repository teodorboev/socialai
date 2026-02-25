---
name: ad-copy
description: "Generates paid social ad variations from high-performing organic content. Creates headline/body/CTA combinations for A/B testing. Suggests audience targeting from Audience Intelligence data. Bridges organic and paid."
---

# SKILL: Ad Copy Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Bridges the gap between organic and paid social. Takes content that's proven to resonate organically and transforms it into paid ad creative with proper ad copy structure (headline, body, CTA, etc.). Generates multiple variations for A/B testing within ad platforms. Suggests audience targeting based on Audience Intelligence data.

---

## File Location

```
agents/ad-copy.ts
lib/ai/prompts/ad-copy.ts
lib/ai/schemas/ad-copy.ts
inngest/functions/ad-copy-pipeline.ts
```

---

## Trigger Modes

1. **Auto-trigger**: Analytics detects organic content in top 10% → suggest promoting it with ad variations
2. **Manual trigger**: User clicks "Create Ad" on any content item
3. **Campaign mode**: Strategy Agent plans a campaign → Ad Copy generates ad sets

---

## Output Schema

```typescript
const AdCopyOutputSchema = z.object({
  sourceContentId: z.string(),
  adPlatform: z.enum(["meta_ads", "tiktok_ads", "linkedin_ads", "twitter_ads"]),
  adObjective: z.enum([
    "awareness",
    "traffic",
    "engagement",
    "leads",
    "conversions",
    "app_installs",
  ]),

  variations: z.array(z.object({
    variationId: z.string(),
    headline: z.string(),
    body: z.string(),
    cta: z.enum([
      "Learn More", "Shop Now", "Sign Up", "Book Now", "Contact Us",
      "Download", "Get Offer", "Subscribe", "Watch More", "Apply Now",
    ]),
    description: z.string().optional(),
    displayUrl: z.string().optional(),

    adFormat: z.enum([
      "single_image", "single_video", "carousel",
      "collection", "stories", "reels",
    ]),

    copyStrategy: z.string()
      .describe("What angle this variation takes: problem-solution, testimonial, urgency, benefit-led"),

    platformSpecific: z.record(z.string(), z.any())
      .describe("Platform-specific fields: Meta primary_text, TikTok spark_ad settings, etc."),
  })).min(3).max(6),

  audienceTargeting: z.object({
    suggestedAudiences: z.array(z.object({
      name: z.string(),
      description: z.string(),
      interests: z.array(z.string()),
      demographics: z.object({
        ageMin: z.number(),
        ageMax: z.number(),
        gender: z.string(),
        locations: z.array(z.string()),
      }),
      estimatedSize: z.string(),
      reasoning: z.string(),
    })),
    lookalike: z.object({
      sourceAudience: z.string(),
      percentage: z.number(),
      reasoning: z.string(),
    }).optional(),
    retargeting: z.object({
      audience: z.string(),
      reasoning: z.string(),
    }).optional(),
  }),

  budgetSuggestion: z.object({
    dailyBudget: z.object({ min: z.number(), recommended: z.number(), max: z.number() }),
    duration: z.number().describe("Recommended campaign duration in days"),
    reasoning: z.string(),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Ad Platform Specs (from DB — PlatformConfig or AdPlatformConfig)

| Platform | Headline | Body | Image | Aspect Ratios |
|----------|----------|------|-------|---------------|
| Meta (FB/IG) | 40 chars | 125 chars primary text | 1080x1080, 1080x1920 | 1:1, 9:16, 4:5 |
| TikTok | 100 chars | 100 chars | 1080x1920 | 9:16 |
| LinkedIn | 70 chars | 150 chars intro text | 1200x627, 1080x1080 | 1.91:1, 1:1 |
| Twitter/X | — | 280 chars | 1200x628, 1080x1080 | 16:9, 1:1 |

---

## Database

```prisma
model AdCopySet {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sourceContentId String?
  adPlatform      String
  adObjective     String
  variations      Json     // Array of ad variations
  audienceTargeting Json
  budgetSuggestion Json?
  status          String   @default("draft") // draft → approved → active → completed
  campaignId      String?  // External campaign ID from ad platform
  performanceData Json?    // Synced from ad platform
  confidenceScore Float
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, status])
}
```

---

## Rules

1. **Ad copy ≠ organic copy.** Ads need hooks, benefits, urgency, and clear CTAs. Don't just repost the organic caption.
2. **Minimum 3 variations per ad set.** Different headlines, different angles — so the ad platform can optimize.
3. **Respect platform character limits strictly.** Truncated ads look unprofessional.
4. **Compliance Agent checks ad copy too.** FTC disclosures, claims, etc. apply to paid content.
5. **Track performance if ad platform API allows.** Feed results back for learning.
6. **Always human-approved.** Ad spend = real money. Never auto-launch campaigns.
