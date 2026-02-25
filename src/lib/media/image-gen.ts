import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { getDimensions } from "@/lib/ai/schemas/visual";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

interface VisualInput {
  organizationId: string;
  contentId: string;
  platform: string;
  contentType: string;
  mediaPrompt: string;
  brandConfig: {
    brandName: string;
    brandColors: { primary: string; secondary: string; accent: string } | null;
    industry: string;
  };
}

interface GeneratedImage {
  url: string;
  revisedPrompt: string;
}

export async function generateVisual(input: VisualInput): Promise<{
  success: boolean;
  mediaUrl?: string;
  altText?: string;
  error?: string;
}> {
  const { organizationId, contentId, platform, contentType, mediaPrompt, brandConfig } = input;

  if (!openai) {
    return { success: false, error: "OpenAI not configured" };
  }

  try {
    // Get dimensions for platform
    const dimensions = getDimensions(platform as any, contentType);

    // Enhance prompt with brand context
    const enhancedPrompt = enhancePrompt(mediaPrompt, brandConfig, platform);

    // Map dimensions to DALL-E supported sizes
    let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
    if (dimensions.height > dimensions.width) {
      size = "1024x1792"; // Vertical
    } else if (dimensions.width > 1080) {
      size = "1792x1024"; // Wide
    }

    // Generate image using DALL-E 3
    const response = await openai!.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size,
      quality: "standard",
      style: "natural",
    });

    const imageData = response.data?.[0] as GeneratedImage | undefined;
    
    if (!imageData?.url) {
      return { success: false, error: "No image URL returned" };
    }

    // Download the image
    const imageResponse = await fetch(imageData.url);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Upload to Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileName = `${contentId}-${Date.now()}.png`;
    const storagePath = `${organizationId}/media/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload to storage:", uploadError);
      return { success: false, error: "Failed to upload image" };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(storagePath);

    // Update content with media URL
    await prisma.content.update({
      where: { id: contentId },
      data: {
        mediaUrls: [urlData.publicUrl],
        mediaType: "IMAGE",
        altText: imageData.revisedPrompt || mediaPrompt,
      },
    });

    return {
      success: true,
      mediaUrl: urlData.publicUrl,
      altText: imageData.revisedPrompt || mediaPrompt,
    };
  } catch (error) {
    console.error("Image generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Image generation failed",
    };
  }
}

function enhancePrompt(
  raw: string,
  brand: { brandName: string; brandColors: { primary: string; secondary: string; accent: string } | null; industry: string },
  platform: string
): string {
  const enhancements: string[] = [raw];

  // Add brand colors if available
  if (brand.brandColors) {
    enhancements.push(`Brand colors: ${brand.brandColors.primary}, ${brand.brandColors.secondary}`);
  }

  // Add style guidance
  enhancements.push("Style: clean, modern, professional, high-quality photography");

  // Add industry context
  enhancements.push(`Suitable for ${brand.industry} industry`);

  // Platform-specific
  if (platform === "INSTAGRAM") {
    enhancements.push("Perfect for Instagram feed, visually striking");
  } else if (platform === "TIKTOK") {
    enhancements.push("Vertical format, eye-catching for short-form video platform");
  } else if (platform === "LINKEDIN") {
    enhancements.push("Professional, suitable for business audience");
  }

  // Quality modifiers
  enhancements.push("No text overlays, no watermarks, no stock photo feel");

  return enhancements.filter(Boolean).join(". ");
}
