/**
 * DNA Profile Builder
 * 
 * Weekly aggregation of fingerprints into winning/losing formulas.
 * Builds a DNA profile that Content Creator uses to engineer successful content.
 * 
 * Based on the content-dna skill specification.
 */

import { prisma } from "@/lib/prisma";

interface WinningPattern {
  hookType?: string;
  topic?: string;
  angle?: string;
  structure?: string;
  visualType?: string;
  dayOfWeek?: number;
  hourOfDay?: number;
  hashtagMix?: string;
}

interface LosingPattern {
  hookType?: string;
  topic?: string;
  angle?: string;
}

/**
 * Build DNA profile for an organization's platform.
 * Analyzes all evaluated fingerprints to find winning/losing patterns.
 */
export async function buildDNAProfile(
  organizationId: string,
  platform: string
): Promise<void> {
  // Get all evaluated fingerprints for this org/platform
  const fingerprints = await prisma.contentFingerprint.findMany({
    where: {
      organizationId,
      platform: platform as any,
      evaluatedAt: { not: null },
    },
    orderBy: {
      evaluatedAt: "desc",
    },
    take: 100, // Last 100 posts
  });
  
  if (fingerprints.length < 5) {
    console.log(`Not enough data to build DNA profile for ${organizationId}/${platform}`);
    return;
  }
  
  // Calculate stats
  const totalPosts = fingerprints.length;
  const hits = fingerprints.filter((fp: { percentileRank: number | null }) => (fp.percentileRank ?? 0) > 70).length;
  const hitRate = hits / totalPosts;
  const avgEngagement = fingerprints.reduce((sum: number, fp: { engagementRate: number | null }) => sum + (fp.engagementRate ?? 0), 0) / totalPosts;
  
  // Find winning patterns (percentile > 70)
  const winningFingerprints = fingerprints.filter((fp: { percentileRank: number | null }) => (fp.percentileRank ?? 0) > 70);
  const winningHooks = [...new Set(winningFingerprints.map((fp: { hookType: string }) => fp.hookType))];
  const winningTopics = [...new Set(winningFingerprints.map((fp: { topic: string }) => fp.topic))];
  const winningAngles = [...new Set(winningFingerprints.map((fp: { angle: string }) => fp.angle))];
  const winningStructures = [...new Set(winningFingerprints.map((fp: { structure: string }) => fp.structure))];
  const winningVisualTypes = [...new Set(winningFingerprints.map((fp: { visualType: string | null }) => fp.visualType).filter(Boolean))];
  const winningDays = [...new Set(winningFingerprints.map((fp: { dayOfWeek: number }) => fp.dayOfWeek))];
  const winningHours = [...new Set(winningFingerprints.map((fp: { hourOfDay: number }) => fp.hourOfDay))];
  const winningHashtagMixes = [...new Set(winningFingerprints.map((fp: { hashtagMix: string | null }) => fp.hashtagMix).filter(Boolean))];
  
  // Find losing patterns (percentile < 30)
  const losingFingerprints = fingerprints.filter((fp: { percentileRank: number | null }) => (fp.percentileRank ?? 0) < 30);
  const losingHooks = [...new Set(losingFingerprints.map((fp: { hookType: string }) => fp.hookType))];
  const losingTopics = [...new Set(losingFingerprints.map((fp: { topic: string }) => fp.topic))];
  const losingAngles = [...new Set(losingFingerprints.map((fp: { angle: string }) => fp.angle))];
  
  // Calculate fatigue scores
  // Recent topics/hooks get higher fatigue to encourage variety
  const topicFatigue = calculateFatigue(fingerprints.map((fp: { topic: string }) => fp.topic));
  const hookFatigue = calculateFatigue(fingerprints.map((fp: { hookType: string }) => fp.hookType));
  const angleFatigue = calculateFatigue(fingerprints.map((fp: { angle: string }) => fp.angle));
  
  // Upsert DNA profile
  await prisma.dNAProfile.upsert({
    where: {
      organizationId_platform: {
        organizationId,
        platform,
      },
    },
    create: {
      organizationId,
      platform,
      winningHooks,
      winningTopics,
      winningAngles,
      winningStructures,
      winningVisualTypes,
      winningDays,
      winningHours,
      winningHashtagMix: winningHashtagMixes[0] ?? null,
      losingHooks,
      losingTopics,
      losingAngles,
      hookFatigue: hookFatigue as any,
      topicFatigue: topicFatigue as any,
      angleFatigue: angleFatigue as any,
      totalPostsAnalyzed: totalPosts,
      hitRate,
      avgEngagement,
    },
    update: {
      winningHooks,
      winningTopics,
      winningAngles,
      winningStructures,
      winningVisualTypes,
      winningDays,
      winningHours,
      winningHashtagMix: winningHashtagMixes[0] ?? null,
      losingHooks,
      losingTopics,
      losingAngles,
      hookFatigue: hookFatigue as any,
      topicFatigue: topicFatigue as any,
      angleFatigue: angleFatigue as any,
      totalPostsAnalyzed: totalPosts,
      hitRate,
      avgEngagement,
      lastUpdatedAt: new Date(),
    },
  });
  
  console.log(`DNA profile updated for ${organizationId}/${platform}: ${hits}/${totalPosts} hits (${(hitRate * 100).toFixed(1)}%)`);
}

/**
 * Calculate fatigue scores for a dimension.
 * Recent items get higher fatigue (0.8-1.0), older items get lower (0.0-0.5).
 */
function calculateFatigue(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const now = Date.now();
  
  // Count occurrences
  values.forEach((v, i) => {
    counts[v] = (counts[v] || 0) + 1;
  });
  
  // Calculate fatigue: more recent = higher fatigue
  const fatigue: Record<string, number> = {};
  const uniqueValues = [...new Set(values)];
  
  uniqueValues.forEach((v, index) => {
    // More recent items (higher index) get higher fatigue
    // Normalize to 0.3-1.0 range
    const recency = index / Math.max(values.length - 1, 1);
    const frequency = (counts[v] || 1) / values.length;
    
    // Fatigue = recency * 0.7 + frequency * 0.3
    fatigue[v] = Math.min(1, Math.max(0.3, recency * 0.7 + frequency * 0.3));
  });
  
  return fatigue;
}

/**
 * Get DNA profile for an organization/platform.
 * Used by Content Creator to generate on-brand content.
 */
export async function getDNAProfile(
  organizationId: string,
  platform: string
): Promise<{
  winning: {
    hooks: string[];
    topics: string[];
    angles: string[];
    structures: string[];
    visualTypes: string[];
    days: number[];
    hours: number[];
    hashtagMix: string | null;
  };
  losing: {
    hooks: string[];
    topics: string[];
    angles: string[];
  };
  fatigue: {
    hooks: Record<string, number>;
    topics: Record<string, number>;
    angles: Record<string, number>;
  };
  stats: {
    totalPosts: number;
    hitRate: number;
    avgEngagement: number;
  };
} | null> {
  const profile = await prisma.dNAProfile.findUnique({
    where: {
      organizationId_platform: {
        organizationId,
        platform,
      },
    },
  });
  
  if (!profile) return null;
  
  return {
    winning: {
      hooks: profile.winningHooks,
      topics: profile.winningTopics,
      angles: profile.winningAngles,
      structures: profile.winningStructures,
      visualTypes: profile.winningVisualTypes,
      days: profile.winningDays,
      hours: profile.winningHours,
      hashtagMix: profile.winningHashtagMix,
    },
    losing: {
      hooks: profile.losingHooks,
      topics: profile.losingTopics,
      angles: profile.losingAngles,
    },
    fatigue: {
      hooks: profile.hookFatigue as Record<string, number>,
      topics: profile.topicFatigue as Record<string, number>,
      angles: profile.angleFatigue as Record<string, number>,
    },
    stats: {
      totalPosts: profile.totalPostsAnalyzed,
      hitRate: profile.hitRate,
      avgEngagement: profile.avgEngagement,
    },
  };
}

/**
 * Get recommended DNA for new content.
 * Considers winning patterns but avoids high-fatigue items.
 */
export async function getRecommendedDNA(
  organizationId: string,
  platform: string
): Promise<{
  recommendedHooks: string[];
  recommendedTopics: string[];
  recommendedAngles: string[];
  recommendedDays: number[];
  recommendedHours: number[];
  avoidHooks: string[];
  avoidTopics: string[];
  avoidAngles: string[];
}> {
  const profile = await getDNAProfile(organizationId, platform);
  
  if (!profile) {
    // No profile yet - return empty recommendations
    return {
      recommendedHooks: [],
      recommendedTopics: [],
      recommendedAngles: [],
      recommendedDays: [1, 2, 3, 4, 5], // Weekdays
      recommendedHours: [9, 12, 17], // Morning, lunch, evening
      avoidHooks: [],
      avoidTopics: [],
      avoidAngles: [],
    };
  }
  
  // Filter out high-fatigue items from recommendations
  const recommendedHooks = profile.winning.hooks.filter(
    h => (profile.fatigue.hooks[h] ?? 0) < 0.7
  );
  const recommendedTopics = profile.winning.topics.filter(
    t => (profile.fatigue.topics[t] ?? 0) < 0.7
  );
  const recommendedAngles = profile.winning.angles.filter(
    a => (profile.fatigue.angles[a] ?? 0) < 0.7
  );
  
  // Items with >0.8 fatigue should be avoided
  const avoidHooks = Object.entries(profile.fatigue.hooks)
    .filter(([, score]) => score > 0.8)
    .map(([hook]) => hook);
  const avoidTopics = Object.entries(profile.fatigue.topics)
    .filter(([, score]) => score > 0.8)
    .map(([topic]) => topic);
  const avoidAngles = Object.entries(profile.fatigue.angles)
    .filter(([, score]) => score > 0.8)
    .map(([angle]) => angle);
  
  return {
    recommendedHooks,
    recommendedTopics,
    recommendedAngles,
    recommendedDays: profile.winning.days,
    recommendedHours: profile.winning.hours,
    avoidHooks,
    avoidTopics,
    avoidAngles,
  };
}

/**
 * Build DNA profiles for all orgs and platforms.
 * Run weekly via Orchestrator.
 */
export async function rebuildAllDNAProfiles(): Promise<void> {
  // Get all organizations with evaluated fingerprints
  const orgs = await prisma.organization.findMany({
    where: {
      contentFingerprints: {
        some: {
          evaluatedAt: { not: null },
        },
      },
    },
    select: {
      id: true,
    },
  });
  
  // Get unique platform combinations
  const platforms = await prisma.contentFingerprint.findMany({
    where: {
      evaluatedAt: { not: null },
    },
    select: {
      organizationId: true,
      platform: true,
    },
    distinct: ["organizationId", "platform"],
  });
  
  // Build profiles for each org/platform
  for (const { organizationId, platform } of platforms) {
    try {
      await buildDNAProfile(organizationId, platform);
    } catch (error) {
      console.error(`Failed to build DNA profile for ${organizationId}/${platform}:`, error);
    }
  }
  
  console.log(`DNA profiles rebuilt for ${platforms.length} org/platform combinations`);
}
