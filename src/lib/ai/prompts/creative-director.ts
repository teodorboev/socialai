/**
 * Creative Director System Prompt Template
 * 
 * This template is used to construct the system prompt for the Creative Director agent.
 * It provides all brand identity information needed to generate consistent visuals.
 */

import { getBrandIdentity } from "@/lib/visual/brand-identity";
import { findRelevantAssets } from "@/lib/visual/asset-manager";

export interface CreativeDirectorPromptOptions {
  organizationId: string;
  brandName: string;
  caption: string;
  platform: string;
  contentType: string;
  tone?: string;
  topic?: string;
}

/**
 * Build the system prompt for Creative Director
 */
export async function buildCreativeDirectorPrompt(
  options: CreativeDirectorPromptOptions
): Promise<{
  systemPrompt: string;
  brandContext: Record<string, unknown>;
  relevantAssets: unknown[];
}> {
  const { organizationId, brandName, caption, platform, contentType, tone = "professional", topic } = options;

  // Get brand identity
  const brand = await getBrandIdentity(organizationId);
  const brandContext = brand as Record<string, unknown> || {};

  // Get relevant assets
  const assets = await findRelevantAssets(organizationId, {
    caption,
    contentType,
    topic,
  });

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    brandName,
    brand: brandContext,
    assets,
    caption,
    platform,
    contentType,
    tone,
    topic,
  });

  return {
    systemPrompt,
    brandContext,
    relevantAssets: assets,
  };
}

/**
 * Build the core system prompt
 */
function buildSystemPrompt(params: {
  brandName: string;
  brand: Record<string, unknown>;
  assets: unknown[];
  caption: string;
  platform: string;
  contentType: string;
  tone: string;
  topic?: string;
}): string {
  const { brandName, brand, assets, caption, platform, contentType, tone, topic } = params;

  const primaryColor = (brand.primaryColor as string) || "#000000";
  const secondaryColor = (brand.secondaryColor as string) || "#FFFFFF";
  const accentColor = (brand.accentColor as string) || "#808080";
  const headingFont = (brand.headingFont as string) || "Inter";
  const bodyFont = (brand.bodyFont as string) || "Inter";
  const photoStyle = (brand.photoStyle as string) || "";
  const photoMood = (brand.photoMood as string) || "";
  const photoSubjects = (brand.photoSubjects as string[]) || [];
  const photoAvoid = (brand.photoAvoid as string[]) || [];
  const preferMinimalDesign = brand.preferMinimalDesign as boolean ?? true;
  const textOverlayStyle = (brand.textOverlayStyle as string) || "clean";
  const illustrationStyle = brand.illustrationStyle as string | undefined;
  const useIllustrations = brand.useIllustrations as boolean ?? false;

  const assetsList = assets.length > 0
    ? assets.map((a: any) => `- [${a.type}] ${a.name}: ${a.description || ""} (tags: ${(a.tags || []).join(", ")})`).join("\n")
    : "No brand assets uploaded yet.";

  return `You are the creative director for ${brandName}. You design ALL visual content.

VISUAL BRAND IDENTITY:
- Colors: Primary ${primaryColor}, Secondary ${secondaryColor}, Accent ${accentColor}
- Fonts: ${headingFont} for headings, ${bodyFont} for body text
- Photo style: ${photoStyle}
- Photo mood: ${photoMood}
- Preferred subjects: ${photoSubjects.join(", ") || "varies by content"}
- AVOID: ${photoAvoid.join(", ") || "nothing specified"}
- Layout: ${preferMinimalDesign ? "Clean, minimal, lots of whitespace" : "Rich, detailed layouts"}
- Text overlay style: ${textOverlayStyle}
${illustrationStyle ? `- Illustration style: ${illustrationStyle}` : ""}
${useIllustrations ? "- Illustrations are part of your brand vocabulary" : ""}

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
${assetsList}
Use these whenever they're relevant. Reference them by ID: asset:\${assetId}

CONTENT TO VISUALIZE:
Caption: "${caption}"
Platform: ${platform}
Content type: ${contentType}
Tone: ${tone}
${topic ? `Topic: ${topic}` : ""}

Generate visuals that perfectly match this content while staying true to the brand identity.`;
}

/**
 * Get the brand style guide as a formatted string
 */
export function getBrandStyleGuide(brand: Record<string, unknown>): string {
  const parts: string[] = [];

  // Colors
  const primaryColor = brand.primaryColor as string;
  const secondaryColor = brand.secondaryColor as string;
  const accentColor = brand.accentColor as string;
  
  if (primaryColor) parts.push(`Primary: ${primaryColor}`);
  if (secondaryColor) parts.push(`Secondary: ${secondaryColor}`);
  if (accentColor) parts.push(`Accent: ${accentColor}`);

  // Typography
  const headingFont = brand.headingFont as string;
  const bodyFont = brand.bodyFont as string;
  
  if (headingFont || bodyFont) {
    parts.push(`Typography: ${headingFont || "Inter"}/${bodyFont || "Inter"}`);
  }

  // Photo style
  const photoStyle = brand.photoStyle as string;
  const photoMood = brand.photoMood as string;
  
  if (photoStyle) parts.push(`Photo style: ${photoStyle}`);
  if (photoMood) parts.push(`Mood: ${photoMood}`);

  // Layout
  const preferMinimal = brand.preferMinimalDesign as boolean;
  if (preferMinimal !== undefined) {
    parts.push(`Design: ${preferMinimal ? "Minimal" : "Detailed"}`);
  }

  return parts.join(" | ");
}

/**
 * Format brand assets for prompt inclusion
 */
export function formatBrandAssets(assets: Array<{ id: string; type: string; name: string; tags: string[] }>): string {
  if (assets.length === 0) {
    return "No brand assets available.";
  }

  return assets
    .map(a => `- [${a.type}] ${a.name} (ID: ${a.id}, tags: ${a.tags.join(", ")})`)
    .join("\n");
}
