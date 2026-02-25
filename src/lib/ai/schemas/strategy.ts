import { z } from "zod";

export const StrategyPlanSchema = z.object({
  title: z.string(),
  overview: z.string().describe("2-3 paragraph summary of the strategy for this period"),
  themes: z.array(z.object({
    theme: z.string(),
    description: z.string(),
    platforms: z.array(z.string()),
    frequency: z.string(),
    contentTypes: z.array(z.string()),
    exampleTopics: z.array(z.string()).min(3),
  })).min(3).max(8),
  platformMix: z.record(z.string(), z.number()).describe("Percentage allocation per platform, must sum to 100"),
  postsPerWeek: z.record(z.string(), z.number()).describe("Target posts per week per platform"),
  contentTypeDistribution: z.record(z.string(), z.number()).describe("Percentage of each content type"),
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

export type StrategyPlan = z.infer<typeof StrategyPlanSchema>;
