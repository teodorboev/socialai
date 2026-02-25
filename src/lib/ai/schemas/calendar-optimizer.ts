import { z } from "zod";

export const CalendarOptimizerSchema = z.object({
  optimizedSchedule: z.array(z.object({
    platform: z.string(),
    dayOfWeek: z.number().min(0).max(6).describe("Day of week (0=Sunday, 6=Saturday)"),
    timeUtc: z.string().describe("Optimal time in UTC (HH:mm format)"),
    timeLocal: z.string().describe("Optimal time in user's timezone"),
    contentTypes: z.array(z.string()).describe("Best content types for this slot"),
    frequency: z.object({
      postsPerWeek: z.number(),
      storiesPerWeek: z.number().optional(),
      reelsPerWeek: z.number().optional(),
    }).describe("Recommended posting frequency"),
    rationale: z.string().describe("Why this time is optimal"),
    confidence: z.number().min(0).max(1).describe("Confidence in this recommendation"),
  })).describe("Optimized posting schedule per platform"),
  rationale: z.object({
    summary: z.string().describe("High-level rationale for schedule changes"),
    dataPoints: z.array(z.object({
      metric: z.string(),
      insight: z.string(),
      impact: z.string(),
    })).describe("Key data points driving recommendations"),
    changes: z.array(z.object({
      what: z.string().describe("What is changing"),
      from: z.string().describe("Current value"),
      to: z.string().describe("New recommended value"),
      reason: z.string().describe("Reason for the change"),
    })).describe("Specific changes from current schedule"),
  }).describe("Detailed rationale for the optimized schedule"),
  expectedImprovement: z.object({
    overall: z.object({
      engagementIncrease: z.number().describe("Expected percentage increase in engagement"),
      reachIncrease: z.number().describe("Expected percentage increase in reach"),
      followerGrowth: z.number().describe("Expected percentage increase in followers"),
    }).describe("Overall expected improvements"),
    byPlatform: z.array(z.object({
      platform: z.string(),
      engagementIncrease: z.number(),
      bestTime: z.string(),
    })).describe("Platform-specific improvements"),
    timeline: z.string().describe("How long until improvements are expected to materialize"),
  }).describe("Projected performance improvements"),
  conflictsResolved: z.array(z.object({
    issue: z.string().describe("Identified conflict or issue"),
    resolution: z.string().describe("How it was resolved"),
  })).describe("Schedule conflicts that were resolved"),
  confidenceScore: z.number().min(0).max(1).describe("Overall confidence in schedule recommendations"),
});

export type CalendarOptimizer = z.infer<typeof CalendarOptimizerSchema>;

export const CalendarOptimizerInputSchema = z.object({
  organizationId: z.string(),
  currentSchedule: z.array(z.object({
    platform: z.string(),
    postsPerWeek: z.number(),
    postingTimes: z.array(z.string()).describe("Current posting times in UTC"),
    contentTypes: z.array(z.string()),
  })).describe("Current posting schedule"),
  engagementData: z.object({
    period: z.object({
      start: z.string(),
      end: z.string(),
    }).describe("Data collection period"),
    byPlatform: z.array(z.object({
      platform: z.string(),
      bestTimes: z.array(z.object({
        dayOfWeek: z.number(),
        timeUtc: z.string(),
        avgEngagement: z.number(),
        sampleSize: z.number(),
      })),
      worstTimes: z.array(z.object({
        dayOfWeek: z.number(),
        timeUtc: z.string(),
        avgEngagement: z.number(),
      })),
      contentTypePerformance: z.array(z.object({
        type: z.string(),
        avgEngagement: z.number(),
      })),
    })).describe("Engagement data by platform"),
    overallMetrics: z.object({
      avgEngagementRate: z.number(),
      totalPosts: z.number(),
    }).optional(),
  }).describe("Historical engagement data"),
  audienceData: z.object({
    timezone: z.string().describe("Primary audience timezone"),
    activeHours: z.array(z.object({
      dayOfWeek: z.number(),
      hourStart: z.number(),
      hourEnd: z.number(),
      activity: z.enum(["HIGH", "MEDIUM", "LOW"]),
    })).describe("When audience is most active"),
    demographics: z.object({
      locations: z.array(z.string()),
      ageRanges: z.array(z.string()),
    }).optional(),
  }).describe("Audience activity patterns"),
  contentMix: z.array(z.object({
    platform: z.string(),
    ratio: z.record(z.string(), z.number()).describe("Content type ratios"),
  })).optional().describe("Current content type mix"),
  businessConstraints: z.object({
    manualPostingAvailable: z.boolean().optional().describe("Whether manual posting is possible"),
    preferredTimes: z.array(z.string()).optional().describe("Times that must be avoided"),
    blackoutDates: z.array(z.string()).optional().describe("Dates to avoid posting"),
  }).optional().describe("Business constraints on posting"),
});

export type CalendarOptimizerInput = z.infer<typeof CalendarOptimizerInputSchema>;
