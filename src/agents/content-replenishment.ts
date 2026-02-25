import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { addDays, differenceInHours, subHours } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface ReplenishmentInput {
  organizationId: string;
  settings: {
    contentBufferDays: number;
    maxPostsPerDayPerPlatform: number;
    platforms: string[];
    alertAfterSilentHours: number;
  };
}

export interface ReplenishmentAction {
  type: "trigger_content_creator" | "escalate_silent" | "retry_failed_publish" | "notify_low_queue" | "none";
  platform?: string;
  count?: number;
  hoursSilent?: number;
  scheduleId?: string;
  reason?: string;
}

export interface ReplenishmentResult {
  orgId: string;
  status: "healthy" | "low" | "critical" | "silent";
  scheduledNext48h: number;
  targetNext48h: number;
  deficit: number;
  lastPublishedAt: Date | null;
  hoursSinceLastPost: number;
  actions: ReplenishmentAction[];
}

/**
 * Content Replenishment Agent - NO LLM
 * Pure orchestration logic that monitors content pipeline and triggers actions
 */
export class ContentReplenishmentAgent extends BaseAgent {
  constructor() {
    super("CONTENT_REPLENISHMENT");
  }

  async execute(input: ReplenishmentInput): Promise<AgentResult<ReplenishmentResult>> {
    const actions: ReplenishmentAction[] = [];
    let status: ReplenishmentResult["status"] = "healthy";
    let totalScheduled = 0;
    let totalTarget = 0;

    // Check scheduled content for each platform
    for (const platform of input.settings.platforms) {
      const platformEnum = platform.toUpperCase() as "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN";
      
      const scheduledCount = await prisma.schedule.count({
        where: {
          organizationId: input.organizationId,
          socialAccount: {
            platform: platformEnum,
          },
          status: "PENDING",
          scheduledFor: {
            gte: new Date(),
            lte: addDays(new Date(), input.settings.contentBufferDays),
          },
        },
      });

      const target = input.settings.maxPostsPerDayPerPlatform * input.settings.contentBufferDays;
      const deficit = target - scheduledCount;
      
      totalScheduled += scheduledCount;
      totalTarget += target;

      if (deficit > 0) {
        const newStatus = deficit >= target * 0.5 ? "critical" : "low";
        if (newStatus === "critical" || status === "healthy") {
          status = newStatus;
        }
        actions.push({
          type: "trigger_content_creator",
          platform,
          count: deficit,
        });
        if (newStatus === "critical") {
          actions.push({ type: "notify_low_queue", count: deficit });
        }
      }
    }

    // Check silence
    const lastPublished = await prisma.schedule.findFirst({
      where: { organizationId: input.organizationId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    });

    const hoursSilent = lastPublished?.publishedAt
      ? differenceInHours(new Date(), lastPublished.publishedAt)
      : Infinity;

    if (hoursSilent > input.settings.alertAfterSilentHours) {
      status = "silent";
      actions.push({ type: "escalate_silent", hoursSilent });
    }

    // Check failed publishes
    const failedSchedules = await prisma.schedule.findMany({
      where: {
        organizationId: input.organizationId,
        status: "FAILED",
        updatedAt: { gte: subHours(new Date(), 24) },
      },
    });

    for (const failed of failedSchedules) {
      actions.push({ type: "retry_failed_publish", scheduleId: failed.id });
    }

    // If healthy, add a none action
    if (actions.length === 0) {
      actions.push({ type: "none", reason: "Content pipeline is healthy" });
    }

    return {
      success: true,
      data: {
        orgId: input.organizationId,
        status,
        scheduledNext48h: totalScheduled,
        targetNext48h: totalTarget,
        deficit: Math.max(0, totalTarget - totalScheduled),
        lastPublishedAt: lastPublished?.publishedAt ?? null,
        hoursSinceLastPost: hoursSilent,
        actions,
      },
      confidenceScore: 1, // Deterministic - no LLM
      shouldEscalate: status === "silent" || status === "critical",
      escalationReason: status === "silent"
        ? `No posts published in ${hoursSilent} hours`
        : status === "critical"
        ? "Content queue critically low"
        : undefined,
      tokensUsed: 0,
    };
  }
}
