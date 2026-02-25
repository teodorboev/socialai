/**
 * Asset Manager
 * Handles brand asset uploads, storage, and auto-tagging
 */

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/client";

interface AssetUploadData {
  organizationId: string;
  file: Buffer;
  fileName: string;
  mimeType: string;
  description: string;
  uploadedBy?: string;
}

interface AssetAnalysis {
  type: string;
  description: string;
  colors?: string[];
  mood?: string;
  width?: number;
  height?: number;
}

/**
 * Upload a brand asset to Supabase Storage
 */
export async function uploadAsset(data: AssetUploadData): Promise<string> {
  const supabase = createClient();
  
  const path = `${data.organizationId}/${Date.now()}-${data.fileName}`;
  
  const { data: uploadData, error } = await supabase.storage
    .from("brand-assets")
    .upload(path, data.file, {
      contentType: data.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload asset: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("brand-assets")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Analyze an image to extract tags and metadata
 * Note: This would use Claude Vision API
 */
export async function analyzeImage(_file: Buffer): Promise<AssetAnalysis> {
  // TODO: Implement with Claude Vision API
  // const response = await anthropic.messages.create({
  //   model: "claude-3-5-sonnet-20241022",
  //   max_tokens: 1024,
  //   messages: [{
  //     role: "user",
  //     content: [
  //       { type: "image", source: { type: "base64", data: file.toString("base64") } },
  //       { type: "text", text: "Analyze this image and describe: 1) What type of image is this (product photo, lifestyle, logo, etc.)? 2) What colors are dominant? 3) What mood/feeling does it convey? 4) What products or subjects are shown?" }
  //     ]
  //   }]
  // });
  
  throw new Error("Image analysis not implemented - requires ANTHROPIC_API_KEY");
}

/**
 * Handle asset upload from Talk to AI
 */
export async function handleAssetUpload(
  organizationId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  description: string,
  uploadedBy?: string
): Promise<{
  assetId: string;
  tags: string[];
}> {
  // 1. Upload to storage
  const storageUrl = await uploadAsset({
    organizationId,
    file,
    fileName,
    mimeType,
    description,
    uploadedBy,
  });

  // 2. Analyze the image
  let analysis: AssetAnalysis;
  try {
    analysis = await analyzeImage(file);
  } catch {
    // If analysis fails, use basic info
    analysis = {
      type: mimeType.startsWith("image/") ? "lifestyle_photo" : "other",
      description: description,
    };
  }

  // 3. Auto-generate tags based on description + analysis
  const tags = generateTags(analysis, description);

  // 4. Determine asset type
  const assetType = determineAssetType(analysis, description, fileName);

  // 5. Create BrandAsset record
  const asset = await prisma.brandAsset.create({
    data: {
      organizationId,
      type: assetType,
      name: description,
      description: analysis.description,
      storageUrl,
      mimeType,
      tags,
      width: analysis.width,
      height: analysis.height,
      uploadedBy,
    },
  });

  // 6. If it's a logo, update VisualBrandIdentity
  if (assetType === "logo") {
    await prisma.visualBrandIdentity.upsert({
      where: { organizationId },
      update: { logoUrl: storageUrl },
      create: {
        organizationId,
        logoUrl: storageUrl,
      },
    });
  }

  return { assetId: asset.id, tags };
}

/**
 * Generate tags based on analysis and description
 */
function generateTags(analysis: AssetAnalysis, description: string): string[] {
  const tags: string[] = [];

  // Add type-based tags
  if (analysis.type) {
    tags.push(analysis.type);
  }

  // Extract keywords from description
  const keywords = description.toLowerCase().split(/\s+/);
  const usefulKeywords = ["product", "lifestyle", "hero", "summer", "winter", "sale", "new", "launch", "featured"];
  keywords.forEach(kw => {
    if (usefulKeywords.some(uk => kw.includes(uk))) {
      tags.push(kw);
    }
  });

  // Add color tags if detected
  if (analysis.colors) {
    analysis.colors.forEach(color => {
      tags.push(`color:${color}`);
    });
  }

  // Add mood tags
  if (analysis.mood) {
    tags.push(`mood:${analysis.mood}`);
  }

  return [...new Set(tags)]; // Deduplicate
}

/**
 * Determine asset type based on analysis and filename
 */
function determineAssetType(analysis: AssetAnalysis, description: string, fileName: string): string {
  const lowerDesc = description.toLowerCase();
  const lowerFile = fileName.toLowerCase();

  if (lowerDesc.includes("logo") || lowerFile.includes("logo")) {
    return "logo";
  }

  if (analysis.type?.includes("product") || lowerDesc.includes("product") || lowerFile.includes("product")) {
    return "product_photo";
  }

  if (lowerDesc.includes("lifestyle") || lowerFile.includes("lifestyle")) {
    return "lifestyle_photo";
  }

  if (lowerFile.includes("icon")) {
    return "icon";
  }

  if (lowerFile.includes("pattern") || lowerFile.includes("texture")) {
    return "pattern";
  }

  return "lifestyle_photo"; // Default
}

/**
 * Find relevant assets for content
 */
export async function findRelevantAssets(
  organizationId: string,
  content: {
    caption: string;
    contentType: string;
    topic?: string;
  }
): Promise<Array<{ id: string; type: string; storageUrl: string; score: number }>> {
  const captionLower = content.caption.toLowerCase();
  const relevantTypes: Record<string, string[]> = {
    product_photo: ["product", "shop", "buy", "new", "launch"],
    lifestyle_photo: ["lifestyle", "behind", "day", "team", "process"],
    icon: ["tip", "how", "way"],
  };

  // Find assets that match content
  const assets = await prisma.brandAsset.findMany({
    where: {
      organizationId,
      type: { in: Object.keys(relevantTypes) },
    },
  });

  // Score each asset
  const scored = assets.map((asset: { id: string; type: string; storageUrl: string; tags: string[]; usageCount: number }) => {
    let score = 0;
    
    // Type relevance
    for (const [type, keywords] of Object.entries(relevantTypes)) {
      if (asset.type === type && keywords.some(kw => captionLower.includes(kw))) {
        score += 10;
      }
    }

    // Tag relevance
    asset.tags.forEach((tag: string) => {
      if (captionLower.includes(tag)) {
        score += 5;
      }
    });

    // Usage count boost
    score += Math.min(asset.usageCount, 20);

    return {
      id: asset.id,
      type: asset.type,
      storageUrl: asset.storageUrl,
      score,
    };
  });

  // Sort by score and return top matches
  return scored
    .filter((a: { score: number }) => a.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Record asset usage (for tracking which assets are most used)
 */
export async function recordAssetUsage(assetId: string): Promise<void> {
  await prisma.brandAsset.update({
    where: { id: assetId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}
