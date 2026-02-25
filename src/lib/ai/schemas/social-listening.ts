import { z } from "zod";

export const ListeningReportSchema = z.object({
  scannedAt: z.string().datetime(),
  mentionCount: z.number(),
  sentimentBreakdown: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
    urgent: z.number(),
  }),
  sentimentShift: z.object({
    direction: z.enum(["improving", "stable", "declining", "crisis"]),
    magnitude: z.number(),
    explanation: z.string(),
  }),
  alerts: z.array(z.object({
    type: z.enum([
      "mention_spike",
      "sentiment_drop",
      "viral_mention",
      "crisis_potential",
      "ugc_opportunity",
      "partnership_opportunity",
      "competitive_mention",
      "review_alert",
    ]),
    severity: z.enum(["info", "warning", "critical"]),
    title: z.string(),
    description: z.string(),
    source: z.string(),
    url: z.string().optional(),
    suggestedAction: z.string(),
  })),
  topMentions: z.array(z.object({
    platform: z.string(),
    author: z.string(),
    body: z.string().max(500),
    sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
    reach: z.number(),
    url: z.string().optional(),
    isUGC: z.boolean(),
  })).max(20),
  trendingConversations: z.array(z.object({
    topic: z.string(),
    volume: z.number(),
    sentiment: z.string(),
    relevance: z.string(),
    opportunityToJoin: z.boolean(),
    suggestedResponse: z.string().optional(),
  })).max(5),
  confidenceScore: z.number().min(0).max(1),
});

export type ListeningReport = z.infer<typeof ListeningReportSchema>;

export interface SocialListeningInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    alternateNames: string[];
    industry: string;
    competitors: string[];
  };
  trackingKeywords: string[];
  trackingHashtags: string[];
  excludeKeywords: string[];
  sentimentBaseline: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recentMentions?: Array<{
    platform: string;
    author: string;
    body: string;
    sentiment: string;
    reach: number;
  }>;
}
