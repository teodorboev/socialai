/**
 * Post-Mortem Evaluator
 * 
 * Runs 7 days after a post is published to evaluate performance
 * and compare predictions vs actual results.
 * 
 * Based on the self-evaluation skill specification.
 */

import { prisma } from "@/lib/prisma";
import { memory } from "@/lib/memory";
import { updateFingerprintWithPerformance } from "./fingerprint";

export interface PerformanceData {
  impressions: number;
  reach: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  percentileRank: number;
}

export interface AgentEvaluation {
  agent: string;
  predicted: Record<string, unknown>;
  actual: Record<string, unknown>;
  accuracy: number;
  lesson: string;
}

export interface PostMortemResult {
  contentId: string;
  organizationId: string;
  publishedAt: Date;
  actualPerformance: PerformanceData;
  agentEvaluations: AgentEvaluation[];
  overallVerdict: "hit" | "miss" | "average";
  keyLearnings: string[];
}

/**
 * Find all posts published 7 days ago that haven't been evaluated.
 */
export async function findPostsForEvaluation(): Promise<string[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const eightDaysAgo = new Date(sevenDaysAgo);
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 1);
  
  const posts = await prisma.content.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: {
        gte: eightDaysAgo,
        lt: sevenDaysAgo,
      },
      // Not already evaluated
      fingerprint: {
        evaluatedAt: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
    },
  });
  
  return posts.map((p: { id: string }) => p.id);
}

/**
 * Get performance data for a post from analytics.
 * This would typically come from the platform APIs or analytics snapshots.
 */
async function getPerformanceData(contentId: string): Promise<PerformanceData | null> {
  // Try to get from analytics snapshots
  const snapshot = await prisma.analyticsSnapshot.findFirst({
    where: {
      content: {
        id: contentId,
      },
    },
    orderBy: {
      snapshotDate: "desc",
    },
  });
  
  if (snapshot) {
    return {
      impressions: snapshot.impressions || 0,
      reach: snapshot.reach || 0,
      engagementRate: snapshot.engagementRate || 0,
      likes: 0, // Would need platform-specific data
      comments: 0,
      shares: snapshot.shares || 0,
      saves: snapshot.saves || 0,
      clicks: snapshot.clicks || 0,
      percentileRank: 0, // Would need org-wide comparison
    };
  }
  
  return null;
}

/**
 * Calculate percentile rank for a post.
 */
async function calculatePercentileRank(
  organizationId: string,
  platform: string,
  engagementRate: number
): Promise<number> {
  // Get all posts in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const posts = await prisma.content.findMany({
    where: {
      organizationId,
      platform: platform as any,
      status: "PUBLISHED",
      publishedAt: {
        gte: thirtyDaysAgo,
      },
    },
    include: {
      fingerprint: true,
    },
  });
  
  if (posts.length === 0) return 50; // Default to median
  
  // Get engagement rates
  const rates = posts
    .map((p: { fingerprint: { engagementRate: number | null } | null }) => p.fingerprint?.engagementRate)
    .filter((r: number | null): r is number => r !== null && r !== undefined);
  
  if (rates.length === 0) return 50;
  
  // Sort and find percentile
  rates.sort((a: number, b: number) => a - b);
  const belowCount = rates.filter((r: number) => r < engagementRate).length;
  return Math.round((belowCount / rates.length) * 100);
}

/**
 * Evaluate a single post and generate post-mortem.
 */
export async function evaluatePost(contentId: string): Promise<PostMortemResult | null> {
  // Get the content
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      fingerprint: true,
    },
  });
  
  if (!content) {
    console.error(`Content not found: ${contentId}`);
    return null;
  }
  
  // Get performance data
  const performance = await getPerformanceData(contentId);
  
  if (!performance) {
    console.error(`No performance data for content: ${contentId}`);
    return null;
  }
  
  // Calculate percentile rank
  const percentileRank = await calculatePercentileRank(
    content.organizationId,
    content.platform,
    performance.engagementRate
  );
  performance.percentileRank = percentileRank;
  
  // Update fingerprint with performance data
  await updateFingerprintWithPerformance(contentId, {
    engagementRate: performance.engagementRate,
    reachRate: performance.reach / Math.max(performance.impressions, 1),
    saveRate: performance.saves / Math.max(performance.impressions, 1),
    shareRate: performance.shares / Math.max(performance.impressions, 1),
    commentRate: performance.comments / Math.max(performance.impressions, 1),
    impressions: performance.impressions,
    reach: performance.reach,
    likes: performance.likes,
    comments: performance.comments,
    shares: performance.shares,
    saves: performance.saves,
    clicks: performance.clicks,
    percentileRank,
  });
  
  // Generate agent evaluations
  const agentEvaluations: AgentEvaluation[] = [];
  
  // CONTENT_CREATOR evaluation
  if (content.fingerprint) {
    const fp = content.fingerprint;
    agentEvaluations.push({
      agent: "CONTENT_CREATOR",
      predicted: {
        topic: fp.topic,
        hookType: fp.hookType,
        angle: fp.angle,
      },
      actual: {
        engagementRate: performance.engagementRate,
        percentile: percentileRank,
      },
      accuracy: percentileRank / 100,
      lesson: percentileRank < 30
        ? `Post about "${fp.topic}" with ${fp.hookType} hook underperformed. Consider different angle.`
        : percentileRank > 80
          ? `Post about "${fp.topic}" with ${fp.hookType} hook was a hit. Replicate this combination.`
          : `Post performed at average levels. No strong signal.`,
    });
  }
  
  // TIMING evaluation
  if (content.publishedAt) {
    const dayOfWeek = content.publishedAt.getDay();
    const hourOfDay = content.publishedAt.getHours();
    
    agentEvaluations.push({
      agent: "CALENDAR_OPTIMIZER",
      predicted: {
        dayOfWeek,
        hourOfDay,
      },
      actual: {
        reach: performance.reach,
        engagementRate: performance.engagementRate,
      },
      accuracy: Math.min(performance.reach / 1000, 1), // Simplified
      lesson: `Posted on day ${dayOfWeek} at ${hourOfDay}:00.`,
    });
  }
  
  // Determine overall verdict
  const overallVerdict: "hit" | "miss" | "average" = 
    percentileRank > 70 ? "hit" : 
    percentileRank < 30 ? "miss" : "average";
  
  // Generate key learnings
  const keyLearnings = agentEvaluations
    .filter(e => e.accuracy < 0.4 || e.accuracy > 0.85)
    .map(e => e.lesson);
  
  // Create post-mortem record
  const postMortem = await prisma.postMortem.create({
    data: {
      organizationId: content.organizationId,
      contentId,
      actualPerformance: performance as any,
      agentEvaluations: agentEvaluations as any,
      overallVerdict,
      keyLearnings,
    },
  });
  
  // Store learnings in shared memory
  await storePostMortemMemories(content.organizationId, {
    contentId,
    overallVerdict,
    keyLearnings,
    agentEvaluations,
  });
  
  return {
    contentId,
    organizationId: content.organizationId,
    publishedAt: content.publishedAt!,
    actualPerformance: performance,
    agentEvaluations,
    overallVerdict,
    keyLearnings,
  };
}

/**
 * Store post-mortem learnings in shared memory.
 */
async function storePostMortemMemories(
  organizationId: string,
  postMortem: {
    contentId: string;
    overallVerdict: string;
    keyLearnings: string[];
    agentEvaluations: AgentEvaluation[];
  }
): Promise<void> {
  // Store overall learning
  await memory.store({
    organizationId,
    content: `Post-mortem for content ${postMortem.contentId}: ${postMortem.overallVerdict}. ${postMortem.keyLearnings.join(" ")}`,
    memoryType: "content_performance",
    agentSource: "SELF_EVALUATION",
    contentId: postMortem.contentId,
    importance: postMortem.overallVerdict === "hit" ? 0.8 : 
                postMortem.overallVerdict === "miss" ? 0.9 : 0.4,
  });
  
  // Store per-agent lessons for significant findings
  for (const agentEval of postMortem.agentEvaluations) {
    if (agentEval.accuracy < 0.4 || agentEval.accuracy > 0.85) {
      await memory.store({
        organizationId,
        content: `[${agentEval.agent}] ${agentEval.lesson}`,
        memoryType: "performance_pattern",
        agentSource: "SELF_EVALUATION",
        contentId: postMortem.contentId,
        importance: agentEval.accuracy < 0.4 ? 0.85 : 0.7,
      });
    }
  }
}

/**
 * Update agent scorecard with new evaluation data.
 */
export async function updateAgentScorecard(
  organizationId: string,
  agentName: string,
  accuracy: number
): Promise<void> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  
  // Find existing scorecard
  const existing = await prisma.agentScorecard.findUnique({
    where: {
      organizationId_agent_name_period: {
        organizationId,
        agentName,
        period,
      },
    },
  });
  
  if (existing) {
    // Update existing
    const newTotal = existing.totalEvaluations + 1;
    const newAvg = ((existing.avgAccuracy * existing.totalEvaluations) + accuracy) / newTotal;
    
    await prisma.agentScorecard.update({
      where: { id: existing.id },
      data: {
        totalEvaluations: newTotal,
        avgAccuracy: newAvg,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new
    await prisma.agentScorecard.create({
      data: {
        organizationId,
        agentName,
        period,
        totalEvaluations: 1,
        avgAccuracy: accuracy,
      },
    });
  }
}
