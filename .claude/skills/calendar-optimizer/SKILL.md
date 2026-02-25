---
name: calendar-optimizer
description: "Optimizes the full content calendar: reorders posts to avoid topic clustering, balances content types, ensures platform coverage, spaces promotional vs value content, adjusts timing from Audience Intelligence."
---

# SKILL: Content Calendar Optimizer Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Looks at the scheduled content calendar as a whole and optimizes it for maximum impact. Individual agents create great posts — this agent ensures the overall mix, sequence, and timing tells a coherent story. Prevents topic fatigue, ensures variety, balances promotional and value content, and makes sure no platform is neglected.

Think of this as the "editor-in-chief" that arranges the published lineup, not the writers who create the pieces.

---

## File Location

```
agents/calendar-optimizer.ts
lib/ai/prompts/calendar-optimizer.ts
lib/ai/schemas/calendar-optimizer.ts
inngest/functions/calendar-optimization.ts
```

---

## What It Optimizes

| Dimension | Problem It Solves |
|-----------|-------------------|
| Topic clustering | 3 posts about the same topic in a row → spread them out |
| Content type balance | All text posts, no carousels or reels → inject variety |
| Platform coverage | 10 Instagram posts, 0 LinkedIn posts → redistribute |
| Promo vs value ratio | Too many sales posts → insert value/educational content |
| Posting frequency | 5 posts Monday, 0 posts Wednesday → level the schedule |
| Timing optimization | Posts at 3am → move to peak engagement windows |
| Seasonal alignment | Missing key dates, holidays → flag gaps |
| Campaign coherence | Campaign posts scattered randomly → cluster them properly |

---

## Output Schema

```typescript
const CalendarOptimizationSchema = z.object({
  analysis: z.object({
    currentScore: z.number().min(0).max(100)
      .describe("Overall calendar health score"),
    issues: z.array(z.object({
      type: z.enum([
        "topic_clustering",
        "type_imbalance",
        "platform_neglected",
        "promo_heavy",
        "frequency_uneven",
        "bad_timing",
        "missing_key_date",
        "campaign_scattered",
      ]),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
      affectedPosts: z.array(z.string()).describe("Content IDs affected"),
    })),
  }),

  recommendations: z.array(z.object({
    action: z.enum([
      "move_post",           // Change scheduled date/time
      "swap_posts",          // Swap two posts' positions
      "suggest_gap_fill",    // Create new content for an empty slot
      "remove_duplicate",    // Flag near-duplicate posts
      "change_platform",     // Post would do better on different platform
      "adjust_ratio",        // Add more value/educational content
      "add_key_date",        // Add content for upcoming holiday/event
    ]),
    contentId: z.string().optional(),
    currentSlot: z.object({ date: z.string(), time: z.string(), platform: z.string() }).optional(),
    suggestedSlot: z.object({ date: z.string(), time: z.string(), platform: z.string() }).optional(),
    reasoning: z.string(),
    priority: z.enum(["should_do", "nice_to_have"]),
    autoApplyable: z.boolean()
      .describe("True if this change can be made automatically without human review"),
  })),

  optimizedScore: z.number().min(0).max(100)
    .describe("Projected score if all recommendations are applied"),

  weeklyMix: z.record(z.string(), z.object({
    postsScheduled: z.number(),
    contentTypeMix: z.record(z.string(), z.number()),
    promoVsValue: z.object({ promotional: z.number(), value: z.number(), entertainment: z.number() }),
    assessment: z.string(),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Schedule

```typescript
// Twice weekly: optimize the upcoming calendar
export const calendarOptimization = inngest.createFunction(
  { id: "calendar-optimization" },
  { cron: "0 7 * * 0,3" },  // Sunday and Wednesday 7am
  async ({ step }) => {
    // 1. Load all scheduled content for next 14 days
    // 2. Load audience optimal windows from Audience Intelligence
    // 3. Load org's content strategy (topics, ratios, platforms)
    // 4. Run CalendarOptimizerAgent
    // 5. Auto-apply low-risk recommendations (time moves, minor reorders)
    // 6. Queue high-impact changes for human review
  }
);

// On-demand: after batch content creation or repurposing
export const calendarOptimizeAfterBatch = inngest.createFunction(
  { id: "calendar-optimize-after-batch" },
  { event: "content/batch-created" },
  async ({ event, step }) => {
    // New batch of content just entered the calendar → optimize placement
  }
);
```

---

## Rules

1. **Never delete content.** Only move, reorder, or flag.
2. **Respect human-pinned posts.** If a user manually scheduled something, don't move it.
3. **Auto-apply only safe changes** (time adjustments within same day, minor reorders). Everything else goes to review.
4. **The 80/20 rule**: Suggest max 80% value/educational, 20% promotional. Configurable per org in DB.
5. **Key dates are mandatory flags.** If the client's industry has a major event coming up and there's no content planned, always flag it.
