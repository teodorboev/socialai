/**
 * Image Generation with Provider Abstraction
 * Supports multiple AI image providers: DALL-E 3, Flux, Ideogram
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Initialize clients
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
  : null;

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: "standard" | "hd";
  style?: "natural" | "vivid" | "auto";
  n?: number;
}

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
  provider: string;
  cost: number;
  width: number;
  height: number;
}

/**
 * Base interface for image generation providers
 */
export interface ImageGenerationProvider {
  name: string;
  generate(
    prompt: string, 
    options?: ImageOptions,
    organizationId?: string,
    contentId?: string
  ): Promise<GeneratedImage>;
}

/**
 * Get Supabase storage client for uploads
 */
function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Upload generated image to Supabase Storage
 */
async function uploadToStorage(
  imageBuffer: Buffer,
  organizationId: string,
  contentId: string,
  provider: string
): Promise<string> {
  const supabase = getStorageClient();
  const fileName = `${contentId}-${provider}-${Date.now()}.png`;
  const storagePath = `generated-visuals/${organizationId}/${fileName}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("media")
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * DALL-E 3 Provider
 */
class DallE3Provider implements ImageGenerationProvider {
  name = "dall-e-3";

  async generate(
    prompt: string,
    options?: ImageOptions,
    organizationId?: string,
    contentId?: string
  ): Promise<GeneratedImage> {
    if (!openai) {
      throw new Error("OpenAI not configured - set OPENAI_API_KEY");
    }

    // Map dimensions to DALL-E supported sizes
    const width = options?.width || 1024;
    const height = options?.height || 1024;
    
    let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
    if (height > width) {
      size = "1024x1792";
    } else if (width > 1080) {
      size = "1792x1024";
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: options?.n || 1,
      size,
      quality: options?.quality || "standard",
      style: (options?.style || "vivid") as "natural" | "vivid",
    });

    const imageData = response.data?.[0];
    if (!imageData?.url) {
      throw new Error("No image URL returned from DALL-E");
    }

    // Calculate cost
    const cost = this.calculateCost(size, options?.quality || "standard");

    // If we have org/content IDs, upload to storage
    let storageUrl = imageData.url;
    if (organizationId && contentId) {
      try {
        const imageBuffer = await downloadImage(imageData.url);
        storageUrl = await uploadToStorage(imageBuffer, organizationId, contentId, this.name);
      } catch (error) {
        console.error("Failed to upload to storage, using original URL:", error);
      }
    }

    return {
      url: storageUrl,
      revisedPrompt: imageData.revised_prompt,
      provider: this.name,
      cost,
      width,
      height,
    };
  }

  private calculateCost(size: string, quality: string): number {
    const baseCosts: Record<string, number> = {
      "1024x1024": 0.04,
      "1792x1024": 0.08,
      "1024x1792": 0.08,
    };
    const qualityMultiplier = quality === "hd" ? 2 : 1;
    return (baseCosts[size] || 0.04) * qualityMultiplier;
  }
}

/**
 * Flux Provider via Replicate API
 */
class FluxProvider implements ImageGenerationProvider {
  name = "flux";

  async generate(
    prompt: string,
    options?: ImageOptions,
    organizationId?: string,
    contentId?: string
  ): Promise<GeneratedImage> {
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      throw new Error("Replicate not configured - set REPLICATE_API_TOKEN");
    }

    const width = options?.width || 1024;
    const height = options?.height || 1024;

    // Use Flux Pro via Replicate
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "fdf8f1f7b9c9e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6e5b6", // flux-pro version
        input: {
          prompt,
          width,
          height,
          num_inference_steps: 28,
          guidance_scale: 3.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Flux generation failed: ${error}`);
    }

    const prediction = await response.json();
    
    // Poll for result
    let result = prediction;
    while (result.status === "starting" || result.status === "processing") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await fetch(prediction.urls.status, {
        headers: { "Authorization": `Bearer ${replicateToken}` },
      });
      result = await statusResponse.json();
    }

    if (result.status !== "succeeded") {
      throw new Error(`Flux generation failed: ${result.status}`);
    }

    const imageUrl = result.output?.[0];
    if (!imageUrl) {
      throw new Error("No image URL returned from Flux");
    }

    const cost = 0.05; // Approximate Flux cost

    // If we have org/content IDs, upload to storage
    let storageUrl = imageUrl;
    if (organizationId && contentId) {
      try {
        const imageBuffer = await downloadImage(imageUrl);
        storageUrl = await uploadToStorage(imageBuffer, organizationId, contentId, this.name);
      } catch (error) {
        console.error("Failed to upload to storage, using original URL:", error);
      }
    }

    return {
      url: storageUrl,
      provider: this.name,
      cost,
      width,
      height,
    };
  }
}

/**
 * Ideogram Provider - best for text in images
 */
class IdeogramProvider implements ImageGenerationProvider {
  name = "ideogram";

  async generate(
    prompt: string,
    options?: ImageOptions,
    organizationId?: string,
    contentId?: string
  ): Promise<GeneratedImage> {
    const ideogramKey = process.env.IDEOGRAM_API_KEY;
    if (!ideogramKey) {
      throw new Error("Ideogram not configured - set IDEOGRAM_API_KEY");
    }

    const width = options?.width || 1024;
    const height = options?.height || 1024;

    const response = await fetch("https://api.ideogram.ai/v1/ideogram-v2", {
      method: "POST",
      headers: {
        "Api-Key": ideogramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        aspect_ratio: `${width}:${height}`,
        style: "natural",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ideogram generation failed: ${error}`);
    }

    const result = await response.json();
    const imageUrl = result.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error("No image URL returned from Ideogram");
    }

    const cost = 0.02; // Approximate Ideogram cost

    // If we have org/content IDs, upload to storage
    let storageUrl = imageUrl;
    if (organizationId && contentId) {
      try {
        const imageBuffer = await downloadImage(imageUrl);
        storageUrl = await uploadToStorage(imageBuffer, organizationId, contentId, this.name);
      } catch (error) {
        console.error("Failed to upload to storage, using original URL:", error);
      }
    }

    return {
      url: storageUrl,
      provider: this.name,
      cost,
      width,
      height,
    };
  }
}

/**
 * Provider registry
 */
const providers: Record<string, ImageGenerationProvider> = {
  "dall-e-3": new DallE3Provider(),
  "flux": new FluxProvider(),
  "ideogram": new IdeogramProvider(),
};

/**
 * Get provider by name
 */
export function getProvider(name: string): ImageGenerationProvider | undefined {
  return providers[name.toLowerCase()];
}

/**
 * Select best provider based on visual type
 */
export function selectProvider(visualType: string): string {
  switch (visualType) {
    case "text_overlay":
    case "infographic":
      return "ideogram"; // Best at rendering text
    case "ai_generated":
      return "flux"; // Best photorealism
    case "meme":
      return "dall-e-3"; // Good at creative/unusual compositions
    default:
      return "flux";
  }
}

/**
 * Generate image with automatic provider selection
 */
export async function generateImage(
  prompt: string,
  visualType: string,
  options?: ImageOptions,
  organizationId?: string,
  contentId?: string
): Promise<GeneratedImage> {
  const providerName = selectProvider(visualType);
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  return provider.generate(prompt, options, organizationId, contentId);
}

/**
 * Generate multiple variants for A/B testing
 */
export async function generateVariants(
  prompt: string,
  visualType: string,
  count: number = 3,
  organizationId?: string,
  contentId?: string
): Promise<GeneratedImage[]> {
  const providerName = selectProvider(visualType);
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  // Generate in parallel
  const results = await Promise.all(
    Array(count).fill(0).map((_, i) => 
      provider.generate(
        prompt, 
        { quality: "standard", n: 1 },
        organizationId,
        contentId ? `${contentId}-variant-${i}` : undefined
      ).catch((error) => {
        console.error(`Variant ${i} generation failed:`, error);
        return null;
      })
    )
  );

  return results.filter((r): r is GeneratedImage => r !== null);
}

/**
 * Estimate generation cost
 */
export function estimateCost(provider: string, size: string = "1024x1024"): number {
  const costs: Record<string, Record<string, number>> = {
    "dall-e-3": {
      "1024x1024": 0.04,
      "1792x1024": 0.08,
      "1024x1792": 0.08,
    },
    "flux": {
      "1024x1024": 0.05,
    },
    "ideogram": {
      "1024x1024": 0.02,
    },
  };

  return costs[provider]?.[size] || 0.05;
}

/**
 * Calculate total cost for multiple images
 */
export function calculateTotalCost(images: GeneratedImage[]): number {
  return images.reduce((sum, img) => sum + img.cost, 0);
}
