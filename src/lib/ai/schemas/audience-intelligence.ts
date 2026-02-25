import { z } from "zod";

export const AudienceReportSchema = z.object({
  personas: z.array(z.object({
    name: z.string(),
    percentage: z.number(),
    demographics: z.object({
      ageRange: z.string(),
      gender: z.string(),
      topLocations: z.array(z.string()).max(5),
      language: z.string(),
    }),
    behavior: z.object({
      peakActivityDays: z.array(z.string()),
      peakActivityHours: z.array(z.string()),
      preferredContentTypes: z.array(z.string()),
      engagementStyle: z.enum(["passive_scroller", "active_engager", "sharer_amplifier", "creator_ugc"]),
      averageSessionContext: z.string(),
    }),
    interests: z.array(z.string()),
    painPoints: z.array(z.string()),
    contentThatResonates: z.array(z.string()),
    contentToAvoid: z.array(z.string()),
  })).min(2).max(5),
  platformBreakdown: z.record(z.string(), z.object({
    dominantPersona: z.string(),
    audienceSize: z.number(),
    growthRate: z.number(),
    engagementQuality: z.enum(["high", "medium", "low"]),
    uniqueTraits: z.string(),
  })),
  optimalPostingWindows: z.record(z.string(), z.array(z.object({
    day: z.string(),
    startHour: z.number(),
    endHour: z.number(),
    timezone: z.string(),
    reasoning: z.string(),
  }))),
  audienceShifts: z.array(z.object({
    shift: z.string(),
    direction: z.enum(["growing", "shrinking", "emerging"]),
    implication: z.string(),
    recommendation: z.string(),
  })),
  contentRecommendations: z.array(z.object({
    targetPersona: z.string(),
    recommendation: z.string(),
    platform: z.string(),
    expectedImpact: z.string(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type AudienceReport = z.infer<typeof AudienceReportSchema>;

export interface AudienceIntelInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    industry: string;
    targetAudience: { demographics: string; interests: string[] };
  };
  platformData: Record<string, {
    followers: number;
    followersChange: number;
    avgEngagementRate: number;
    topContentTypes: string[];
    demographics?: {
      ageGroups?: Record<string, number>;
      gender?: Record<string, number>;
      locations?: Record<string, number>;
    };
    peakHours?: Record<string, number>;
  }>;
  contentPerformance: Array<{
    contentType: string;
    engagementRate: number;
    impressions: number;
  }>;
  previousReport?: {
    personas: Array<{ name: string }>;
    date: string;
  };
}
