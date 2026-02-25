/**
 * Goal Tracker
 * 
 * Manages client goals with targets, progress tracking, and auto-adjustment.
 * Based on the goal-tracking skill specification.
 */

import { prisma } from "@/lib/prisma";

export type GoalType = 
  | "grow_followers"
  | "drive_website_traffic"
  | "drive_sales"
  | "increase_engagement"
  | "build_awareness"
  | "generate_leads"
  | "launch_product"
  | "build_community"
  | "improve_brand_perception"
  | "custom";

export interface GoalTargets {
  metric: string;
  baselineValue: number;
  targetValue: number;
  targetUnit: "percent" | "count" | "currency";
  periodWeeks: number;
  benchmark?: number; // Industry benchmark for comparison
}

export interface GoalProgress {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  percentComplete: number;
  onTrack: boolean;
  lastUpdated: string;
}

/**
 * Create a new goal for an organization.
 */
export async function createGoal(
  organizationId: string,
  type: GoalType,
  description: string,
  targets: GoalTargets,
  targetDate?: Date
): Promise<string> {
  const goal = await prisma.goal.create({
    data: {
      organizationId,
      type,
      description,
      targets: targets as any,
      targetDate,
      isActive: true,
      priority: 1,
    },
  });
  
  return goal.id;
}

/**
 * Get all active goals for an organization.
 */
export async function getActiveGoals(organizationId: string) {
  return prisma.goal.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      checkpoints: {
        orderBy: { periodStart: "desc" },
        take: 4,
      },
    },
    orderBy: { priority: "asc" },
  });
}

/**
 * Calculate current progress for a goal based on latest metrics.
 */
export async function calculateGoalProgress(goalId: string): Promise<GoalProgress | null> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      checkpoints: {
        orderBy: { periodStart: "desc" },
        take: 2,
      },
    },
  });
  
  if (!goal) return null;
  
  const targets = goal.targets as unknown as GoalTargets;
  const latestCheckpoint = goal.checkpoints[0];
  const previousCheckpoint = goal.checkpoints[1];
  
  if (!latestCheckpoint) {
    // No checkpoints yet - return baseline
    return {
      currentValue: targets.baselineValue,
      previousValue: targets.baselineValue,
      changePercent: 0,
      percentComplete: 0,
      onTrack: true,
      lastUpdated: new Date().toISOString(),
    };
  }
  
  const currentValue = latestCheckpoint.actualValue ?? targets.baselineValue;
  const previousValue = previousCheckpoint?.actualValue ?? targets.baselineValue;
  const changePercent = previousValue > 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : 0;
  
  const totalTargetChange = targets.targetValue - targets.baselineValue;
  const currentChange = currentValue - targets.baselineValue;
  const percentComplete = totalTargetChange > 0 
    ? (currentChange / totalTargetChange) * 100 
    : 0;
  
  // Determine if on track
  const now = new Date();
  const startDate = new Date(goal.startDate);
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  
  let expectedProgress = 50; // Default
  if (targetDate && startDate) {
    const totalDuration = targetDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    expectedProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  }
  
  const onTrack = percentComplete >= expectedProgress * 0.8; // Allow 20% margin
  
  return {
    currentValue,
    previousValue,
    changePercent,
    percentComplete: Math.min(100, Math.max(0, percentComplete)),
    onTrack,
    lastUpdated: latestCheckpoint.createdAt.toISOString(),
  };
}

/**
 * Create a checkpoint for a goal (weekly or monthly).
 */
export async function createCheckpoint(
  goalId: string,
  periodStart: Date,
  periodEnd: Date,
  actualValue: number
): Promise<void> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });
  
  if (!goal) throw new Error("Goal not found");
  
  const targets = goal.targets as unknown as GoalTargets;
  
  // Calculate progress
  const totalTargetChange = targets.targetValue - targets.baselineValue;
  const currentChange = actualValue - targets.baselineValue;
  const progressPercent = totalTargetChange > 0 
    ? (currentChange / totalTargetChange) * 100 
    : 0;
  
  // Determine if on track
  const now = new Date();
  const startDate = new Date(goal.startDate);
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : startDate;
  targetDate.setDate(targetDate.getDate() + (targets.periodWeeks * 7));
  
  const totalDuration = targetDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const expectedProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  
  const onTrack = progressPercent >= expectedProgress * 0.8;
  
  // Determine status
  let status: "PENDING" | "IN_PROGRESS" | "ACHIEVED" | "MISSED" | "ADJUSTED" = "IN_PROGRESS";
  if (progressPercent >= 100) {
    status = "ACHIEVED";
  } else if (!onTrack && progressPercent < expectedProgress * 0.5) {
    status = "MISSED";
  }
  
  await prisma.goalCheckpoint.create({
    data: {
      goalId,
      periodStart,
      periodEnd,
      targetValue: targets.targetValue,
      targetUnit: targets.targetUnit,
      actualValue,
      progressPercent,
      onTrack,
      status,
    },
  });
  
  // Update goal's current progress
  const progress = await calculateGoalProgress(goalId);
  if (progress) {
    await prisma.goal.update({
      where: { id: goalId },
      data: {
        currentProgress: progress as any,
        achievedAt: status === "ACHIEVED" ? new Date() : null,
      },
    });
  }
}

/**
 * Propose smart goal targets based on historical data and industry benchmarks.
 */
export async function proposeGoalTargets(
  organizationId: string,
  goalType: GoalType
): Promise<GoalTargets> {
  // Get historical performance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const content = await prisma.content.findMany({
    where: {
      organizationId,
      status: "PUBLISHED",
      publishedAt: { gte: thirtyDaysAgo },
    },
    include: {
      fingerprint: true,
    },
  });
  
  // Get analytics
  const analytics = await prisma.analyticsSnapshot.findMany({
    where: {
      organizationId,
      snapshotDate: { gte: thirtyDaysAgo },
    },
  });
  
  // Calculate baselines based on historical data
  let baselineValue = 0;
  let targetValue = 0;
  let targetUnit: "percent" | "count" | "currency" = "percent";
  let benchmark = 0;
  
  switch (goalType) {
    case "grow_followers": {
      const totalFollowers = analytics.reduce((sum, a) => sum + (a.followers ?? 0), 0);
      baselineValue = totalFollowers / Math.max(analytics.length, 1);
      const avgGrowth = analytics.reduce((sum, a) => sum + (a.followersChange ?? 0), 0);
      targetValue = Math.round(baselineValue + (avgGrowth * 1.2)); // 20% improvement
      targetUnit = "count";
      benchmark = 5; // 5% monthly growth benchmark
      break;
    }
    case "increase_engagement": {
      const avgEngagement = analytics.reduce((sum, a) => sum + (a.engagementRate ?? 0), 0) / Math.max(analytics.length, 1);
      baselineValue = avgEngagement * 100; // Convert to percentage
      targetValue = baselineValue * 1.25; // 25% improvement
      targetUnit = "percent";
      benchmark = 3; // 3% engagement benchmark
      break;
    }
    case "drive_website_traffic": {
      const avgClicks = analytics.reduce((sum, a) => sum + (a.clicks ?? 0), 0);
      baselineValue = avgClicks / Math.max(analytics.length, 1);
      targetValue = Math.round(baselineValue * 1.5); // 50% improvement
      targetUnit = "count";
      benchmark = 100; // 100 clicks per post benchmark
      break;
    }
    case "drive_sales": {
      baselineValue = 0; // Would need revenue tracking
      targetValue = 0;
      targetUnit = "currency";
      benchmark = 0;
      break;
    }
    case "build_awareness": {
      const avgImpressions = analytics.reduce((sum, a) => sum + (a.impressions ?? 0), 0);
      baselineValue = avgImpressions / Math.max(analytics.length, 1);
      targetValue = Math.round(baselineValue * 1.3); // 30% improvement
      targetUnit = "count";
      benchmark = 1000; // 1K impressions benchmark
      break;
    }
    default:
      baselineValue = 0;
      targetValue = 0;
  }
  
  return {
    metric: goalType,
    baselineValue,
    targetValue,
    targetUnit,
    periodWeeks: 4,
    benchmark: benchmark || undefined,
  };
}

/**
 * Check all goals for an organization and create attention items if significantly off-track.
 */
export async function checkGoalProgress(organizationId: string): Promise<{
  onTrack: number;
  atRisk: number;
  offTrack: number;
}> {
  const goals = await getActiveGoals(organizationId);
  
  let onTrack = 0;
  let atRisk = 0;
  let offTrack = 0;
  
  for (const goal of goals) {
    const progress = await calculateGoalProgress(goal.id);
    
    if (!progress) continue;
    
    if (progress.onTrack) {
      onTrack++;
    } else if (progress.percentComplete >= 50) {
      atRisk++;
    } else {
      offTrack++;
    }
  }
  
  return { onTrack, atRisk, offTrack };
}

/**
 * Get goal summary for Mission Control dashboard.
 */
export async function getGoalSummary(organizationId: string) {
  const goals = await getActiveGoals(organizationId);
  
  const summary = {
    total: goals.length,
    onTrack: 0,
    atRisk: 0,
    offTrack: 0,
    primaryGoal: null as { type: string; progress: number; onTrack: boolean } | null,
  };
  
  for (const goal of goals) {
    const progress = await calculateGoalProgress(goal.id);
    
    if (goal.priority === 1) {
      summary.primaryGoal = {
        type: goal.type,
        progress: progress?.percentComplete ?? 0,
        onTrack: progress?.onTrack ?? true,
      };
    }
    
    if (!progress) continue;
    
    if (progress.onTrack) summary.onTrack++;
    else if (progress.percentComplete >= 50) summary.atRisk++;
    else summary.offTrack++;
  }
  
  return summary;
}
