import { z } from "zod";

export const SentimentIntelligenceSchema = z.object({
  overallSentiment: z.object({
    score: z.number().min(-1).max(1).describe("-1 = very negative, 0 = neutral, 1 = very positive"),
    label: z.enum(["very_negative", "negative", "neutral", "positive", "very_positive"]),
    confidence: z.number().min(0).max(1),
    volume: z.object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
      total: z.number(),
    }),
  }),
  sentimentByPlatform: z.array(z.object({
    platform: z.string(),
    score: z.number().min(-1).max(1),
    volume: z.number(),
    trend: z.enum(["improving", "stable", "declining"]),
  })),
  themes: z.array(z.object({
    theme: z.string(),
    sentiment: z.number().min(-1).max(1),
    volume: z.number(),
    trend: z.enum(["improving", "stable", "declining"]),
  })),
  emergingIssues: z.array(z.object({
    issue: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    sentiment: z.number(),
    mentions: z.number(),
    firstSeen: z.string().optional(),
    recommendedAction: z.string(),
  })),
  topPositiveThemes: z.array(z.object({
    theme: z.string(),
    volume: z.number(),
    examples: z.array(z.string()),
  })),
  topNegativeThemes: z.array(z.object({
    theme: z.string(),
    volume: z.number(),
    examples: z.array(z.string()),
  })),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(["critical", "high", "medium", "low"]),
    reason: z.string(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type SentimentIntelligence = z.infer<typeof SentimentIntelligenceSchema>;

export const SentimentIntelligenceInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  platforms: z.array(z.string()),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  mentions: z.array(z.object({
    id: z.string(),
    platform: z.string(),
    author: z.string().optional(),
    content: z.string(),
    sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
    createdAt: z.string().optional(),
  })).optional(),
  keywords: z.array(z.string()).optional(),
});

export type SentimentIntelligenceInput = z.infer<typeof SentimentIntelligenceInputSchema>;
