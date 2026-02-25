import { z } from "zod";

export const ReportingNarratorSchema = z.object({
  narrative: z.string().describe("Full narrative report combining a all data into cohesive story"),
  highlights: z.array(z.object({
    title: z.string().describe("Title of the highlight"),
    description: z.string().describe("Description of what happened"),
    metric: z.string().optional().describe("Associated metric if applicable"),
    importance: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).describe("Significance level"),
  })).describe("Key positive highlights from the period"),
  concerns: z.array(z.object({
    title: z.string().describe("Title of the concern"),
    description: z.string().describe("Description of the issue"),
    metric: z.string().optional().describe("Associated metric if applicable"),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).describe("Severity level"),
    recommendedAction: z.string().optional().describe("Suggested action to address"),
  })).describe("Areas of concern that need attention"),
  recommendations: z.array(z.object({
    action: z.string().describe("Specific recommended action"),
    rationale: z.string().describe("Why this action is recommended"),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).describe("Priority level"),
    expectedImpact: z.string().describe("Expected impact if implemented"),
    effort: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Effort required to implement"),
  })).describe("Actionable recommendations based on the data"),
  byPlatform: z.record(z.string(), z.object({
    summary: z.string(),
    metrics: z.record(z.string(), z.number()),
    highlights: z.array(z.string()),
    concerns: z.array(z.string()),
  })).describe("Platform-specific analysis"),
  comparisons: z.object({
    previousPeriod: z.object({
      engagementChange: z.number().describe("Percentage change in engagement"),
      reachChange: z.number().describe("Percentage change in reach"),
      followerChange: z.number().describe("Percentage change in followers"),
    }).describe("Comparison to previous period"),
    YoY: z.object({
      engagementChange: z.number().optional().describe("Year-over-year engagement change"),
      followerChange: z.number().optional().describe("Year-over-year follower change"),
    }).optional().describe("Year-over-year comparison if available"),
    vsGoal: z.object({
      achieved: z.array(z.string()).describe("Goals that were achieved"),
      missed: z.array(z.object({
        goal: z.string(),
        actual: z.number(),
        target: z.number(),
      })).describe("Goals that were missed"),
    }).describe("Performance vs set goals"),
  }).describe("Comparative analysis"),
  nextPeriodOutlook: z.object({
    summary: z.string().describe("Overall outlook for next period"),
    opportunities: z.array(z.string()).describe("Key opportunities to capitalize on"),
    risks: z.array(z.string()).describe("Risks to monitor"),
  }).describe("Outlook for the next reporting period"),
  tone: z.enum(["CELEBRATORY", "NEUTRAL", "CONCERNED", "MIXED"]).describe("Overall tone of the report"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the report quality"),
});

export type ReportingNarrator = z.infer<typeof ReportingNarratorSchema>;

export const ReportingNarratorInputSchema = z.object({
  organizationId: z.string(),
  period: z.object({
    type: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    start: z.string(),
    end: z.string(),
  }).describe("Reporting period"),
  metrics: z.object({
    overview: z.object({
      totalPosts: z.number(),
      totalEngagement: z.number(),
      totalReach: z.number(),
      totalFollowers: z.number(),
      followerChange: z.number(),
      engagementRate: z.number(),
    }).describe("Overall metrics"),
    byPlatform: z.record(z.string(), z.object({
      posts: z.number(),
      engagement: z.number(),
      reach: z.number(),
      followers: z.number(),
      followerChange: z.number(),
      engagementRate: z.number(),
    })).describe("Platform-specific metrics"),
    topContent: z.array(z.object({
      id: z.string(),
      platform: z.string(),
      type: z.string(),
      caption: z.string().optional(),
      engagement: z.number(),
      reach: z.number(),
    })).describe("Top performing content"),
    worstContent: z.array(z.object({
      id: z.string(),
      platform: z.string(),
      type: z.string(),
      engagement: z.number(),
    })).optional().describe("Underperforming content"),
  }).describe("Performance metrics for the period"),
  audience: z.object({
    demographics: z.object({
      topLocations: z.array(z.string()),
      ageRanges: z.array(z.string()),
      gender: z.record(z.string(), z.number()).optional(),
    }).optional().describe("Audience demographics"),
    growth: z.object({
      newFollowers: z.number(),
      unfollowed: z.number(),
      netGrowth: z.number(),
    }).describe("Audience growth"),
  }).optional().describe("Audience insights"),
  goals: z.array(z.object({
    metric: z.string(),
    target: z.number(),
    actual: z.number(),
    achieved: z.boolean(),
  })).optional().describe("Goals for this period"),
  previousPeriodData: z.object({
    engagement: z.number(),
    reach: z.number(),
    followers: z.number(),
  }).optional().describe("Previous period for comparison"),
  reportAudience: z.enum(["INTERNAL", "CLIENT", "EXECUTIVE"]).describe("Who will receive this report"),
  tonePreference: z.enum(["CELEBRATORY", "NEUTRAL", "CONCERNED", "MIXED"]).optional().describe("Preferred tone for the report"),
});

export type ReportingNarratorInput = z.infer<typeof ReportingNarratorInputSchema>;
