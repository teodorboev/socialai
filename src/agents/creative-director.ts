/**
 * Creative Director Agent
 * 
 * The brand's autonomous art director. Creates platform-optimized visuals:
 * - Feed posts, carousels, Stories, Reels thumbnails
 * - Text overlays, infographics, product composites
 * - Video storyboards for Reels/TikToks
 * 
 * Maintains visual brand identity across all content.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Import visual library functions
import {
  getBrandIdentity,
  getBrandPromptPrefix,
  getBrandNegativePrompt,
  decideVisualType,
} from "@/lib/visual/brand-identity";
import {
  getDefaultFormat,
  getDimensions,
} from "@/lib/visual/platform-specs";
import {
  selectProvider,
  generateImage,
} from "@/lib/visual/image-generator";
import {
  renderTemplateHTML,
  generateCarouselSlides,
} from "@/lib/visual/template-engine";
import { recordAssetUsage, findRelevantAssets } from "@/lib/visual/asset-manager";

// Base Agent
import { BaseAgent, type AgentResult } from "./shared/base-agent";

// Output schema
const VisualOutputSchema = z.object({
  contentId: z.string(),
  visuals: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "ai_generated", "product_composite", "text_overlay",
      "carousel_slide", "infographic", "meme", "video_storyboard",
      "thumbnail", "ugc_frame", "before_after",
    ]),
    platform: z.string(),
    format: z.string(),
    dimensions: z.object({ width: z.number(), height: z.number() }),
    imagePrompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    styleReference: z.string().optional(),
    template: z.object({
      layout: z.string(),
      elements: z.array(z.object({
        type: z.string(),
        content: z.string(),
        position: z.object({ x: z.string(), y: z.string() }),
      })),
    }).optional(),
    slideNumber: z.number().optional(),
    totalSlides: z.number().optional(),
    videoScript: z.object({
      scenes: z.array(z.object({
        sceneNumber: z.number(),
        duration: z.number(),
        visual: z.string(),
        textOverlay: z.string().optional(),
        voiceover: z.string().optional(),
        transition: z.string().optional(),
      })),
      totalDuration: z.number(),
      hook: z.string(),
      cta: z.string(),
    }).optional(),
    altText: z.string(),
    brandAssetsUsed: z.array(z.string()),
    storageUrl: z.string().optional(),
    confidenceScore: z.number().min(0).max(1),
  })),
  thumbnailVariants: z.array(z.object({
    variant: z.string(),
    imagePrompt: z.string(),
    hookText: z.string(),
  })).optional(),
  overallConfidenceScore: z.number().min(0).max(1),
});

type VisualOutput = z.infer<typeof VisualOutputSchema>;

interface CreativeDirectorInput {
  organizationId: string;
  contentId: string;
  caption: string;
  contentType: string;
  platform: string;
  topic?: string;
}

/**
 * Creative Director Agent
 */
export class CreativeDirectorAgent extends BaseAgent {
  constructor() {
    super("CREATIVE_DIRECTOR");
  }

  async execute(input: CreativeDirectorInput): Promise<{
    success: boolean;
    data?: VisualOutput;
    confidenceScore: number;
    shouldEscalate: boolean;
    escalationReason?: string;
    tokensUsed: number;
  }> {
    const { organizationId, contentId, caption, contentType, platform, topic } = input;

    // 1. Get brand identity
    const brand = await getBrandIdentity(organizationId);
    if (!brand) {
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: "No brand identity configured. Please complete onboarding.",
        tokensUsed: 0,
      };
    }

    // 2. Find relevant brand assets
    const relevantAssets = await findRelevantAssets(organizationId, {
      caption,
      contentType,
      topic,
    });

    const hasProductPhotos = relevantAssets.some(a => a.type === "product_photo");

    // 3. Decide visual type
    const visualType = decideVisualType({
      caption,
      contentType,
      platform,
      hasProductPhotos,
    });

    // 4. Get format and dimensions
    const format = getDefaultFormat(platform, contentType);
    const dims = getDimensions(platform, format) || { width: 1080, height: 1080 };

    // 5. Generate the appropriate visual
    let visualOutput;

    switch (visualType) {
      case "carousel":
        visualOutput = await this.generateCarousel(organizationId, caption, platform, brand);
        break;
      case "text_overlay":
      case "infographic":
        visualOutput = await this.generateTemplateVisual(organizationId, visualType, caption, platform, brand);
        break;
      case "video_storyboard":
        visualOutput = await this.generateVideoStoryboard(organizationId, caption, platform, brand);
        break;
      case "product_composite":
        visualOutput = await this.generateProductComposite(organizationId, caption, platform, brand, relevantAssets);
        break;
      default:
        visualOutput = await this.generateAIGenerated(organizationId, caption, platform, brand);
    }

    // 6. Generate thumbnail variants if video content
    let thumbnailVariants;
    if (contentType === "REEL" || platform === "tiktok") {
      thumbnailVariants = await this.generateThumbnailVariants(caption, brand);
    }

    // 7. Calculate overall confidence
    const overallConfidence = visualOutput.visuals[0]?.confidenceScore || 0.8;

    // 8. Save generated visuals to database
    for (const visual of visualOutput.visuals) {
      await prisma.generatedVisual.create({
        data: {
          organizationId,
          contentId,
          type: visual.type,
          platform: platform as any,
          format: visual.format,
          dimensions: visual.dimensions,
          altText: visual.altText,
          assetsUsed: visual.brandAssetsUsed,
          confidenceScore: visual.confidenceScore,
          slideNumber: visual.slideNumber,
          prompt: visual.imagePrompt,
        },
      });
    }

    return {
      success: true,
      data: {
        contentId,
        visuals: visualOutput.visuals,
        thumbnailVariants,
        overallConfidenceScore: overallConfidence,
      },
      confidenceScore: overallConfidence,
      shouldEscalate: overallConfidence < 0.5,
      escalationReason: overallConfidence < 0.5 ? "Low confidence in visual generation" : undefined,
      tokensUsed: 0, // Would track from API calls
    };
  }

  /**
   * Generate AI-generated image
   */
  private async generateAIGenerated(
    organizationId: string,
    caption: string,
    platform: string,
    brand: Record<string, unknown>
  ): Promise<Pick<VisualOutput, "visuals">> {
    const provider = selectProvider("ai_generated");
    const dims = getDimensions(platform, "feed_square") || { width: 1080, height: 1080 };

    // Build prompt with brand identity
    const promptPrefix = getBrandPromptPrefix(brand);
    const imagePrompt = `${promptPrefix}, ${caption}, high quality, professional photography`;

    const negativePrompt = getBrandNegativePrompt(brand);

    // Generate image
    let storageUrl: string | undefined;
    try {
      const result = await generateImage(imagePrompt, "ai_generated", {
        width: dims.width,
        height: dims.height,
      });
      storageUrl = result.url;
    } catch {
      // Image generation not implemented yet
    }

    return {
      visuals: [{
        id: `visual-${Date.now()}`,
        type: "ai_generated",
        platform,
        format: "feed_square",
        dimensions: dims,
        imagePrompt,
        negativePrompt,
        altText: caption,
        brandAssetsUsed: [],
        storageUrl,
        confidenceScore: 0.85,
      }],
    };
  }

  /**
   * Generate carousel
   */
  private async generateCarousel(
    organizationId: string,
    caption: string,
    platform: string,
    brand: Record<string, unknown>
  ): Promise<Pick<VisualOutput, "visuals">> {
    const totalSlides = Math.min(5, Math.ceil(caption.length / 100) + 1);
    const slides = generateCarouselSlides(caption, totalSlides, brand);
    const dims = getDimensions(platform, "carousel") || { width: 1080, height: 1080 };

    const visuals = slides.map((slide, i) => {
      const layout = slide.role === "hook" ? "carousel_hook" : 
                     slide.role === "cta" ? "carousel_cta" : "text_center";

      const html = renderTemplateHTML({
        layout,
        dimensions: dims,
        brand,
        elements: [
          { type: "heading", content: slide.heading || "", position: { x: "50%", y: "30%" } },
          { type: "body", content: slide.body || "", position: { x: "50%", y: "60%" } },
        ],
      });

      return {
        id: `visual-${Date.now()}-${i}`,
        type: "carousel_slide" as const,
        platform,
        format: "carousel",
        dimensions: dims,
        template: {
          layout,
          elements: [
            { type: "heading", content: slide.heading || "", position: { x: "50%", y: "30%" } },
            { type: "body", content: slide.body || "", position: { x: "50%", y: "60%" } },
          ],
        },
        slideNumber: slide.slideNumber,
        totalSlides: slide.totalSlides,
        altText: `${slide.heading || ""} ${slide.body || ""}`.trim(),
        brandAssetsUsed: [],
        confidenceScore: 0.9,
      };
    });

    return { visuals };
  }

  /**
   * Generate template-based visual (text overlay, infographic)
   */
  private async generateTemplateVisual(
    organizationId: string,
    visualType: string,
    caption: string,
    platform: string,
    brand: Record<string, unknown>
  ): Promise<Pick<VisualOutput, "visuals">> {
    const dims = getDimensions(platform, "feed_square") || { width: 1080, height: 1080 };
    const layout = visualType === "infographic" ? "statistic" : "text_center";

    const html = renderTemplateHTML({
      layout,
      dimensions: dims,
      brand,
      elements: [
        { type: "heading", content: caption.substring(0, 50), position: { x: "50%", y: "40%" } },
        { type: "body", content: caption.substring(50), position: { x: "50%", y: "60%" } },
      ],
    });

    return {
      visuals: [{
        id: `visual-${Date.now()}`,
        type: visualType as "text_overlay" | "infographic",
        platform,
        format: "feed_square",
        dimensions: dims,
        template: {
          layout,
          elements: [
            { type: "heading", content: caption.substring(0, 50), position: { x: "50%", y: "40%" } },
            { type: "body", content: caption.substring(50), position: { x: "50%", y: "60%" } },
          ],
        },
        altText: caption,
        brandAssetsUsed: [],
        confidenceScore: 0.9,
      }],
    };
  }

  /**
   * Generate video storyboard
   */
  private async generateVideoStoryboard(
    organizationId: string,
    caption: string,
    platform: string,
    brand: Record<string, unknown>
  ): Promise<Pick<VisualOutput, "visuals">> {
    const dims = getDimensions(platform, "reel") || { width: 1080, height: 1920 };

    // Generate storyboard
    const scenes = [
      { sceneNumber: 1, duration: 3, visual: "Hook - attention grabbing moment", textOverlay: caption.substring(0, 30), transition: "cut" },
      { sceneNumber: 2, duration: 5, visual: "Main content or demonstration", textOverlay: caption.substring(30, 80), transition: "fade" },
      { sceneNumber: 3, duration: 2, visual: "Value or tip", textOverlay: caption.substring(80, 120), transition: "cut" },
      { sceneNumber: 4, duration: 3, visual: "CTA or call to action", textOverlay: "Follow for more!", transition: "slide" },
    ];

    const videoScript = {
      scenes,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      hook: caption.substring(0, 30),
      cta: "Follow for more tips!",
    };

    // Generate cover image prompt
    const promptPrefix = getBrandPromptPrefix(brand);
    const imagePrompt = `${promptPrefix}, ${caption.substring(0, 50)}, video thumbnail, eye-catching`;

    return {
      visuals: [{
        id: `visual-${Date.now()}`,
        type: "video_storyboard",
        platform,
        format: "reel",
        dimensions: dims,
        imagePrompt,
        videoScript,
        altText: `Video: ${caption}`,
        brandAssetsUsed: [],
        confidenceScore: 0.8,
      }],
    };
  }

  /**
   * Generate product composite
   */
  private async generateProductComposite(
    organizationId: string,
    caption: string,
    platform: string,
    brand: Record<string, unknown>,
    assets: Array<{ id: string; type: string; storageUrl: string }>
  ): Promise<Pick<VisualOutput, "visuals">> {
    const dims = getDimensions(platform, "feed_square") || { width: 1080, height: 1080 };
    const productAsset = assets.find(a => a.type === "product_photo");

    if (productAsset) {
      await recordAssetUsage(productAsset.id);
    }

    return {
      visuals: [{
        id: `visual-${Date.now()}`,
        type: "product_composite",
        platform,
        format: "feed_square",
        dimensions: dims,
        template: {
          layout: "split_horizontal",
          elements: [
            { type: "image", content: productAsset?.storageUrl || "", position: { x: "25%", y: "50%" } },
            { type: "body", content: caption, position: { x: "75%", y: "50%" } },
          ],
        },
        altText: caption,
        brandAssetsUsed: productAsset ? [productAsset.id] : [],
        confidenceScore: 0.95,
      }],
    };
  }

  /**
   * Generate thumbnail variants for A/B testing
   */
  private async generateThumbnailVariants(
    caption: string,
    brand: Record<string, unknown>
  ): Promise<VisualOutput["thumbnailVariants"]> {
    const promptPrefix = getBrandPromptPrefix(brand);
    const hookText = caption.substring(0, 30);

    const variants = [
      { variant: "text_focused", imagePrompt: `${promptPrefix}, bold text "${hookText}", minimal background`, hookText },
      { variant: "lifestyle", imagePrompt: `${promptPrefix}, ${hookText}, lifestyle photography, natural light`, hookText },
      { variant: "product", imagePrompt: `${promptPrefix}, ${hookText}, product shot, clean background`, hookText },
    ];

    return variants;
  }
}
