import { z } from "zod";

export const VisualOutputSchema = z.object({
  mediaUrls: z.array(z.string().url()),
  mediaType: z.enum(["IMAGE", "VIDEO", "CAROUSEL_IMAGES", "GIF"]),
  altText: z.string(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
  generationMethod: z.enum(["ai_generated", "template_filled", "stock_composed"]),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type VisualOutput = z.infer<typeof VisualOutputSchema>;

// Platform dimensions
export const PLATFORM_DIMENSIONS = {
  INSTAGRAM: {
    FEED: { width: 1080, height: 1080, aspect: "1:1" },
    PORTRAIT: { width: 1080, height: 1350, aspect: "4:5" },
    STORY: { width: 1080, height: 1920, aspect: "9:16" },
    CAROUSEL: { width: 1080, height: 1080, aspect: "1:1" },
  },
  FACEBOOK: {
    FEED: { width: 1200, height: 630, aspect: "1.91:1" },
    STORY: { width: 1080, height: 1920, aspect: "9:16" },
  },
  TIKTOK: {
    VIDEO: { width: 1080, height: 1920, aspect: "9:16" },
  },
  TWITTER: {
    SINGLE: { width: 1200, height: 675, aspect: "16:9" },
    TWO_IMAGES: { width: 700, height: 800, aspect: "7:8" },
  },
  LINKEDIN: {
    FEED: { width: 1200, height: 627, aspect: "1.91:1" },
    DOCUMENT: { width: 1080, height: 1080, aspect: "1:1" },
  },
} as const;

export type PlatformKey = keyof typeof PLATFORM_DIMENSIONS;
export type ContentTypeKey = keyof typeof PLATFORM_DIMENSIONS[PlatformKey];

export function getDimensions(platform: PlatformKey, contentType: string) {
  const platformConfigs = PLATFORM_DIMENSIONS[platform];
  if (!platformConfigs) {
    return { width: 1080, height: 1080 };
  }
  
  // Handle platforms with different key structures
  const upperType = contentType.toUpperCase();
  
  // Try to find by content type key
  if (upperType === "POST" || upperType === "IMAGE") {
    return "FEED" in platformConfigs ? (platformConfigs as any).FEED : { width: 1080, height: 1080 };
  }
  if (upperType === "STORY") {
    return "STORY" in platformConfigs ? (platformConfigs as any).STORY : { width: 1080, height: 1920 };
  }
  if (upperType === "REEL" || upperType === "VIDEO") {
    return "VIDEO" in platformConfigs ? (platformConfigs as any).VIDEO : { width: 1080, height: 1920 };
  }
  
  return { width: 1080, height: 1080 };
}
