/**
 * Cost Tracker Inngest Functions
 * 
 * Daily aggregation of LLM usage costs for the admin dashboard.
 * Matches the DailyCostSummary Prisma schema exactly.
 */

import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";

/**
 * Daily cost aggregation function
 * Runs at midnight UTC every day
 */
export const dailyCostAggregation = inngest.createFunction(
  { id: "daily-cost-aggregation" },
  { cron: "0 0 * * *" }, // Midnight UTC daily
  async ({ step }) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);

    // Aggregate usage by organization
    const orgUsage = await step.run("aggregate-org-usage", async () => {
      return prisma.lLMUsageLog.groupBy({
        by: ["organizationId"],
        where: {
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _sum: {
          totalCost: true,
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: {
          id: true,
        },
      });
    });

    // Create daily summaries for each org
    await step.run("create-daily-summaries", async () => {
      const summaries = [];

      for (const org of orgUsage) {
        if (!org.organizationId) continue;

        // Get tier breakdown for this org
        const tierBreakdown = await prisma.lLMUsageLog.groupBy({
          by: ["requestTier"],
          where: {
            organizationId: org.organizationId,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
          _sum: {
            totalCost: true,
          },
          _count: {
            id: true,
          },
        });

        // Get provider breakdown for this org
        const providerBreakdown = await prisma.lLMUsageLog.groupBy({
          by: ["providerName"],
          where: {
            organizationId: org.organizationId,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
          _sum: {
            totalCost: true,
          },
          _count: {
            id: true,
          },
        });

        // Get agent breakdown for this org
        const agentBreakdown = await prisma.lLMUsageLog.groupBy({
          by: ["agentName"],
          where: {
            organizationId: org.organizationId,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
          _sum: {
            totalCost: true,
          },
          _count: {
            id: true,
          },
        });

        // Calculate tier-specific costs and counts
        const budgetData = tierBreakdown.find(t => t.requestTier === "budget");
        const midData = tierBreakdown.find(t => t.requestTier === "mid");
        const flagshipData = tierBreakdown.find(t => t.requestTier === "flagship");

        const summary = await prisma.dailyCostSummary.create({
          data: {
            organizationId: org.organizationId,
            date: yesterday,
            totalCalls: org._count.id,
            totalInputTokens: BigInt(org._sum.inputTokens || 0),
            totalOutputTokens: BigInt(org._sum.outputTokens || 0),
            totalCostCents: org._sum.totalCost || 0,
            budgetCalls: budgetData?._count.id || 0,
            budgetCost: budgetData?._sum.totalCost || 0,
            midCalls: midData?._count.id || 0,
            midCost: midData?._sum.totalCost || 0,
            flagshipCalls: flagshipData?._count.id || 0,
            flagshipCost: flagshipData?._sum.totalCost || 0,
            costByProvider: providerBreakdown.reduce((acc, p) => {
              acc[p.providerName] = {
                cost: p._sum.totalCost || 0,
                calls: p._count.id,
              };
              return acc;
            }, {} as Record<string, { cost: number; calls: number }>),
            costByAgent: agentBreakdown.reduce((acc, a) => {
              acc[a.agentName] = {
                cost: a._sum.totalCost || 0,
                calls: a._count.id,
              };
              return acc;
            }, {} as Record<string, { cost: number; calls: number }>),
          },
        });

        summaries.push(summary);
      }

      return summaries;
    });

    // Create platform-wide summary (null organizationId)
    await step.run("create-platform-summary", async () => {
      const platformTotals = await prisma.lLMUsageLog.aggregate({
        where: {
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _sum: {
          totalCost: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: {
          id: true,
        },
      });

      const tierBreakdown = await prisma.lLMUsageLog.groupBy({
        by: ["requestTier"],
        where: {
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _sum: {
          totalCost: true,
        },
        _count: {
          id: true,
        },
      });

      const providerBreakdown = await prisma.lLMUsageLog.groupBy({
        by: ["providerName"],
        where: {
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _sum: {
          totalCost: true,
        },
        _count: {
          id: true,
        },
      });

      const agentBreakdown = await prisma.lLMUsageLog.groupBy({
        by: ["agentName"],
        where: {
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _sum: {
          totalCost: true,
        },
        _count: {
          id: true,
        },
      });

      const budgetData = tierBreakdown.find(t => t.requestTier === "budget");
      const midData = tierBreakdown.find(t => t.requestTier === "mid");
      const flagshipData = tierBreakdown.find(t => t.requestTier === "flagship");

      return prisma.dailyCostSummary.create({
        data: {
          organizationId: null, // Platform-wide
          date: yesterday,
          totalCalls: platformTotals._count.id,
          totalInputTokens: BigInt(platformTotals._sum.inputTokens || 0),
          totalOutputTokens: BigInt(platformTotals._sum.outputTokens || 0),
          totalCostCents: platformTotals._sum.totalCost || 0,
          budgetCalls: budgetData?._count.id || 0,
          budgetCost: budgetData?._sum.totalCost || 0,
          midCalls: midData?._count.id || 0,
          midCost: midData?._sum.totalCost || 0,
          flagshipCalls: flagshipData?._count.id || 0,
          flagshipCost: flagshipData?._sum.totalCost || 0,
          costByProvider: providerBreakdown.reduce((acc, p) => {
            acc[p.providerName] = {
              cost: p._sum.totalCost || 0,
              calls: p._count.id,
            };
            return acc;
          }, {} as Record<string, { cost: number; calls: number }>),
          costByAgent: agentBreakdown.reduce((acc, a) => {
            acc[a.agentName] = {
              cost: a._sum.totalCost || 0,
              calls: a._count.id,
            };
            return acc;
          }, {} as Record<string, { cost: number; calls: number }>),
        },
      });
    });

    return {
      success: true,
      date: yesterday.toISOString().split("T")[0],
      orgsProcessed: orgUsage.length,
    };
  }
);

/**
 * Weekly cost report function
 * Runs every Monday at 9 AM UTC
 */
export const weeklyCostReport = inngest.createFunction(
  { id: "weekly-cost-report" },
  { cron: "0 9 * * 1" }, // Monday 9 AM UTC
  async ({ step }) => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    // Get top spending orgs
    const topSpenders = await step.run("get-top-spenders", async () => {
      return prisma.dailyCostSummary.groupBy({
        by: ["organizationId"],
        where: {
          date: {
            gte: weekAgo,
            lt: now,
          },
          organizationId: { not: null },
        },
        _sum: {
          totalCostCents: true,
        },
        orderBy: {
          _sum: {
            totalCostCents: "desc",
          },
        },
        take: 10,
      });
    });

    // Get cost trends (compare to previous week)
    const trends = await step.run("calculate-trends", async () => {
      const twoWeeksAgo = new Date(weekAgo);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);

      const lastWeek = await prisma.dailyCostSummary.aggregate({
        where: {
          date: {
            gte: weekAgo,
            lt: now,
          },
        },
        _sum: {
          totalCostCents: true,
        },
      });

      const previousWeek = await prisma.dailyCostSummary.aggregate({
        where: {
          date: {
            gte: twoWeeksAgo,
            lt: weekAgo,
          },
        },
        _sum: {
          totalCostCents: true,
        },
      });

      const lastWeekCost = lastWeek._sum.totalCostCents || 0;
      const previousWeekCost = previousWeek._sum.totalCostCents || 0;
      const changePercent = previousWeekCost > 0
        ? ((lastWeekCost - previousWeekCost) / previousWeekCost) * 100
        : 0;

      return {
        lastWeekCost,
        previousWeekCost,
        changePercent,
        trend: changePercent > 0 ? "up" : changePercent < 0 ? "down" : "stable",
      };
    });

    return {
      success: true,
      weekStarting: weekAgo.toISOString().split("T")[0],
      topSpenders,
      trends,
    };
  }
);

/**
 * High cost alert function
 * Triggered when daily costs exceed threshold
 */
export const highCostAlert = inngest.createFunction(
  { id: "high-cost-alert" },
  { event: "llm/high-cost-detected" },
  async ({ event, step }) => {
    const { organizationId, dailyCost, threshold } = event.data;

    // Get org details
    const org = await step.run("get-org-details", async () => {
      return prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, plan: true },
      });
    });

    if (!org) {
      return { success: false, error: "Organization not found" };
    }

    // Get top cost drivers
    const topCosts = await step.run("get-top-cost-drivers", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return prisma.lLMUsageLog.groupBy({
        by: ["agentName", "modelId"],
        where: {
          organizationId,
          createdAt: {
            gte: today,
          },
        },
        _sum: {
          totalCost: true,
        },
        orderBy: {
          _sum: {
            totalCost: "desc",
          },
        },
        take: 5,
      });
    });

    // Log the alert (could also send email/Slack notification)
    console.warn(`[HIGH COST ALERT] ${org.name} (${organizationId})`, {
      dailyCost,
      threshold,
      plan: org.plan,
      topCostDrivers: topCosts,
    });

    return {
      success: true,
      organizationId,
      organizationName: org.name,
      dailyCost,
      threshold,
      topCostDrivers: topCosts,
    };
  }
);

/**
 * Real-time cost check function
 * Called after each LLM call to check if daily threshold exceeded
 */
export const checkDailyCostThreshold = async (organizationId: string): Promise<boolean> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCost = await prisma.dailyCostSummary.findFirst({
    where: {
      organizationId,
      date: {
        gte: today,
      },
    },
    select: {
      totalCostCents: true,
    },
  });

  // Default threshold: 500 cents ($5) per day
  // This should be configurable per org in the future
  const DAILY_COST_THRESHOLD_CENTS = 500;
  const currentCost = todayCost?.totalCostCents || 0;

  if (currentCost > DAILY_COST_THRESHOLD_CENTS) {
    // Trigger high cost alert
    await inngest.send({
      name: "llm/high-cost-detected",
      data: {
        organizationId,
        dailyCost: currentCost,
        threshold: DAILY_COST_THRESHOLD_CENTS,
      },
    });

    return true;
  }

  return false;
};
