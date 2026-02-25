/**
 * Brand Identity Management
 * Functions for maintaining visual consistency across all generated content
 */

import { prisma } from "@/lib/prisma";

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
 * Note: This would use sharp to apply color grading
 */
export async function applyBrandColorGrading(
  _imageBuffer: Buffer,
  _brand: VisualBrandIdentity
): Promise<Buffer> {
  // TODO: Implement with sharp
  // - Adjust color temperature (warm/cool based on brand mood)
  // - Saturation levels
  // - Contrast
  // - Slight color tint toward brand palette
  throw new Error("Not implemented - requires sharp");
}

/**
 * Apply brand watermark to image
 */
export async function applyBrandWatermark(
  _imageBuffer: Buffer,
  _brand: VisualBrandIdentity
): Promise<Buffer> {
  // TODO: Implement with sharp
  // - Subtle logo in corner with opacity
  throw new Error("Not implemented - requires sharp");
}
