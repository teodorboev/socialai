/**
 * Brand Identity Management
 * Functions for maintaining visual consistency across all generated content
 */

import { prisma } from "@/lib/prisma";
import sharp from "sharp";

interface BrandIdentityData {
  organizationId: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headingFont?: string;
  bodyFont?: string;
  photoStyle?: string;
  photoMood?: string;
  photoSubjects?: string[];
  photoAvoid?: string[];
  preferMinimalDesign?: boolean;
  preferWhitespace?: boolean;
  textOverlayStyle?: string;
  logoUrl?: string;
}

// VisualBrandIdentity type (will be properly typed after migration)
type VisualBrandIdentity = Record<string, unknown>;

/**
 * Get brand identity for an organization
 */
export async function getBrandIdentity(organizationId: string): Promise<VisualBrandIdentity | null> {
  return prisma.visualBrandIdentity.findUnique({
    where: { organizationId },
  }) as Promise<VisualBrandIdentity | null>;
}

/**
 * Create or update brand identity
 */
export async function setBrandIdentity(data: BrandIdentityData): Promise<VisualBrandIdentity> {
  return prisma.visualBrandIdentity.upsert({
    where: { organizationId: data.organizationId },
    update: {
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
      backgroundColor: data.backgroundColor,
      textColor: data.textColor,
      headingFont: data.headingFont,
      bodyFont: data.bodyFont,
      photoStyle: data.photoStyle,
      photoMood: data.photoMood,
      photoSubjects: data.photoSubjects,
      photoAvoid: data.photoAvoid,
      preferMinimalDesign: data.preferMinimalDesign,
      preferWhitespace: data.preferWhitespace,
      textOverlayStyle: data.textOverlayStyle,
      logoUrl: data.logoUrl,
    },
    create: {
      organizationId: data.organizationId,
      primaryColor: data.primaryColor || "#000000",
      secondaryColor: data.secondaryColor || "#FFFFFF",
      accentColor: data.accentColor || "#808080",
      backgroundColor: data.backgroundColor || "#FFFFFF",
      textColor: data.textColor || "#000000",
      headingFont: data.headingFont || "Inter",
      bodyFont: data.bodyFont || "Inter",
      photoStyle: data.photoStyle || "",
      photoMood: data.photoMood || "",
      photoSubjects: data.photoSubjects || [],
      photoAvoid: data.photoAvoid || [],
      preferMinimalDesign: data.preferMinimalDesign ?? true,
      preferWhitespace: data.preferWhitespace ?? true,
      textOverlayStyle: data.textOverlayStyle || "clean",
    },
  }) as Promise<VisualBrandIdentity>;
}

/**
 * Generate brand prompt prefix for image generation
 * This ensures all AI-generated images maintain visual consistency
 */
export function getBrandPromptPrefix(brand: VisualBrandIdentity): string {
  const parts: string[] = [];
  const b = brand as Record<string, unknown>;

  if (b.photoStyle) {
    parts.push(b.photoStyle as string);
  }

  if (b.photoMood) {
    parts.push(b.photoMood as string);
  }

  // Color palette reference
  const colors = [
    b.primaryColor,
    b.secondaryColor,
    b.accentColor,
  ].filter(Boolean).join(", ");
  
  if (colors) {
    parts.push(`color palette featuring ${colors} tones`);
  }

  // Layout preferences
  if (b.preferMinimalDesign) {
    parts.push("minimal composition, clean negative space");
  } else {
    parts.push("rich detailed composition");
  }

  // Quality
  parts.push("professional quality, high resolution");

  // Things to avoid
  const photoAvoid = b.photoAvoid as string[] | undefined;
  if (photoAvoid && photoAvoid.length > 0) {
    parts.push(`avoid: ${photoAvoid.join(", ")}`);
  }

  return parts.join(", ");
}

/**
 * Generate negative prompt for brand
 * Universal negatives + brand-specific avoids
 */
export function getBrandNegativePrompt(brand: VisualBrandIdentity): string {
  const b = brand as Record<string, unknown>;
  const negatives = [
    "low quality",
    "blurry",
    "distorted",
    "watermark",
    "text artifacts",
    "stock photo",
    "generic",
    "amateur",
    "poorly drawn",
  ];

  const photoAvoid = b.photoAvoid as string[] | undefined;
  if (photoAvoid && photoAvoid.length > 0) {
    negatives.push(...photoAvoid);
  }

  return negatives.join(", ");
}

/**
 * Detect visual type to create based on content
 */
export function decideVisualType(params: {
  caption: string;
  contentType: string;
  platform: string;
  hasProductPhotos: boolean;
}): string {
  const { caption, contentType, platform, hasProductPhotos } = params;

  // Educational list content → Carousel
  if (contentType === "CAROUSEL" || /\d+\s+(tips|ways|steps|things|reasons)/.test(caption)) {
    return "carousel";
  }

  // Quote or testimonial → Text overlay with mood background
  const lowerCaption = caption.toLowerCase();
  if (lowerCaption.includes("testimonial") || lowerCaption.includes("quote") || lowerCaption.includes("said")) {
    return "text_overlay";
  }

  // Statistic or data point → Infographic/statistic graphic
  if (/\d+%|\d+x|\$\d+/.test(caption)) {
    return "infographic";
  }

  // Product mention + has real photos → Product composite
  if ((lowerCaption.includes("product") || lowerCaption.includes("shop") || lowerCaption.includes("buy")) && hasProductPhotos) {
    return "product_composite";
  }

  // Reel or TikTok → Video storyboard
  if (contentType === "REEL" || platform === "tiktok") {
    return "video_storyboard";
  }

  // Behind the scenes, lifestyle → AI-generated lifestyle image
  if (lowerCaption.includes("behind") || lowerCaption.includes("lifestyle") || lowerCaption.includes("day")) {
    return "ai_generated";
  }

  // Default to AI-generated
  return "ai_generated";
}

/**
 * Get font family for heading
 */
export function getHeadingFont(brand: VisualBrandIdentity): string {
  const b = brand as Record<string, unknown>;
  return (b.headingFont as string) || "Inter";
}

/**
 * Get font family for body
 */
export function getBodyFont(brand: VisualBrandIdentity): string {
  const b = brand as Record<string, unknown>;
  return (b.bodyFont as string) || "Inter";
}

/**
 * Get brand colors as CSS variables
 */
export function getBrandCssVariables(brand: VisualBrandIdentity): Record<string, string> {
  const b = brand as Record<string, unknown>;
  return {
    "--color-primary": (b.primaryColor as string) || "#000000",
    "--color-secondary": (b.secondaryColor as string) || "#FFFFFF",
    "--color-accent": (b.accentColor as string) || "#808080",
    "--color-background": (b.backgroundColor as string) || "#FFFFFF",
    "--color-text": (b.textColor as string) || "#000000",
  };
}

/**
 * Apply brand colors to image (post-processing)
 * Uses sharp to apply color grading based on brand mood
 */
export async function applyBrandColorGrading(
  imageBuffer: Buffer,
  brand: VisualBrandIdentity
): Promise<Buffer> {
  const b = brand as Record<string, unknown>;
  const photoMood = (b.photoMood as string)?.toLowerCase() || "";
  
  // Determine color temperature based on mood
  let temperature = 0; // Neutral
  let saturation = 1;
  let brightness = 0;

  // Warm moods = positive temperature, Cool moods = negative
  const warmMoods = ["warm", "cozy", "inviting", "friendly", "energetic", "passionate"];
  const coolMoods = ["cool", "calm", "professional", "clean", "minimal", "serene"];

  if (warmMoods.some(m => photoMood.includes(m))) {
    temperature = 15; // Warmer
    saturation = 1.1;
  } else if (coolMoods.some(m => photoMood.includes(m))) {
    temperature = -15; // Cooler
    saturation = 0.95;
  }

  // Apply color grading
  let pipeline = sharp(imageBuffer);

  // Get dominant color from brand and apply tint
  const primaryColor = (b.primaryColor as string) || "#000000";
  const accentColor = (b.accentColor as string) || "#808080";

  // Convert hex to RGB for color adjustments
  const primaryRgb = hexToRgb(primaryColor);
  const accentRgb = hexToRgb(accentColor);

  // Apply brightness and saturation adjustments
  if (brightness !== 0) {
    pipeline = pipeline.modulate({ brightness: 1 + brightness / 100 });
  }
  if (saturation !== 1) {
    pipeline = pipeline.modulate({ saturation });
  }
  // Note: temperature is not directly supported in sharp, would need complex processing

  // Apply a subtle color tint toward brand primary color
  if (primaryRgb) {
    pipeline = pipeline.tint({
      r: Math.round(255 - (255 - primaryRgb.r) * 0.1),
      g: Math.round(255 - (255 - primaryRgb.g) * 0.1),
      b: Math.round(255 - (255 - primaryRgb.b) * 0.1),
    });
  }

  // Sharpen for professional look
  pipeline = pipeline.sharpen({ sigma: 0.5 });

  return pipeline.png().toBuffer();
}

/**
 * Apply brand watermark to image
 */
export async function applyBrandWatermark(
  imageBuffer: Buffer,
  brand: VisualBrandIdentity,
  options?: {
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
    opacity?: number;
    scale?: number;
  }
): Promise<Buffer> {
  const b = brand as Record<string, unknown>;
  const logoUrl = b.logoUrl as string | undefined;
  
  if (!logoUrl) {
    // No logo, return original
    return imageBuffer;
  }

  const position = options?.position || "bottom-right";
  const opacity = options?.opacity || 0.3;
  const scale = options?.scale || 0.15;

  try {
    // Download logo
    const logoResponse = await fetch(logoUrl);
    const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());

    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1080;
    const height = metadata.height || 1080;

    // Calculate logo size (default 15% of image width)
    const logoWidth = Math.round(width * scale);
    
    // Resize logo
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoWidth)
      .ensureAlpha()
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      }])
      .toBuffer();

    // Calculate position
    const padding = 20;
    let left = width - logoWidth - padding;
    let top = height - (logoWidth * 0.3) - padding; // Assume logo is ~30% aspect ratio

    switch (position) {
      case "bottom-left":
        left = padding;
        break;
      case "top-right":
        top = padding;
        break;
      case "top-left":
        left = padding;
        top = padding;
        break;
      case "center":
        left = Math.round((width - logoWidth) / 2);
        top = Math.round((height - logoWidth * 0.3) / 2);
        break;
    }

    // Composite logo onto image
    return sharp(imageBuffer)
      .composite([{
        input: resizedLogo,
        left: Math.max(0, left),
        top: Math.max(0, top),
      }])
      .png()
      .toBuffer();
  } catch (error) {
    console.error("Failed to apply watermark:", error);
    // Return original if watermark fails
    return imageBuffer;
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Process image with brand styling
 * Combines color grading and watermark
 */
export async function applyBrandStyling(
  imageBuffer: Buffer,
  brand: VisualBrandIdentity,
  options?: {
    applyColorGrading?: boolean;
    applyWatermark?: boolean;
    watermarkPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
    watermarkOpacity?: number;
  }
): Promise<Buffer> {
  let processed = imageBuffer;

  if (options?.applyColorGrading !== false) {
    processed = await applyBrandColorGrading(processed, brand);
  }

  if (options?.applyWatermark !== false) {
    processed = await applyBrandWatermark(processed, brand, {
      position: options?.watermarkPosition,
      opacity: options?.watermarkOpacity,
    });
  }

  return processed;
}
