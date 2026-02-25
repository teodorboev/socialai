/**
 * Network Intelligence - Warm Start
 * 
 * Injects industry insights into new client's first Content Creator prompts.
 * Based on the inter-client-learning skill specification.
 */

import { prisma } from "@/lib/prisma";
import { getIndustryInsights } from "./aggregator";

/**
 * Industry taxonomy mapping
 */
const INDUSTRY_TAXONOMY: Record<string, string[]> = {
  skincare: ["beauty", "skincare", "cosmetics", "wellness", "self-care"],
  food: ["food", "restaurant", "catering", "nutrition", "recipe", "meal"],
  tech: ["tech", "software", "app", "saas", "technology", "digital"],
  fitness: ["fitness", "gym", "workout", "training", "health"],
  fashion: ["fashion", "clothing", "apparel", "style", "retail"],
  business: ["business", "consulting", "services", "b2b"],
  marketing: ["marketing", "agency", "digital marketing", "social media"],
  education: ["education", "learning", "course", "tutoring"],
  healthcare: ["healthcare", "medical", "health", "wellness"],
  realestate: ["real estate", "property", "realty"],
  finance: ["finance", "banking", "investment", "fintech"],
};

/**
 * Get industry for an organization.
 */
function getIndustryFromConfig(industry: string | null): string {
  if (!industry) return "other";
  
  const lower = industry.toLowerCase();
  
  for (const [category, keywords] of Object.entries(INDUSTRY_TAXONOMY)) {
    if (keywords.some(k => lower.includes(k))) {
      return category;
    }
  }
  
  return "other";
}

/**
 * Generate warm start context for a new client's first content.
 */
export async function getWarmStartContext(
  organizationId: string,
  platform?: string
): Promise<string> {
  // Get the organization's brand config to determine industry
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { brandConfig: true },
  });

  if (!org?.brandConfig) {
    return ""; // No brand config yet
  }

  const industry = getIndustryFromConfig(org.brandConfig.industry);

  // Get industry insights
  const insights = await getIndustryInsights(industry, platform);

  if (insights.length === 0) {
    return "";
  }

  // Format insights for prompt injection
  const formattedInsights = insights
    .slice(0, 5) // Limit to top 5 insights
    .map(insight => {
      let platformNote = "";
      if (insight.platform) {
        platformNote = ` (on ${insight.platform})`;
      }
      return `• ${insight.pattern}${platformNote} [${(insight.confidence * 100).toFixed(0)}% confidence]`;
    })
    .join("\n");

  return `
═══════════════════════════════════════════════════════════════
INDUSTRY INTELLIGENCE (from ${insights.length} similar brands)
═══════════════════════════════════════════════════════════════
${formattedInsights}

These patterns were learned from anonymized data across multiple brands in the ${industry} industry. Consider incorporating these insights while maintaining your unique brand voice.
`;
}

/**
 * Check if a client is new enough to receive warm start.
 * (First 30 days or first 10 posts)
 */
export async function isEligibleForWarmStart(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      content: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!org) return false;

  // Check if org is less than 30 days old
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  if (org.createdAt > thirtyDaysAgo) {
    return true;
  }

  // Or has fewer than 10 published posts
  const postCount = await prisma.content.count({
    where: {
      organizationId,
      status: "PUBLISHED",
    },
  });

  return postCount < 10;
}
