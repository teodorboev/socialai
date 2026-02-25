import { z } from "zod";

export const RepurposeOutputSchema = z.object({
  sourceAnalysis: z.object({
    keyMessages: z.array(z.string()).min(1).max(5),
    targetAudience: z.string(),
    bestAngles: z.array(z.string()),
    contentPillars: z.array(z.string()),
  }),
  outputs: z.array(z.object({
    platform: z.string(),
    contentType: z.enum(["POST", "STORY", "REEL", "CAROUSEL", "THREAD", "ARTICLE", "POLL"]),
    caption: z.string(),
    hashtags: z.array(z.string()),
    mediaPrompt: z.string().optional(),
    altText: z.string().optional(),
    hook: z.string().describe("The attention-grabbing first line or visual hook"),
    adaptationNotes: z.string().describe("What was changed from the source and why"),
    confidenceScore: z.number().min(0).max(1),
  })),
  contentCalendarSuggestion: z.array(z.object({
    outputIndex: z.number(),
    suggestedDay: z.string(),
    suggestedTime: z.string(),
    reasoning: z.string(),
  })),
  overallConfidenceScore: z.number().min(0).max(1),
});

export type RepurposeOutput = z.infer<typeof RepurposeOutputSchema>;

export interface RepurposeInput {
  organizationId: string;
  sourceType: "social_post" | "blog_post" | "podcast_transcript" | "youtube_transcript" | "newsletter" | "press_release" | "custom_text";
  sourceContent: {
    title?: string;
    body: string;
    url?: string;
    platform?: string;
    contentType?: string;
    engagementData?: {
      impressions: number;
      engagementRate: number;
      topMetric: string;
    };
  };
  targetPlatforms: string[];
  brandConfig: {
    brandName: string;
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    contentThemes: string[];
    doNots: string[];
  };
  excludeFormats?: string[];
}
