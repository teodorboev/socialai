---
name: caption-rewriter
description: "Takes underperforming published content and rewrites with a different hook/angle for a second attempt. Gives every post a second life. Learns which rewrites improve performance."
---

# SKILL: Caption Rewriter Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Most posts fail not because the idea was bad but because the hook missed, the timing was off, or the angle didn't resonate. This agent identifies underperforming content, analyzes why it underperformed, and creates a rewritten version with a different hook, angle, or format — giving it a genuine second chance.

Over time, it builds a pattern library of what rewrite strategies work best per platform and content type.

---

## File Location

```
agents/caption-rewriter.ts
lib/ai/prompts/caption-rewriter.ts
lib/ai/schemas/caption-rewriter.ts
inngest/functions/caption-rewrite-pipeline.ts
```

---

## Trigger Logic

```typescript
// Automatically identifies underperformers from Analytics data
interface RewriteCandidate {
  contentId: string;
  platform: Platform;
  originalCaption: string;
  originalHashtags: string[];
  contentType: string;
  performanceData: {
    impressions: number;
    engagementRate: number;
    avgEngagementRateForOrg: number;   // What's normal for this client
    percentileRank: number;             // Where this post ranks (0-100)
  };
  publishedAt: Date;
  mediaUrl?: string;                    // Same media can be reused
}

// Selection criteria (configurable per org in DB):
// - engagementRate < 50% of org's average
// - OR percentileRank < 25 (bottom quartile)
// - AND published > 7 days ago (give it time to perform)
// - AND not already rewritten
// - AND media is still usable (not time-sensitive)
```

---

## Output Schema

```typescript
const RewriteOutputSchema = z.object({
  analysis: z.object({
    likelyFailureReasons: z.array(z.enum([
      "weak_hook",
      "wrong_timing",
      "mismatched_audience",
      "too_long",
      "too_short",
      "unclear_cta",
      "oversaturated_topic",
      "poor_hashtags",
      "wrong_content_type",
      "low_visual_appeal",
      "bad_first_line",
      "too_promotional",
    ])),
    topReason: z.string(),
    originalStrength: z.string()
      .describe("What WAS good about the original — preserve this"),
  }),

  rewrite: z.object({
    caption: z.string(),
    hashtags: z.array(z.string()),
    hook: z.string().describe("New attention-grabbing first line"),
    rewriteStrategy: z.enum([
      "new_hook",           // Same content, completely different opening
      "different_angle",    // Same topic, different perspective
      "format_change",      // Turn statement into question, list, story
      "shorten",            // Strip to essentials
      "add_story",          // Wrap the message in a narrative
      "add_controversy",    // Make it more provocative/debatable
      "personalize",        // Add personal touch / behind-the-scenes
      "add_value",          // Include a tip, stat, or takeaway
    ]),
    whatChanged: z.string()
      .describe("Human-readable explanation of what was changed and why"),
    suggestedContentType: z.string()
      .describe("If format should change: e.g., original was POST, suggest CAROUSEL"),
    newMediaNeeded: z.boolean()
      .describe("True if the visual should also change"),
    mediaPrompt: z.string().optional(),
  }),

  schedulingSuggestion: z.object({
    bestDay: z.string(),
    bestTime: z.string(),
    reasoning: z.string(),
    waitDays: z.number().describe("Minimum days to wait before republishing"),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are a content optimization specialist for ${brandName}.

A piece of content underperformed. Your job is to figure out WHY and create a 
rewritten version that has a better chance of resonating.

ORIGINAL POST:
Platform: ${platform}
Type: ${contentType}
Caption: "${originalCaption}"
Hashtags: ${hashtags}
Performance: ${engagementRate}% engagement (org average: ${avgRate}%)

RULES:
1. The rewrite must feel like a DIFFERENT post, not a minor edit. If someone saw both, they should not feel like they saw the same thing twice.
2. PRESERVE what was good about the original (the core idea, the value proposition).
3. CHANGE the wrapper: the hook, the structure, the angle, the CTA.
4. NEVER reuse the same opening line.
5. If the content type was wrong for the message (e.g., a long tip as a single image post instead of a carousel), suggest a format change.
6. Consider timing — if the original posted at a bad time, note this.
7. Learn from what DOES work for this client — the top-performing posts inform what to change.

TOP PERFORMING POSTS FOR CONTEXT:
${topPosts.map(p => `- "${p.caption.slice(0, 100)}..." (${p.engagementRate}%)`).join("\n")}
```

---

## Database

```prisma
model ContentRewrite {
  id                String   @id @default(uuid())
  originalContentId String
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  failureReasons    String[]
  rewriteStrategy   String
  newCaption        String   @db.Text
  newHashtags       String[]
  whatChanged        String   @db.Text
  newMediaNeeded    Boolean  @default(false)
  mediaPrompt       String?  @db.Text
  status            String   @default("pending_review") // pending_review → approved → scheduled → published
  newContentId      String?  // Links to the new content record once approved
  performanceComparison Json? // After publish: compare original vs rewrite
  confidenceScore   Float
  createdAt         DateTime @default(now())

  @@index([organizationId, status])
}
```

---

## Schedule

```typescript
// Weekly: find underperformers and generate rewrites
export const captionRewriteScan = inngest.createFunction(
  { id: "caption-rewrite-scan" },
  { cron: "0 6 * * 3" },  // Wednesday 6am
  async ({ step }) => {
    // 1. For each org, find posts from 7-30 days ago in bottom quartile
    // 2. Filter out already-rewritten posts
    // 3. Run CaptionRewriterAgent on each candidate
    // 4. Store rewrites for review
    // 5. Route through confidence pipeline
  }
);
```

---

## Learning Loop

After a rewrite is published and has 7+ days of data:

```typescript
// Compare original vs rewrite performance
const comparison = {
  originalEngagement: originalPost.engagementRate,
  rewriteEngagement: rewritePost.engagementRate,
  improvement: ((rewritePost.engagementRate - originalPost.engagementRate) / originalPost.engagementRate) * 100,
  strategyUsed: rewrite.rewriteStrategy,
};

// Store in ContentRewrite.performanceComparison
// Feed winning strategies back to the agent's prompt context
// Over time: "new_hook strategy has 73% success rate for this client"
```
