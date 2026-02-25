import { z } from "zod";

export const CommunityBuilderSchema = z.object({
  communityHealth: z.object({
    size: z.number(),
    growth: z.number().describe("Monthly growth percentage"),
    engagement: z.number().min(0).max(1),
    sentiment: z.number().min(-1).max(1),
    activeMembers: z.number().describe("Members with 3+ interactions/month"),
  }),
  superFans: z.array(z.object({
    identifier: z.string(),
    platform: z.string(),
    engagementScore: z.number(),
    contentScore: z.number().optional(),
    valueScore: z.number(),
    actions: z.array(z.string()).describe("Recommended actions"),
  })).describe("Top 10 most engaged community members"),
  memberSegments: z.array(z.object({
    segment: z.string(),
    size: z.number(),
    behavior: z.string(),
    engagement: z.number(),
  })),
  strategy: z.object({
    objectives: z.array(z.string()),
    contentPillars: z.array(z.string()),
    engagementTactics: z.array(z.string()),
    growthChannels: z.array(z.string()),
  }),
  campaigns: z.array(z.object({
    name: z.string(),
    type: z.enum(["engagement", "ugc", "ambassador", "contest", "event"]),
    description: z.string(),
    expectedImpact: z.string(),
    resources: z.array(z.string()),
  })),
  recommendations: z.array(z.object({
    priority: z.enum(["critical", "high", "medium", "low"]),
    action: z.string(),
    rationale: z.string(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type CommunityBuilder = z.infer<typeof CommunityBuilderSchema>;

export const CommunityBuilderInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  platforms: z.array(z.string()),
  communityData: z.object({
    totalMembers: z.number(),
    monthlyGrowth: z.number(),
    avgEngagement: z.number(),
    topMembers: z.array(z.object({
      handle: z.string(),
      platform: z.string(),
      posts: z.number(),
      comments: z.number(),
      shares: z.number(),
    })).optional(),
  }).optional(),
});

export type CommunityBuilderInput = z.infer<typeof CommunityBuilderInputSchema>;
