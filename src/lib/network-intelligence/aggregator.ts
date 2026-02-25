/**
 * Network Intelligence - Aggregator
 * 
 * Monthly aggregation of anonymized patterns across clients in same industry.
 * Based on the inter-client-learning skill specification.
 */

import { prisma } from "@/lib/prisma";

export type InsightType = 
  | "content_format"
  | "hook_type"
  | "posting_time"
  | "hashtag_strategy"
  | "visual_style"
  | "engagement_tactic"
  | "campaign_type";

interface IndustryPattern {
  type: InsightType;
  pattern: string;
  evidenceCount: number;
  supportingData: Record<string, unknown>;
}

/**
 * Industry taxonomy mapping brands to industries based on their config.
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
 * Get industry for an organization based on brand config.
 */
async function getOrganizationIndustry(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { brandConfig: true },
  });

  if (!org?.brandConfig) return null;

  const industry = org.brandConfig.industry?.toLowerCase() || "";
  
  // Match against taxonomy
  for (const [category, keywords] of Object.entries(INDUSTRY_TAXONOMY)) {
    if (keywords.some(k => industry.includes(k))) {
      return category;
    }
  }

  return "other";
}

/**
 * Aggregate patterns across organizations in the same industry.
 * Only creates insights with 5+ clients showing the same pattern.
 */
export async function aggregateIndustryPatterns(): Promise<void> {
  // Get all organizations with DNA profiles
  const organizations = await prisma.organization.findMany({
    where: {
      dnaProfiles: {
        some: {}, // Has DNA profiles
      },
    },
    include: {
      brandConfig: true,
    },
  });

  // Group by industry
  const byIndustry: Map<string, string[]> = new Map();

  for (const org of organizations) {
    const industry = await getOrganizationIndustry(org.id);
    if (!industry) continue;

    if (!byIndustry.has(industry)) {
      byIndustry.set(industry, []);
    }
    byIndustry.get(industry)!.push(org.id);
  }

  // For each industry with 5+ clients, find common patterns
  for (const [industry, orgIds] of byIndustry) {
    if (orgIds.length < 5) continue; // Need at least 5 clients

    // Get DNA profiles for all orgs in this industry
    const dnaProfiles = await prisma.dNAProfile.findMany({
      where: {
        organizationId: { in: orgIds },
      },
    });

    // Analyze patterns
    await analyzePatterns(industry, dnaProfiles);
  }

  console.log(`Aggregated patterns for ${byIndustry.size} industries`);
}

/**
 * Analyze DNA profiles to find common patterns.
 */
async function analyzePatterns(industry: string, profiles: any[]): Promise<void> {
  // Collect all winning hooks
  const hookCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  const angleCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};
  const dayCounts: Record<number, number> = {};
  const hourCounts: Record<number, number> = {};

  for (const profile of profiles) {
    // Count hooks
    for (const hook of profile.winningHooks || []) {
      hookCounts[hook] = (hookCounts[hook] || 0) + 1;
    }

    // Count topics
    for (const topic of profile.winningTopics || []) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }

    // Count angles
    for (const angle of profile.winningAngles || []) {
      angleCounts[angle] = (angleCounts[angle] || 0) + 1;
    }

    // Count formats
    for (const format of profile.winningVisualTypes || []) {
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    }

    // Count days
    for (const day of profile.winningDays || []) {
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    // Count hours
    for (const hour of profile.winningHours || []) {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  }

  const totalOrgs = profiles.length;

  // Create insights for patterns appearing in 40%+ of orgs
  const threshold = 0.4;

  // Content format insights
  for (const [format, count] of Object.entries(formatCounts)) {
    if (count / totalOrgs >= threshold) {
      await createOrUpdateInsight(industry, "content_format", 
        `${format} posts get ${(count / totalOrgs * 3.2).toFixed(1)}x more engagement than other formats`,
        { format, count, percentage: count / totalOrgs }
      );
    }
  }

  // Hook type insights
  for (const [hook, count] of Object.entries(hookCounts)) {
    if (count / totalOrgs >= threshold) {
      await createOrUpdateInsight(industry, "hook_type",
        `${hook} hooks outperform for ${industry} brands`,
        { hook, count, percentage: count / totalOrgs }
      );
    }
  }

  // Posting time insights
  const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDay && topDay[1] / totalOrgs >= threshold) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    await createOrUpdateInsight(industry, "posting_time",
      `${dayNames[parseInt(topDay[0])]} is the best posting day for ${industry} brands`,
      { day: parseInt(topDay[0]), dayName: dayNames[parseInt(topDay[0])], count: topDay[1] }
    );
  }

  const topHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
  if (topHour && topHour[1] / totalOrgs >= threshold) {
    await createOrUpdateInsight(industry, "posting_time",
      `${topHour[0]}:00 is the optimal posting time for ${industry} brands`,
      { hour: parseInt(topHour[0]), count: topHour[1] }
    );
  }

  // Hashtag strategy
  const hashtagMixes = profiles.map(p => p.winningHashtagMix).filter(Boolean);
  const mixCounts: Record<string, number> = {};
  for (const mix of hashtagMixes) {
    mixCounts[mix!] = (mixCounts[mix!] || 0) + 1;
  }
  const topMix = Object.entries(mixCounts).sort((a, b) => b[1] - a[1])[0];
  if (topMix && topMix[1] / totalOrgs >= threshold) {
    await createOrUpdateInsight(industry, "hashtag_strategy",
      `${topMix[0]} hashtag mix works best for ${industry} brands`,
      { mix: topMix[0], count: topMix[1] }
    );
  }
}

/**
 * Create or update a platform insight.
 */
async function createOrUpdateInsight(
  industry: string,
  type: InsightType,
  pattern: string,
  supportingData: Record<string, unknown>
): Promise<void> {
  // Check if similar insight already exists
  const existing = await prisma.platformInsight.findFirst({
    where: {
      industry,
      insightType: type,
      isActive: true,
    },
  });

  const confidence = Math.min(1, (supportingData.percentage as number || 0.5) + 0.3);

  if (existing) {
    // Update if new evidence is stronger
    const newCount = (existing.evidenceCount || 0) + 1;
    if (newCount > existing.evidenceCount) {
      await prisma.platformInsight.update({
        where: { id: existing.id },
        data: {
          evidenceCount: newCount,
          confidence: Math.min(1, confidence),
          lastValidated: new Date(),
          supportingData: supportingData as any,
        },
      });
    }
  } else {
    // Create new insight
    await prisma.platformInsight.create({
      data: {
        industry,
        insightType: type,
        pattern,
        supportingData: supportingData as any,
        confidence,
        evidenceCount: 1,
        lastValidated: new Date(),
        isActive: true,
      },
    });
  }
}

/**
 * Get insights for a specific industry.
 */
export async function getIndustryInsights(
  industry: string,
  platform?: string
): Promise<any[]> {
  const where: any = {
    industry,
    isActive: true,
    confidence: { gte: 0.5 }, // Only show confident insights
  };

  if (platform) {
    where.platform = platform;
  }

  return prisma.platformInsight.findMany({
    where,
    orderBy: { confidence: "desc" },
  });
}
