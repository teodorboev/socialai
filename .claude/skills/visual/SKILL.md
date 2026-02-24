---
name: visual
description: "Image and video generation agent: provider abstraction (DALL-E/Flux/Ideogram), platform dimensions, prompt enhancement, storage structure, cost management."
---

# SKILL: Visual Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Generates and processes visual assets (images, graphics, video thumbnails, carousel slides) for social media content. Takes media prompts from the Content Creator Agent and produces platform-ready visuals that match the brand's visual identity.

---

## File Location

```
agents/visual.ts
lib/ai/prompts/visual.ts
lib/ai/schemas/visual.ts
lib/media/image-gen.ts         ← Image generation provider abstraction
lib/media/video-gen.ts         ← Video generation provider abstraction
lib/media/resize.ts            ← Platform-specific resizing
```

---

## Input Interface

```typescript
interface VisualInput {
  organizationId: string;
  contentId: string;
  platform: Platform;
  contentType: ContentType;
  mediaPrompt: string;            // From Content Creator Agent
  brandConfig: {
    brandName: string;
    brandColors: { primary: string; secondary: string; accent: string } | null;
    industry: string;
  };
  aspectRatio?: string;           // Override; otherwise determined by platform + contentType
}
```

---

## Output Schema

```typescript
const VisualOutputSchema = z.object({
  mediaUrls: z.array(z.string().url())
    .describe("Supabase Storage URLs of generated/processed media"),
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
```

---

## Image Generation Pipeline

```
Content Creator outputs mediaPrompt
        │
        ▼
┌───────────────────┐
│ Enhance prompt     │  Add brand colors, style consistency, quality modifiers
│ with brand context │  "Professional photo, brand colors #4A90D9, clean modern style..."
└────────┬──────────┘
         ▼
┌───────────────────┐
│ Generate image     │  DALL-E 3 / Flux / Ideogram
│ via provider       │
└────────┬──────────┘
         ▼
┌───────────────────┐
│ Post-process       │  Resize for platform, optimize file size
│                    │  Add text overlay if needed (using Sharp/Canvas)
└────────┬──────────┘
         ▼
┌───────────────────┐
│ Upload to          │  Store in Supabase Storage
│ Supabase Storage   │  Path: /{orgId}/media/{contentId}/{filename}
└────────┬──────────┘
         ▼
┌───────────────────┐
│ Safety check       │  Run through moderation API
│                    │  Verify no text/watermarks/artifacts
└───────────────────┘
```

---

## Platform Image Dimensions

| Platform | Content Type | Dimensions | Aspect Ratio |
|----------|-------------|------------|--------------|
| Instagram | Feed Post | 1080×1080 | 1:1 |
| Instagram | Portrait Post | 1080×1350 | 4:5 |
| Instagram | Story/Reel | 1080×1920 | 9:16 |
| Instagram | Carousel | 1080×1080 | 1:1 |
| Facebook | Feed Post | 1200×630 | 1.91:1 |
| Facebook | Story | 1080×1920 | 9:16 |
| TikTok | Video | 1080×1920 | 9:16 |
| Twitter | Single Image | 1200×675 | 16:9 |
| Twitter | Two Images | 700×800 each | 7:8 |
| LinkedIn | Feed Post | 1200×627 | 1.91:1 |
| LinkedIn | Document/Carousel | 1080×1080 | 1:1 |

---

## Provider Abstraction

```typescript
// lib/media/image-gen.ts
interface ImageGenerationProvider {
  generate(prompt: string, options: ImageGenOptions): Promise<Buffer>;
}

interface ImageGenOptions {
  width: number;
  height: number;
  style?: "natural" | "vivid";
  quality?: "standard" | "hd";
}

class DalleProvider implements ImageGenerationProvider { /* ... */ }
class FluxProvider implements ImageGenerationProvider { /* ... */ }
class IdeogramProvider implements ImageGenerationProvider { /* ... */ }

// Factory — switch providers based on content type and cost
function getImageProvider(contentType: ContentType): ImageGenerationProvider {
  // DALL-E 3 for high-quality feed posts
  // Flux for fast iteration / A/B test variants
  // Ideogram for text-heavy graphics
}
```

---

## Prompt Enhancement

The Visual Agent enhances the Content Creator's raw `mediaPrompt` before sending to the image generator:

```typescript
function enhancePrompt(raw: string, brand: BrandConfig, platform: Platform): string {
  const enhancements = [
    raw,
    `Brand colors: ${brand.brandColors?.primary}, ${brand.brandColors?.secondary}`,
    `Style: clean, modern, professional, high-quality`,
    `Industry context: ${brand.industry}`,
    `No text overlays unless specifically requested`,
    `No watermarks, no stock photo feel`,
    `Suitable for ${platform} — ${getPlatformVisualStyle(platform)}`,
  ];
  return enhancements.filter(Boolean).join(". ");
}
```

---

## Cost Management

| Provider | Cost per Image | When to Use |
|----------|---------------|-------------|
| DALL-E 3 (HD) | ~$0.08 | Hero content, feed posts |
| DALL-E 3 (Standard) | ~$0.04 | Stories, secondary content |
| Flux (via Replicate) | ~$0.01-0.03 | A/B test variants, high volume |
| Ideogram | ~$0.04 | Typography-heavy graphics |

Budget: aim for <$0.10 per piece of content on average. Use cheaper providers for variants and testing.

---

## Video Generation (Phase 4+)

For TikTok/Reels, integrate after MVP:

```typescript
interface VideoGenerationProvider {
  generate(params: VideoGenParams): Promise<{ url: string; durationSeconds: number }>;
}

// Providers to evaluate:
// - Runway ML: High quality, expensive ($0.50+/video)
// - Kling: Good for short clips
// - HeyGen: Avatar-based talking head videos
// - D-ID: Similar avatar videos

// MVP alternative: Generate still images + add Ken Burns effect + add music
// This is much cheaper and still works for simple content
```

---

## Storage Structure

```
Supabase Storage bucket: "media"

/{organizationId}/
  /media/
    /{contentId}/
      /original.png          ← Full resolution generated image
      /instagram_feed.jpg    ← Resized for Instagram feed (1080x1080)
      /instagram_story.jpg   ← Resized for story (1080x1920)
      /twitter.jpg           ← Resized for Twitter (1200x675)
      /thumbnail.jpg         ← Small preview for dashboard (400x400)
```

Use Supabase Storage transformation API for on-the-fly resizing where available.
