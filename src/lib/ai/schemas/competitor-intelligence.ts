import { z } from "zod";

export const CompetitorReportSchema = z.object({
  summary: z.string().describe("2-3 sentence executive summary of competitive landscape this week"),
  competitors: z.array(z.object({
    name: z.string(),
    overallThreatLevel: z.enum(["low", "medium", "high"]),
    strengths: z.array(z.string()).max(3),
    weaknesses: z.array(z.string()).max(3),
    notableActivity: z.string().describe("What they did this week that's worth noting"),
    topPerformingPost: z.object({
      platform: z.string(),
      description: z.string(),
      engagementRate: z.number(),
      whyItWorked: z.string(),
      canWeAdapt: z.boolean(),
      adaptationIdea: z.string().optional(),
    }).nullable(),
  })),
  gaps: z.array(z.object({
    gap: z.string().describe("Something competitors aren't doing or doing poorly"),
    opportunity: z.string().describe("How the client can exploit this gap"),
    platform: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    suggestedContentType: z.string(),
  })),
  contentInspirations: z.array(z.object({
    inspiration: z.string(),
    sourceCompetitor: z.string(),
    adaptedIdea: z.string().describe("How to make this our own — NOT copy it"),
    platform: z.string(),
  })).max(5),
  benchmarks: z.object({
    clientVsAvgEngagement: z.number().describe("Client engagement rate vs competitor average, as a percentage difference"),
    clientVsAvgPostFrequency: z.number(),
    clientVsAvgFollowerGrowth: z.number(),
  }),
  confidenceScore: z.number().min(0).max(1),
});

export type CompetitorReport = z.infer<typeof CompetitorReportSchema>;

export interface CompetitorIntelInput {
  organizationId: string;
  competitors: Array<{
    name: string;
    platforms: Array<{
      platform: string;
      handle: string;
      platformUserId?: string;
    }>;
  }>;
  brandConfig: {
    brandName: string;
    industry: string;
    contentThemes: string[];
    targetAudience: { demographics: string; interests: string[] };
  };
  previousReport?: {
    summary: string;
    date: string;
    keyFindings: string[];
  };
  clientMetrics: {
    avgEngagementRate: Record<string, number>;
    followerCounts: Record<string, number>;
    postFrequency: Record<string, number>;
  };
}
