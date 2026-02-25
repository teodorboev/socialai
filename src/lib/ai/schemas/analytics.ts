import { z } from "zod";

export const AnalyticsReportSchema = z.object({
  summary: z.string().describe("2-3 sentence executive summary of the period"),
  metrics: z.object({
    totalImpressions: z.number(),
    totalEngagements: z.number(),
    averageEngagementRate: z.number(),
    followerGrowth: z.number(),
    bestPerformingPlatform: z.string(),
    bestPerformingContentType: z.string(),
  }),
  topContent: z.array(z.object({
    contentId: z.string(),
    whyItWorked: z.string(),
  })).max(5),
  underperformers: z.array(z.object({
    contentId: z.string(),
    whyItUnderperformed: z.string(),
  })).max(3),
  trends: z.array(z.string()).describe("Emerging patterns: posting times, content types, themes gaining traction"),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    expectedImpact: z.string(),
    targetAgent: z.enum(["CONTENT_CREATOR", "STRATEGY", "PUBLISHER", "ENGAGEMENT", "VISUAL"]),
  })),
  optimalPostingTimes: z.record(z.string(), z.array(z.string())).describe("Updated optimal posting times per platform based on data"),
  confidenceScore: z.number().min(0).max(1),
});

export type AnalyticsReport = z.infer<typeof AnalyticsReportSchema>;
