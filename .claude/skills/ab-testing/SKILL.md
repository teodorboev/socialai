---
name: ab-testing
description: "A/B testing agent: experiment design and evaluation, statistical methods (Fisher/Mann-Whitney), experiment types, playbook storage and updates."
---

# SKILL: A/B Testing Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Designs, manages, and evaluates content experiments. Creates controlled variants (caption, hashtags, content type, posting time, visual style) to systematically improve performance. Feeds winning patterns back into the Content Creator and Strategy agents.

---

## File Location

```
agents/ab-testing.ts
lib/ai/schemas/ab-testing.ts
inngest/functions/ab-test-evaluate.ts
```

---

## How It Works

```
1. Strategy Agent or Analytics Agent flags an area for optimization
   Example: "Instagram carousel posts vs single image — which gets more saves?"

2. A/B Testing Agent designs the experiment:
   - Control: Current approach (single image post)
   - Variant: Alternative (carousel post)
   - Sample size: 10 posts each over 2 weeks
   - Success metric: Save rate

3. Content Creator generates both variants when creating content
   - Tags each with ab_test_group: "exp_carousel_vs_single_control" / "exp_carousel_vs_single_variant"

4. Publisher posts both variants on similar days/times

5. After the test period, A/B Testing Agent evaluates:
   - Statistical significance (Fisher's exact test or chi-squared for small samples)
   - Declares winner or inconclusive
   - Updates the playbook for Content Creator / Strategy
```

---

## Output Schema

### Experiment Design

```typescript
const ExperimentDesignSchema = z.object({
  experimentId: z.string(),
  hypothesis: z.string()
    .describe("Clear hypothesis: 'Carousel posts will generate 2x more saves than single images'"),
  variable: z.string()
    .describe("What's being tested: content_type, caption_length, hashtag_count, posting_time, visual_style"),
  control: z.object({
    description: z.string(),
    parameters: z.record(z.string(), z.any()),
  }),
  variant: z.object({
    description: z.string(),
    parameters: z.record(z.string(), z.any()),
  }),
  successMetric: z.enum([
    "engagement_rate", "impressions", "reach", "saves",
    "shares", "clicks", "comments", "follower_growth"
  ]),
  sampleSize: z.number().min(5).max(50),
  durationDays: z.number().min(7).max(30),
  platform: z.string(),
  confidenceScore: z.number().min(0).max(1),
});
```

### Experiment Evaluation

```typescript
const ExperimentResultSchema = z.object({
  experimentId: z.string(),
  status: z.enum(["winner_control", "winner_variant", "inconclusive", "insufficient_data"]),
  controlMetric: z.number(),
  variantMetric: z.number(),
  improvement: z.number().describe("Percentage improvement of variant over control"),
  statisticalSignificance: z.number().describe("p-value"),
  isSignificant: z.boolean().describe("p < 0.05"),
  recommendation: z.string()
    .describe("What to do: adopt variant, keep control, run longer, test different variable"),
  playBookUpdate: z.string()
    .describe("Specific instruction to add to Content Creator's knowledge for this org"),
  confidenceScore: z.number().min(0).max(1),
});
```

---

## Experiment Types to Run

| Variable | Control | Variant | Metric | Min Sample |
|----------|---------|---------|--------|------------|
| Content type | Single image | Carousel | Saves, engagement | 10 each |
| Caption length | Short (<100 chars) | Long (>500 chars) | Engagement rate | 10 each |
| Hashtag count | 3-5 hashtags | 15-20 hashtags | Reach | 10 each |
| CTA style | Question CTA | Command CTA | Comments | 10 each |
| Posting time | Morning (9am) | Evening (7pm) | Impressions | 10 each |
| Visual style | Photo-realistic | Graphic/illustration | Engagement | 10 each |
| Hook style | Question hook | Bold statement hook | Profile visits | 10 each |

---

## Scheduling

```typescript
// Design new experiments: monthly
export const designExperiments = inngest.createFunction(
  { id: "ab-test-design" },
  { cron: "0 8 1 * *" },  // 1st of month
  async ({ step }) => { /* Design 1-2 experiments per org based on analytics gaps */ }
);

// Evaluate running experiments: weekly
export const evaluateExperiments = inngest.createFunction(
  { id: "ab-test-evaluate" },
  { cron: "0 10 * * 1" },  // Monday 10am
  async ({ step }) => {
    // 1. Find experiments past their duration
    // 2. Gather performance data for control + variant groups
    // 3. Run statistical test
    // 4. Declare results
    // 5. Update org's content playbook with learnings
  }
);
```

---

## Statistical Rigor

For small sample sizes typical in social media (5-50 per group):
- Use **Fisher's exact test** for binary outcomes (engaged / didn't engage)
- Use **Mann-Whitney U test** for continuous metrics (engagement rate)
- Require **p < 0.05** to declare significance
- If **p > 0.05 after full sample**: declare inconclusive, recommend larger test or different variable
- Never overfit to a single test — require 2+ confirming experiments before major strategy changes

```typescript
// Use simple-statistics npm package
import { mannWhitneyU, fisherExact } from "simple-statistics";
```

---

## Playbook Storage

Winning patterns are stored per-org and fed to Content Creator:

```typescript
// Stored in brand_config.metadata.playbook or a dedicated table
interface Playbook {
  experimentResults: Array<{
    variable: string;
    finding: string;       // "Carousel posts get 2.3x more saves than single images"
    recommendation: string; // "Default to carousel for product showcase content"
    confirmedDate: string;
    platform: string;
  }>;
}
```
