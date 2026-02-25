import { z } from "zod";

export const TrendSchema = z.object({
  topic: z.string(),
  relevance: z.number().min(0).max(1),
  category: z.enum(["viral", "seasonal", "industry", "meme", "news", "hashtag"]),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  platforms: z.array(z.string()),
  contentOpportunities: z.array(z.object({
    type: z.string(),
    angle: z.string(),
    urgency: z.enum(["high", "medium", "low"]),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export const TrendReportSchema = z.object({
  summary: z.string(),
  trends: z.array(TrendSchema),
  competitors: z.array(z.object({
    handle: z.string(),
    platform: z.string(),
    trendingTopics: z.array(z.string()),
  })).optional(),
  recommendedActions: z.array(z.object({
    action: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    deadline: z.string().optional(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type TrendReport = z.infer<typeof TrendReportSchema>;
