---
name: strategy
description: "Strategy planning agent: monthly content plan generation, weekly calendar schema, platform mix allocation, human review rules per client type."
---

# SKILL: Strategy Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Generates and maintains the content strategy and content calendar for each client. Produces a monthly content plan that guides the Content Creator Agent on what to post, when, and on which platforms. Reviews and adapts strategy based on Analytics Agent feedback.

Runs monthly for new plans, and ad-hoc when triggered by significant analytics insights or trend opportunities.

---

## File Location

```
agents/strategy.ts
lib/ai/prompts/strategy.ts
lib/ai/schemas/strategy.ts
inngest/functions/strategy-planner.ts
```

---

## Input Interface

```typescript
interface StrategyInput {
  organizationId: string;
  brandConfig: BrandConfig;         // Full brand profile
  analyticsReport?: {               // Latest from Analytics Agent
    summary: string;
    topContent: Array<{ contentId: string; whyItWorked: string }>;
    recommendations: Array<{ recommendation: string; priority: string; targetAgent: string }>;
    optimalPostingTimes: Record<string, string[]>;
  };
  previousPlan?: {                  // Last month's plan (for continuity)
    themes: string[];
    platformMix: Record<string, number>;
    whatWorked: string;
    whatDidnt: string;
  };
  trendContext?: string;            // From Trend Scout
  connectedPlatforms: Platform[];   // Which platforms the client has
  planPeriod: {
    start: Date;
    end: Date;
  };
  clientGoals?: string[];           // e.g. ["increase followers", "drive website traffic"]
}
```

---

## Output Schema

```typescript
const StrategyPlanSchema = z.object({
  title: z.string(),
  overview: z.string()
    .describe("2-3 paragraph summary of the strategy for this period"),
  themes: z.array(z.object({
    theme: z.string(),
    description: z.string(),
    platforms: z.array(z.string()),
    frequency: z.string(),           // "2x per week", "daily", etc.
    contentTypes: z.array(z.string()),
    exampleTopics: z.array(z.string()).min(3),
  })).min(3).max(8),
  platformMix: z.record(z.string(), z.number())
    .describe("Percentage allocation per platform, must sum to 100"),
  postsPerWeek: z.record(z.string(), z.number())
    .describe("Target posts per week per platform"),
  contentTypeDistribution: z.record(z.string(), z.number())
    .describe("Percentage of each content type: POST, REEL, CAROUSEL, STORY, THREAD"),
  weeklyCalendar: z.array(z.object({
    weekNumber: z.number(),
    focus: z.string(),
    posts: z.array(z.object({
      dayOfWeek: z.string(),
      platform: z.string(),
      contentType: z.string(),
      theme: z.string(),
      topicSuggestion: z.string(),
      optimalTime: z.string(),
    })),
  })),
  keyDates: z.array(z.object({
    date: z.string(),
    event: z.string(),
    contentIdea: z.string(),
  })).describe("Holidays, industry events, awareness days to leverage"),
  kpis: z.array(z.object({
    metric: z.string(),
    target: z.string(),
    currentBaseline: z.string().optional(),
  })),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
});
```

---

## Execution

```
Strategy Agent runs:
1. Monthly via cron (1st of each month at 6am)
2. On-demand when Analytics Agent flags a significant performance shift
3. On-demand during onboarding (generates first plan)

Output stored in: content_plans table
Status flow: DRAFT → (human reviews for managed clients) → ACTIVE → COMPLETED
For SaaS clients: auto-activate (confidence ≥ 0.80)
For managed clients: always queue for human review in QBR
```

---

## Strategy-to-Content Pipeline

The Content Creator Agent reads the active content plan to know what to create:

```typescript
// How Content Creator consumes the strategy
const activePlan = await prisma.contentPlan.findFirst({
  where: { organizationId, status: "ACTIVE" },
  orderBy: { periodStart: "desc" },
});

// Find this week's entries in the plan
const currentWeek = getWeekNumber(new Date(), activePlan.periodStart);
const weekPlan = activePlan.strategy.weeklyCalendar
  .find(w => w.weekNumber === currentWeek);

// Pass to Content Creator
const todaysPosts = weekPlan.posts
  .filter(p => p.dayOfWeek === getDayName(new Date()));
```

---

## Human Review

| Client Type | Review Process |
|-------------|---------------|
| SaaS (self-serve) | Auto-activated if confidence ≥ 0.80. Visible in dashboard for optional review. |
| Managed (done-for-you) | Always queued for human review. Discussed in quarterly business review (QBR). |

---

## Schedule

```typescript
export const monthlyStrategyPlanner = inngest.createFunction(
  { id: "monthly-strategy-planner" },
  { cron: "0 6 1 * *" },  // 1st of each month at 6am UTC
  async ({ step }) => {
    // 1. Get all active orgs
    // 2. Get latest analytics report for each
    // 3. Get previous plan for each
    // 4. Run Strategy Agent
    // 5. Store new plan
    // 6. Mark previous plan as COMPLETED
    // 7. Auto-activate for SaaS clients above threshold
    // 8. Queue for review for managed clients
  }
);
```
