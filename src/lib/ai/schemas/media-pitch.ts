import { z } from "zod";

export const MediaPitchSchema = z.object({
  storyAngles: z.array(z.object({
    angle: z.string(),
    relevance: z.number().min(0).max(1),
    newsworthiness: z.number().min(0).max(1),
    targetOutlets: z.array(z.string()),
    hook: z.string(),
  })),
  pressList: z.array(z.object({
    outlet: z.string(),
    contact: z.string().optional(),
    beat: z.string(),
    previousCoverage: z.string().optional(),
    relevance: z.number().min(0).max(1),
  })),
  pitchDrafts: z.array(z.object({
    outlet: z.string(),
    subject: z.string(),
    body: z.string(),
    tone: z.string(),
    length: z.enum(["short", "medium", "long"]),
  })),
  earnedMediaValue: z.object({
    estimatedReach: z.number(),
    estimatedValue: z.number(),
    probability: z.number().min(0).max(1),
  }),
  timeline: z.array(z.object({
    action: z.string(),
    timing: z.string(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type MediaPitch = z.infer<typeof MediaPitchSchema>;

export const MediaPitchInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  newsHooks: z.array(z.string()),
  recentWins: z.array(z.string()).optional(),
  targetPublications: z.array(z.string()).optional(),
  campaignContext: z.string().optional(),
});

export type MediaPitchInput = z.infer<typeof MediaPitchInputSchema>;
