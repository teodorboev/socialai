/**
 * Creative Director Agent - Output Schema
 * 
 * Zod schema for validating Creative Director agent responses.
 * Defines the structure for all visual content generation outputs.
 */

import { z } from "zod";

// ============================================================
// VISUAL TYPES
// ============================================================

export const VisualTypeEnum = z.enum([
  "ai_generated",
  "product_composite",
  "text_overlay",
  "carousel_slide",
  "infographic",
  "meme",
  "video_storyboard",
  "thumbnail",
  "ugc_frame",
  "before_after",
]);

export type VisualType = z.infer<typeof VisualTypeEnum>;

// ============================================================
// TEMPLATE SCHEMAS
// ============================================================

export const LayoutEnum = z.enum([
  "text_center",
  "text_left",
  "text_bottom",
  "text_top",
  "split_horizontal",
  "split_vertical",
  "full_bleed",
  "grid_2x2",
  "grid_3x1",
  "quote",
  "statistic",
  "step_by_step",
  "comparison",
  "timeline",
  "carousel_hook",
  "carousel_cta",
]);

export type Layout = z.infer<typeof LayoutEnum>;

export const BackgroundTypeEnum = z.enum([
  "solid_color",
  "gradient",
  "image",
  "blur",
  "pattern",
]);

export const ElementTypeEnum = z.enum([
  "heading",
  "body",
  "statistic",
  "icon",
  "logo",
  "image",
  "divider",
  "badge",
]);

// Template schema for layout-based generation
export const VisualTemplateSchema = z.object({
  layout: LayoutEnum,
  background: z.object({
    type: BackgroundTypeEnum,
    value: z.string(),
  }),
  elements: z.array(z.object({
    type: ElementTypeEnum,
    content: z.string(),
    position: z.object({
      x: z.string(),
      y: z.string(),
    }),
    style: z.record(z.string(), z.string()).optional(),
  })),
});

export type VisualTemplate = z.infer<typeof VisualTemplateSchema>;

// ============================================================
// VIDEO SCRIPT SCHEMAS
// ============================================================

export const TextPositionEnum = z.enum([
  "center",
  "bottom_third",
  "top",
  "bottom",
]);

export const TextAnimationEnum = z.enum([
  "fade_in",
  "type_on",
  "slide_up",
  "pop",
  "none",
]);

export const CameraMovementEnum = z.enum([
  "static",
  "slow_zoom_in",
  "slow_zoom_out",
  "pan_left",
  "pan_right",
  "overhead",
  "medium",
  "close_up",
]);

export const TransitionEnum = z.enum([
  "cut",
  "fade",
  "swipe_left",
  "swipe_right",
  "zoom_through",
  "dissolve",
]);

export const AudioTypeEnum = z.enum([
  "trending_sound",
  "original_voiceover",
  "background_music",
  "mixed",
]);

export const HookStrategyEnum = z.enum([
  "question",
  "transformation",
  "shock",
  "curiosity_gap",
  "statement",
  "result",
]);

// Video scene schema
export const VideoSceneSchema = z.object({
  sceneNumber: z.number(),
  duration: z.number(), // seconds
  visual: z.string(),
  camera: CameraMovementEnum.optional(),
  textOverlay: z.object({
    text: z.string(),
    position: TextPositionEnum,
    animation: TextAnimationEnum,
    font: z.string().optional(),
    color: z.string().optional(),
    size: z.string().optional(),
    background: z.string().optional(),
  }).optional(),
  voiceover: z.string().optional(),
  onScreenAction: z.string().optional(),
  bRoll: z.string().optional(),
  transition: TransitionEnum,
});

// Video hook schema
export const VideoHookSchema = z.object({
  firstFrame: z.string(),
  hookStrategy: HookStrategyEnum,
});

// Video cover image schema
export const VideoCoverImageSchema = z.object({
  imagePrompt: z.string(),
  hookText: z.string(),
});

// Video audio schema
export const VideoAudioSchema = z.object({
  type: AudioTypeEnum,
  trendingSoundSuggestion: z.string().optional(),
  musicMood: z.string().optional(),
  voiceoverScript: z.string().optional(),
});

// Video script schema (for video_storyboard type)
export const VideoScriptSchema = z.object({
  scenes: z.array(VideoSceneSchema),
  totalDuration: z.number(),
  hook: z.string(),
  cta: z.string(),
});

// ============================================================
// THUMBNAIL VARIANT SCHEMA
// ============================================================

export const ThumbnailVariantSchema = z.object({
  variant: z.string(),
  imagePrompt: z.string(),
  hookText: z.string(),
});

export type ThumbnailVariant = z.infer<typeof ThumbnailVariantSchema>;

// ============================================================
// SINGLE VISUAL OUTPUT SCHEMA
// ============================================================

export const VisualOutputSchema = z.object({
  id: z.string(),
  type: VisualTypeEnum,
  platform: z.string(),
  format: z.string(), // "feed_square", "story", "reel", etc.
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),

  // For AI image generation
  imagePrompt: z.string().optional()
    .describe("Full prompt for image generation API, incorporating brand identity"),
  negativePrompt: z.string().optional(),
  styleReference: z.string().optional()
    .describe("Reference image URL for style consistency"),

  // For template-based generation
  template: VisualTemplateSchema.optional(),

  // For carousels
  slideNumber: z.number().optional(),
  totalSlides: z.number().optional(),

  // For video
  videoScript: VideoScriptSchema.optional(),

  // Metadata
  altText: z.string(),
  brandAssetsUsed: z.array(z.string()),
  storageUrl: z.string().optional(),

  confidenceScore: z.number().min(0).max(1),
});

export type VisualOutput = z.infer<typeof VisualOutputSchema>;

// ============================================================
// MAIN CREATIVE OUTPUT SCHEMA
// ============================================================

export const CreativeOutputSchema = z.object({
  contentId: z.string(),
  visuals: z.array(VisualOutputSchema),
  thumbnailVariants: z.array(ThumbnailVariantSchema).optional()
    .describe("Multiple thumbnail options for A/B testing"),
  overallConfidenceScore: z.number().min(0).max(1),
});

export type CreativeOutput = z.infer<typeof CreativeOutputSchema>;

// ============================================================
// INPUT SCHEMA (for agent execution)
// ============================================================

export const CreativeDirectorInputSchema = z.object({
  organizationId: z.string(),
  contentId: z.string().optional(),
  caption: z.string(),
  contentType: z.string(),
  platform: z.string(),
  tone: z.string().optional().default("professional"),
  topic: z.string().optional(),
  brandContext: z.object({
    brandName: z.string(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    headingFont: z.string().optional(),
    bodyFont: z.string().optional(),
    photoStyle: z.string().optional(),
    photoMood: z.string().optional(),
    photoSubjects: z.array(z.string()).optional(),
    photoAvoid: z.array(z.string()).optional(),
    preferMinimalDesign: z.boolean().optional(),
    textOverlayStyle: z.string().optional(),
    logoUrl: z.string().optional(),
  }).optional(),
  existingAssets: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    tags: z.array(z.string()),
    storageUrl: z.string(),
  })).optional(),
});

export type CreativeDirectorInput = z.infer<typeof CreativeDirectorInputSchema>;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if visual type requires AI image generation
 */
export function requiresAIGeneration(type: VisualType): boolean {
  return ["ai_generated", "product_composite"].includes(type);
}

/**
 * Check if visual type requires template rendering
 */
export function requiresTemplateRendering(type: VisualType): boolean {
  return [
    "text_overlay",
    "carousel_slide", 
    "infographic",
    "meme",
    "thumbnail",
    "ugc_frame",
    "before_after",
  ].includes(type);
}

/**
 * Check if visual type is a video
 */
export function isVideoType(type: VisualType): boolean {
  return type === "video_storyboard";
}

/**
 * Get recommended provider for visual type
 */
export function getRecommendedProvider(type: VisualType): string {
  switch (type) {
    case "text_overlay":
    case "infographic":
      return "ideogram";
    case "ai_generated":
      return "flux";
    case "meme":
      return "dall-e-3";
    default:
      return "flux";
  }
}
