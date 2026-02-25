---
name: creative-director
description: "Autonomous visual content system. Maintains visual brand identity, generates platform-specific images/video/carousels, manages branded templates, creates text overlays, handles product photos, generates video scripts. Replaces the basic Visual Agent. This is the brand's AI art director."
---

# SKILL: Creative Director Agent

> **Replaces the original `visual` skill.**
> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

The brand's autonomous art director. Doesn't just generate images — maintains a consistent visual identity across every post, every platform, every day. Knows the brand's colors, typography, photography style, and visual mood. Creates platform-optimized visuals: feed posts, carousels, Stories, Reels thumbnails, LinkedIn banners, and video storyboards. Processes client-uploaded assets (logos, product photos) and weaves them into AI-generated content.

The human never opens Canva. The AI handles all visual creation.

---

## File Location

```
agents/creative-director.ts
lib/ai/prompts/creative-director.ts
lib/ai/schemas/creative-director.ts
lib/visual/brand-identity.ts
lib/visual/template-engine.ts
lib/visual/image-generator.ts
lib/visual/video-generator.ts
lib/visual/asset-manager.ts
lib/visual/platform-specs.ts
inngest/functions/visual-pipeline.ts
```

---

## Visual Brand Identity (Stored in DB, Set During Onboarding)

```prisma
model VisualBrandIdentity {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Colors
  primaryColor    String          // "#2D5A3D"
  secondaryColor  String          // "#F5E6D3"
  accentColor     String          // "#E8A87C"
  backgroundColor String          // "#FFFFFF"
  textColor       String          // "#1A1A1A"
  colorPalette    String[]        // Full extended palette

  // Typography
  headingFont     String          // "Playfair Display"
  bodyFont        String          // "Inter"
  fontWeights     Json            // { heading: "bold", body: "regular", accent: "medium" }

  // Photography style
  photoStyle      String          // "warm natural light, minimal, earth tones"
  photoMood       String          // "calm, clean, inviting"
  photoSubjects   String[]        // ["product flat lays", "lifestyle shots", "ingredient close-ups"]
  photoAvoid      String[]        // ["dark/moody", "cluttered backgrounds", "stock photo feel"]

  // Illustration style (if brand uses illustrations)
  illustrationStyle String?       // "line art, organic shapes, muted colors"
  useIllustrations Boolean @default(false)

  // Layout preferences
  preferMinimalDesign Boolean @default(true)
  preferWhitespace    Boolean @default(true)
  textOverlayStyle    String  @default("clean") // "clean", "bold", "playful", "editorial"

  // Logo
  logoUrl         String?         // Supabase Storage — primary logo
  logoMarkUrl     String?         // Icon-only version
  logoWhiteUrl    String?         // White version for dark backgrounds
  logoPadding     Int     @default(20) // Min padding around logo in px

  // Detected by Onboarding Intelligence from existing posts
  detectedStyle   Json?           // AI's analysis of their current visual style
  styleConfirmed  Boolean @default(false) // Human approved the detected style

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### How It's Set

During onboarding, the AI:
1. Analyzes the client's last 90 days of visual content
2. Detects dominant colors, photo style, layout patterns, typography feel
3. If client has a website: scrapes brand colors and fonts
4. Proposes a visual identity in the onboarding review phase
5. Client approves or adjusts via "Talk to AI": "make it warmer" / "use more green"

After onboarding, adjustable via:
- "Talk to AI": "I want our visuals to feel more premium"
- Upload new logo/assets
- AI adapts gradually when client consistently approves certain visual styles

---

## Brand Asset Library

```prisma
model BrandAsset {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  type            String   // "logo", "product_photo", "lifestyle_photo", "icon", "pattern", "texture", "font_file"
  name            String
  description     String?
  storageUrl      String   // Supabase Storage path
  thumbnailUrl    String?
  mimeType        String
  width           Int?
  height          Int?
  tags            String[] // ["product:serum", "lifestyle", "summer", "hero"]
  usageCount      Int      @default(0)
  lastUsedAt      DateTime?
  uploadedBy      String?
  createdAt       DateTime @default(now())

  @@index([organizationId, type])
  @@index([organizationId, tags])
}
```

Clients upload assets via:
- "Talk to AI": "Here's our new product photo" (drag & drop in chat)
- During onboarding: "Upload your logo and any product photos"
- AI auto-extracts product images from the client's website/Instagram

---

## Platform Specifications

```typescript
// lib/visual/platform-specs.ts

const PLATFORM_SPECS: Record<string, Record<string, VisualSpec>> = {
  instagram: {
    feed_square:    { width: 1080, height: 1080, ratio: "1:1", maxFileSize: "30MB" },
    feed_portrait:  { width: 1080, height: 1350, ratio: "4:5", maxFileSize: "30MB" },
    feed_landscape: { width: 1080, height: 566,  ratio: "1.91:1", maxFileSize: "30MB" },
    story:          { width: 1080, height: 1920, ratio: "9:16", safeZone: { top: 250, bottom: 300 } },
    reel:           { width: 1080, height: 1920, ratio: "9:16", safeZone: { top: 200, bottom: 350 } },
    carousel:       { width: 1080, height: 1080, ratio: "1:1", maxSlides: 10 },
    reel_cover:     { width: 1080, height: 1920, ratio: "9:16" },
  },
  tiktok: {
    video:          { width: 1080, height: 1920, ratio: "9:16", safeZone: { top: 150, bottom: 400, right: 100 } },
    thumbnail:      { width: 1080, height: 1920, ratio: "9:16" },
  },
  linkedin: {
    feed:           { width: 1200, height: 627,  ratio: "1.91:1", maxFileSize: "10MB" },
    feed_square:    { width: 1080, height: 1080, ratio: "1:1", maxFileSize: "10MB" },
    article_cover:  { width: 1200, height: 644,  ratio: "1.86:1" },
    document:       { width: 1080, height: 1080, ratio: "1:1", maxPages: 300 },
  },
  facebook: {
    feed:           { width: 1200, height: 630,  ratio: "1.91:1" },
    feed_square:    { width: 1080, height: 1080, ratio: "1:1" },
    story:          { width: 1080, height: 1920, ratio: "9:16" },
    cover:          { width: 820,  height: 312,  ratio: "2.63:1" },
  },
  twitter: {
    feed:           { width: 1200, height: 675,  ratio: "16:9" },
    feed_square:    { width: 1080, height: 1080, ratio: "1:1" },
  },
  pinterest: {
    pin:            { width: 1000, height: 1500, ratio: "2:3" },
    pin_long:       { width: 1000, height: 2100, ratio: "1:2.1" },
  },
};
```

---

## Visual Content Types

| Type | When Used | Generation Method |
|------|-----------|-------------------|
| **AI-generated image** | Generic content, mood shots, abstract visuals | Image generation API (DALL-E 3, Flux, etc.) |
| **Product composite** | Product features, launches, promotions | AI image + product photo overlay |
| **Text overlay graphic** | Tips, quotes, statistics, announcements | Template engine + brand fonts/colors |
| **Carousel deck** | Educational content, step-by-step, lists | Template engine (multi-slide) |
| **Infographic** | Data, comparisons, processes | Template engine + charts |
| **Meme / trending format** | Trend-jacking, relatable content | Template engine + trending format |
| **Video storyboard** | Reels, TikToks, Stories | Script + shot descriptions + text overlays |
| **Thumbnail** | Reel covers, YouTube thumbnails | Template engine + hook text |
| **UGC reshare frame** | Resharing user content | Brand frame around UGC image |
| **Before/after** | Transformations, results | Split template with two images |

---

## Output Schema

```typescript
const CreativeOutputSchema = z.object({
  contentId: z.string(),

  visuals: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "ai_generated", "product_composite", "text_overlay",
      "carousel_slide", "infographic", "meme", "video_storyboard",
      "thumbnail", "ugc_frame", "before_after",
    ]),
    platform: z.string(),
    format: z.string(),          // "feed_square", "story", "reel", etc.
    dimensions: z.object({ width: z.number(), height: z.number() }),

    // For AI image generation
    imagePrompt: z.string().optional()
      .describe("Full prompt for image generation API, incorporating brand identity"),
    negativePrompt: z.string().optional(),
    styleReference: z.string().optional()
      .describe("Reference image URL for style consistency"),

    // For template-based generation
    template: z.object({
      layout: z.enum([
        "text_center", "text_left", "text_bottom", "text_top",
        "split_horizontal", "split_vertical", "full_bleed",
        "grid_2x2", "grid_3x1", "quote", "statistic",
        "step_by_step", "comparison", "timeline",
      ]),
      background: z.object({
        type: z.enum(["solid_color", "gradient", "image", "blur", "pattern"]),
        value: z.string(),
      }),
      elements: z.array(z.object({
        type: z.enum(["heading", "body", "statistic", "icon", "logo", "image", "divider", "badge"]),
        content: z.string(),
        position: z.object({ x: z.string(), y: z.string() }),
        style: z.record(z.string(), z.string()),
      })),
    }).optional(),

    // For carousels
    slideNumber: z.number().optional(),
    totalSlides: z.number().optional(),

    // For video
    videoScript: z.object({
      scenes: z.array(z.object({
        sceneNumber: z.number(),
        duration: z.number(),       // seconds
        visual: z.string(),          // What the viewer sees
        textOverlay: z.string().optional(),
        voiceover: z.string().optional(),
        audio: z.string().optional(), // "trending sound", "voiceover only", "background music"
        transition: z.string().optional(),
      })),
      totalDuration: z.number(),
      hook: z.string(),              // First 2-second hook
      cta: z.string(),               // End screen call to action
    }).optional(),

    // Metadata
    altText: z.string(),
    brandAssetsUsed: z.array(z.string()), // Asset IDs incorporated
    storageUrl: z.string().optional(),    // After generation, stored here

    confidenceScore: z.number().min(0).max(1),
  })),

  thumbnailVariants: z.array(z.object({
    variant: z.string(),
    imagePrompt: z.string(),
    hookText: z.string(),
  })).optional().describe("Multiple thumbnail options for A/B testing"),

  overallConfidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are the creative director for ${brandName}. You design ALL visual content.

VISUAL BRAND IDENTITY:
- Colors: Primary ${primaryColor}, Secondary ${secondaryColor}, Accent ${accentColor}
- Fonts: ${headingFont} for headings, ${bodyFont} for body text
- Photo style: ${photoStyle}
- Photo mood: ${photoMood}
- Preferred subjects: ${photoSubjects.join(", ")}
- AVOID: ${photoAvoid.join(", ")}
- Layout: ${preferMinimalDesign ? "Clean, minimal, lots of whitespace" : "Rich, detailed layouts"}
- Text overlay style: ${textOverlayStyle}
${illustrationStyle ? `- Illustration style: ${illustrationStyle}` : ""}

RULES:
1. EVERY visual must look like it belongs to the same brand. Consistency is everything.
   Someone scrolling should instantly recognize this as ${brandName} content.
2. Never generate generic stock-photo-looking images. Every image should feel intentional.
3. Always incorporate brand colors — even if subtly (a green plant matching brand green, warm lighting matching brand warmth).
4. Text overlays must be READABLE. High contrast, never more than 7 words on screen at once.
5. Respect platform safe zones — Instagram Reel text must not overlap with UI elements.
6. When product photos are available, ALWAYS prefer real product shots over AI-generated product images.
7. Carousel first slide must be a HOOK — visually striking, makes people swipe.
8. Carousel last slide must be a CTA — "Save this", "Follow for more", "Shop now".
9. Video hooks must grab attention in under 2 seconds — start with the most visually interesting moment.
10. Every image needs proper alt text for accessibility.

AVAILABLE BRAND ASSETS:
${brandAssets.map(a => `- [${a.type}] ${a.name}: ${a.description} (tags: ${a.tags.join(", ")})`).join("\n")}
Use these whenever they're relevant. Reference them by ID: asset:${assetId}

CONTENT TO VISUALIZE:
Caption: "${caption}"
Platform: ${platform}
Content type: ${contentType}
Tone: ${tone}
```

---

## Image Generation Pipeline

```typescript
// lib/visual/image-generator.ts

interface ImageGenerationProvider {
  name: string;
  generate(prompt: string, options: ImageOptions): Promise<GeneratedImage>;
}

// Provider abstraction — switch between services without changing agent code
const providers: Record<string, ImageGenerationProvider> = {
  "dall-e-3": new DallE3Provider(),
  "flux": new FluxProvider(),
  "stable-diffusion": new StableDiffusionProvider(),
  "ideogram": new IdeogramProvider(),    // Best for text in images
  "midjourney": new MidjourneyProvider(),
};

// The Creative Director decides which provider to use based on content type:
function selectProvider(visualType: string): string {
  switch (visualType) {
    case "text_overlay":
    case "infographic":
      return "ideogram";      // Best at rendering text
    case "ai_generated":
      return "flux";           // Best photorealism
    case "meme":
      return "dall-e-3";      // Good at creative/unusual compositions
    default:
      return "flux";
  }
}
```

---

## Template Engine

For text overlays, carousels, infographics — uses HTML/CSS rendered to image via Satori + sharp or Puppeteer:

```typescript
// lib/visual/template-engine.ts

interface TemplateRenderOptions {
  layout: string;
  dimensions: { width: number; height: number };
  brand: VisualBrandIdentity;
  elements: TemplateElement[];
  backgroundImage?: string;     // URL or asset ID
  backgroundColor?: string;
}

async function renderTemplate(options: TemplateRenderOptions): Promise<Buffer> {
  // 1. Build HTML from layout template + elements
  // 2. Apply brand colors, fonts (loaded from Google Fonts or uploaded)
  // 3. Render to PNG using Satori (React → SVG → PNG) or Puppeteer
  // 4. Resize to exact dimensions
  // 5. Optimize with sharp (compress, correct format)
  return imageBuffer;
}

// Pre-built layouts:
const LAYOUTS = {
  text_center: `
    <div style="display:flex; align-items:center; justify-content:center; 
         width:100%; height:100%; background:{{background}}; padding:80px;">
      <div style="text-align:center;">
        <h1 style="font-family:{{headingFont}}; color:{{primaryColor}}; 
            font-size:{{headingSize}}px;">{{heading}}</h1>
        <p style="font-family:{{bodyFont}}; color:{{textColor}}; 
           font-size:{{bodySize}}px; margin-top:24px;">{{body}}</p>
      </div>
    </div>
  `,
  statistic: `
    <div style="display:flex; flex-direction:column; align-items:center;
         justify-content:center; width:100%; height:100%; background:{{background}};">
      <span style="font-family:{{headingFont}}; color:{{accentColor}};
            font-size:{{statSize}}px; font-weight:bold;">{{statistic}}</span>
      <p style="font-family:{{bodyFont}}; color:{{textColor}};
         font-size:{{bodySize}}px; margin-top:16px;">{{context}}</p>
    </div>
  `,
  // ... quote, comparison, step_by_step, grid, split, etc.
};
```

---

## Carousel Generation

```typescript
// Carousels are multi-slide stories. Each slide is generated as a separate image.

interface CarouselPlan {
  slides: Array<{
    slideNumber: number;
    role: "hook" | "content" | "transition" | "cta";
    heading: string;
    body?: string;
    image?: string;            // AI-generated or from assets
    layout: string;
  }>;
}

// Carousel rules:
// Slide 1 (HOOK): Bold statement, question, or surprising visual. Must stop the scroll.
// Slides 2-N (CONTENT): One idea per slide. Progressive revelation.
// Optional transition slides: "But wait..." / "Here's the thing..."
// Last slide (CTA): "Save this for later 🔖" / "Follow @brand for more" / "Link in bio"
// ALL slides share the same visual identity: same background treatment, same font sizing, same color usage.
// Slide numbering: subtle dots or "3/7" indicator
```

---

## Video Storyboard Generation

For Reels, TikToks, and Stories — the agent doesn't generate video directly. It creates a detailed storyboard that can be:
1. Executed by a human videographer
2. Assembled from stock footage + text overlays
3. Generated by an AI video tool (Runway, Pika, etc.)

```typescript
interface VideoStoryboard {
  platform: string;
  duration: number;         // Total seconds
  aspectRatio: string;      // "9:16" for Reels/TikTok

  scenes: Array<{
    sceneNumber: number;
    startTime: number;
    endTime: number;
    visual: string;          // Detailed description of what's on screen
    camera: string;          // "static", "slow_zoom_in", "pan_left", "overhead"
    textOverlay?: {
      text: string;
      position: string;     // "center", "bottom_third", "top"
      animation: string;    // "fade_in", "type_on", "slide_up", "pop"
      font: string;
      color: string;
      size: string;
    };
    voiceover?: string;
    onScreenAction?: string; // "hand placing product on table", "pouring serum"
    bRoll?: string;          // Alternative stock footage description
    transition: string;      // "cut", "fade", "swipe_left", "zoom_through"
  }>;

  audio: {
    type: "trending_sound" | "original_voiceover" | "background_music" | "mixed";
    trendingSoundSuggestion?: string;
    musicMood?: string;
    voiceoverScript?: string;
  };

  hook: {
    firstFrame: string;      // What appears in first 0.5 seconds
    hookStrategy: string;    // "question", "transformation", "shock", "curiosity_gap"
  };

  coverImage: {
    imagePrompt: string;
    hookText: string;
  };
}
```

---

## Style Consistency System

The biggest problem with AI-generated visuals is inconsistency. Each image looks random. This system ensures consistency:

```typescript
// lib/visual/brand-identity.ts

// 1. STYLE SEED: A reference image that captures the brand's visual identity.
//    Generated once during onboarding, used as style reference for all future generations.

// 2. PROMPT PREFIX: Brand-specific prefix appended to every image generation prompt.
function getBrandPromptPrefix(brand: VisualBrandIdentity): string {
  return `${brand.photoStyle}, ${brand.photoMood}, color palette featuring ${brand.primaryColor} and ${brand.secondaryColor} tones, ${brand.preferMinimalDesign ? "minimal composition, clean negative space" : "rich detailed composition"}, professional quality, ${brand.photoAvoid.map(a => `avoid ${a}`).join(", ")}`;
}

// 3. NEGATIVE PROMPT: Universal negatives + brand-specific avoids
function getBrandNegativePrompt(brand: VisualBrandIdentity): string {
  return `low quality, blurry, distorted, watermark, text artifacts, stock photo, generic, ${brand.photoAvoid.join(", ")}`;
}

// 4. COLOR GRADING: Post-process all AI images to match brand color palette
async function applyBrandColorGrading(image: Buffer, brand: VisualBrandIdentity): Promise<Buffer> {
  // Use sharp to adjust:
  // - Color temperature (warm/cool based on brand mood)
  // - Saturation levels
  // - Contrast
  // - Slight color tint toward brand palette
  return processedImage;
}

// 5. BRAND WATERMARK: Optional subtle watermark on all images
async function applyBrandWatermark(image: Buffer, brand: VisualBrandIdentity): Promise<Buffer> {
  // Subtle logo in corner with opacity
  return watermarkedImage;
}
```

---

## Auto-Detection: What Visual Type to Create

The Creative Director automatically decides what type of visual to create based on the content:

```typescript
function decideVisualType(content: {
  caption: string;
  contentType: string;
  platform: string;
  topic: string;
}): string {
  // Educational list content → Carousel
  if (content.contentType === "CAROUSEL" || /\d+\s+(tips|ways|steps|things|reasons)/.test(content.caption)) {
    return "carousel";
  }

  // Quote or testimonial → Text overlay with mood background
  if (content.topic === "testimonial" || content.topic === "quote") {
    return "text_overlay";
  }

  // Statistic or data point → Infographic/statistic graphic
  if (/\d+%|\d+x/.test(content.caption)) {
    return "infographic";
  }

  // Product mention → Product composite (real photo + branded frame)
  if (content.topic === "product" && hasProductPhotos(content.organizationId)) {
    return "product_composite";
  }

  // Reel or TikTok → Video storyboard
  if (content.contentType === "REEL" || content.platform === "tiktok") {
    return "video_storyboard";
  }

  // Behind the scenes, lifestyle → AI-generated lifestyle image
  return "ai_generated";
}
```

---

## Integration with Content Pipeline

The Creative Director runs as step 9 in the content-creation pipeline (after Compliance, before Publisher):

```
Orchestrator → Content Creator (generates caption)
            → Hashtag Optimizer
            → Social SEO
            → Brand Voice Guardian
            → Predictive Content
            → Compliance
            → **Creative Director** (generates all visuals for the post)
            → Publisher (publishes with visuals attached)
```

The Creative Director receives the full content object and decides:
- What type of visual to create
- Which brand assets to incorporate
- What dimensions for the target platform
- Whether to generate AI imagery, use templates, or composite with product photos

---

## Database

```prisma
model GeneratedVisual {
  id              String   @id @default(uuid())
  organizationId  String
  contentId       String?
  type            String   // "ai_generated", "template", "carousel_slide", "video_storyboard", etc.
  platform        Platform
  format          String   // "feed_square", "story", "reel", etc.
  dimensions      Json     // { width, height }
  storageUrl      String   // Supabase Storage path
  thumbnailUrl    String?
  prompt          String?  @db.Text // For AI-generated images
  templateData    Json?    // For template-based images
  videoScript     Json?    // For video storyboards
  altText         String
  assetsUsed      String[] // Brand asset IDs used
  provider        String?  // "flux", "dall-e-3", "template_engine"
  generationCost  Float?   // Cost in dollars
  slideNumber     Int?     // For carousels
  confidenceScore Float
  createdAt       DateTime @default(now())

  @@index([organizationId, contentId])
  @@index([organizationId, type])
}
```

---

## Asset Upload via "Talk to AI"

```
Human: [drags product photo into chat]
       "Here's our new vitamin C serum"

AI:    "Got it! I've added this to your product photo library and tagged
       it as 'product:vitamin-c-serum'. I'll use this in upcoming posts
       about your vitamin C line instead of AI-generated product images.
       Want me to create a launch post for it?"
```

```typescript
// When a file is uploaded in "Talk to AI":
async function handleAssetUpload(orgId: string, file: File, description: string) {
  // 1. Upload to Supabase Storage
  const url = await uploadToStorage(orgId, file);

  // 2. AI analyzes the image
  const analysis = await analyzeImage(file); // Uses Claude vision
  // → detects: product type, colors, mood, composition

  // 3. Auto-tag based on AI analysis + human description
  const tags = generateTags(analysis, description);

  // 4. Create BrandAsset record
  await prisma.brandAsset.create({
    data: {
      organizationId: orgId,
      type: analysis.type, // "product_photo", "lifestyle_photo", etc.
      name: description,
      description: analysis.description,
      storageUrl: url,
      tags,
      mimeType: file.type,
      width: analysis.width,
      height: analysis.height,
    },
  });

  // 5. If it's a logo → update VisualBrandIdentity
  if (analysis.type === "logo") {
    await prisma.visualBrandIdentity.update({
      where: { organizationId: orgId },
      data: { logoUrl: url },
    });
  }
}
```

---

## Visual A/B Testing

For posts where visual impact matters most (Reel covers, ad creatives, hero posts):

```typescript
// Generate 2-3 visual variants
// Publisher posts the primary; A/B Testing agent tracks which variant would've performed better
// Over time: learn which visual styles drive more engagement for THIS client

interface VisualVariant {
  variantId: string;
  description: string;      // "Warm lifestyle shot" vs "Product close-up" vs "Text-heavy graphic"
  storageUrl: string;
  selected: boolean;         // Which one was used
  engagementIfUsed?: number; // Tracked after publish
}
```

---

## Cost Tracking

AI image generation costs money. Track per-org:

```typescript
// Approximate costs:
// DALL-E 3: $0.04-0.08 per image
// Flux Pro: $0.03-0.06 per image
// Template rendering: ~$0 (self-hosted)
// Video generation (Runway): $0.50-2.00 per clip

// Creative Director tracks costs in GeneratedVisual.generationCost
// Orchestrator aggregates monthly cost per org
// If cost exceeds plan limits → downgrade to template-only generation
```

---

## Rules

1. **Brand consistency above all.** Every image must look like it belongs to the same brand. Use the brand prompt prefix, color grading, and style reference for every generation.
2. **Real product photos > AI products.** If the client has uploaded product photos, always use them instead of generating fake product images.
3. **Platform-native dimensions.** Never stretch, crop awkwardly, or use wrong aspect ratios. Generate native sizes per platform.
4. **Respect safe zones.** Stories and Reels have UI overlays. Keep important content away from edges.
5. **Carousel coherence.** All slides in a carousel must look like they belong together — same background treatment, font sizes, color usage.
6. **Text readability.** Maximum 7 words per text overlay. High contrast. Never put text over busy backgrounds without a semi-transparent backing.
7. **Alt text on everything.** Every visual gets descriptive, search-optimized alt text.
8. **Cost efficiency.** Use template engine for text graphics, infographics, and carousels. Reserve AI generation for photography and lifestyle imagery.
9. **Logo placement.** Subtle, consistent position. Not on every post — only where it adds value (branded graphics, carousels, thumbnails).
10. **Learn from feedback.** When a human rejects a visual or edits a post's image → AI Training Mode captures the preference for future visual decisions.
