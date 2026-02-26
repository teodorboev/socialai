/**
 * Provider Health Check Inngest Functions
 * 
 * Monitors LLM provider health and disables unhealthy providers automatically.
 * Tracks error rates, latency, and availability.
 */

import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { providerRegistry } from "@/lib/router/providers/registry";

// Health check thresholds
const HEALTH_CHECK_CONFIG = {
  // Error rate threshold: if >20% errors in last hour, mark degraded
  ERROR_RATE_THRESHOLD: 0.2,
  // Latency threshold: if p95 > 10 seconds, mark degraded
  LATENCY_P95_THRESHOLD_MS: 10000,
  // Minimum calls to consider for error rate calculation
  MIN_CALLS_FOR_ERROR_RATE: 10,
  // Consecutive failures before marking unavailable
  CONSECUTIVE_FAILURES_THRESHOLD: 5,
};

/**
 * Hourly provider health check
 * Runs every hour to check provider health
 */
export const hourlyProviderHealthCheck = inngest.createFunction(
  { id: "hourly-provider-health-check" },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Get all providers
    const providers = await step.run("get-providers", async () => {
      return prisma.lLMProvider.findMany({
        where: { isActive: true },
      });
    });

    const healthResults = [];

    for (const provider of providers) {
      const health = await step.run(`check-health-${provider.id}`, async () => {
        // Get usage stats for last hour
        const stats = await prisma.lLMUsageLog.aggregate({
          where: {
            providerId: provider.id,
            createdAt: {
              gte: oneHourAgo,
            },
          },
          _count: {
            id: true,
          },
          _sum: {
            latencyMs: true,
          },
          _avg: {
            latencyMs: true,
          },
        });

        // Get error count
        const errorCount = await prisma.lLMUsageLog.count({
          where: {
            providerId: provider.id,
            createdAt: {
              gte: oneHourAgo,
            },
            success: false,
          },
        });

        // Get consecutive failures
        const recentLogs = await prisma.lLMUsageLog.findMany({
          where: {
            providerId: provider.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: HEALTH_CHECK_CONFIG.CONSECUTIVE_FAILURES_THRESHOLD,
          select: {
            success: true,
          },
        });

        const consecutiveFailures = recentLogs.findIndex(l => l.success) === -1 
          ? recentLogs.length 
          : recentLogs.findIndex(l => l.success);

        const totalCalls = stats._count.id || 0;
        const errorRate = totalCalls > 0 ? errorCount / totalCalls : 0;
        const avgLatency = stats._avg.latencyMs || 0;
        const p95Latency = await calculateP95Latency(provider.id, oneHourAgo);

        // Determine health status
        let healthStatus: "healthy" | "degraded" | "unavailable" = "healthy";
        
        if (consecutiveFailures >= HEALTH_CHECK_CONFIG.CONSECUTIVE_FAILURES_THRESHOLD) {
          healthStatus = "unavailable";
        } else if (totalCalls >= HEALTH_CHECK_CONFIG.MIN_CALLS_FOR_ERROR_RATE) {
          if (errorRate > HEALTH_CHECK_CONFIG.ERROR_RATE_THRESHOLD || 
              p95Latency > HEALTH_CHECK_CONFIG.LATENCY_P95_THRESHOLD_MS) {
            healthStatus = "degraded";
          }
        }

        // Test provider connection if not many recent calls
        let connectionTest = true;
        if (totalCalls < 5) {
          try {
            const adapter = providerRegistry.getAdapter(provider.name.toLowerCase());
            connectionTest = adapter ? await adapter.healthCheck() : false;
          } catch {
            connectionTest = false;
            healthStatus = "unavailable";
          }
        }

        return {
          providerId: provider.id,
          providerName: provider.name,
          healthStatus,
          totalCalls,
          errorCount,
          errorRate,
          avgLatency,
          p95Latency,
          consecutiveFailures,
          connectionTest,
          timestamp: new Date(),
        };
      });

      healthResults.push(health);

      // Update provider status if degraded or unavailable
      if (health.healthStatus !== "healthy") {
        await step.run(`update-provider-${provider.id}`, async () => {
          // Log the health issue
          console.warn(`[PROVIDER HEALTH] ${health.providerName} is ${health.healthStatus}`, {
            errorRate: health.errorRate,
            avgLatency: health.avgLatency,
            consecutiveFailures: health.consecutiveFailures,
          });

          // If unavailable, mark provider as disabled
          if (health.healthStatus === "unavailable") {
            await prisma.lLMProvider.update({
              where: { id: provider.id },
              data: { 
                isActive: false,
                healthStatus: "unavailable",
                lastHealthCheck: new Date(),
                updatedAt: new Date(),
              },
            });

            // Trigger escalation event
            await inngest.send({
              name: "llm/provider-unavailable",
              data: {
                providerId: provider.id,
                providerName: provider.name,
                reason: `Consecutive failures: ${health.consecutiveFailures}, Error rate: ${(health.errorRate * 100).toFixed(1)}%`,
              },
            });
          }

          return { updated: true, newStatus: health.healthStatus };
        });
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      providersChecked: providers.length,
      healthResults,
    };
  }
);

/**
 * Calculate P95 latency for a provider
 */
async function calculateP95Latency(providerId: string, since: Date): Promise<number> {
  const latencies = await prisma.lLMUsageLog.findMany({
    where: {
      providerId,
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      latencyMs: "asc",
    },
    select: {
      latencyMs: true,
    },
  });

  if (latencies.length === 0) return 0;

  const index = Math.ceil(latencies.length * 0.95) - 1;
  return latencies[index]?.latencyMs || 0;
}

/**
 * Provider recovery check
 * Runs every 15 minutes to check if disabled providers have recovered
 */
export const providerRecoveryCheck = inngest.createFunction(
  { id: "provider-recovery-check" },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    // Get disabled providers that might have recovered
    const disabledProviders = await step.run("get-disabled-providers", async () => {
      return prisma.lLMProvider.findMany({
        where: { 
          isActive: false,
          // Only check providers disabled in last 24 hours
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });
    });

    const recoveryResults = [];

    for (const provider of disabledProviders) {
      const recovery = await step.run(`check-recovery-${provider.id}`, async () => {
        try {
          const adapter = providerRegistry.getAdapter(provider.name.toLowerCase());
          
          if (!adapter) {
            return { providerId: provider.id, recovered: false, reason: "No adapter found" };
          }

          // Test connection
          const isHealthy = await adapter.healthCheck();

          if (isHealthy) {
            // Re-enable provider
            await prisma.lLMProvider.update({
              where: { id: provider.id },
              data: { 
                isActive: true,
                healthStatus: "healthy",
                lastHealthCheck: new Date(),
                updatedAt: new Date(),
              },
            });

            // Log recovery
            console.info(`[PROVIDER RECOVERY] ${provider.name} has recovered and is re-enabled`);

            return { 
              providerId: provider.id, 
              providerName: provider.name,
              recovered: true,
            };
          }

          return { 
            providerId: provider.id, 
            recovered: false, 
            reason: "Health check failed" 
          };
        } catch (error) {
          return { 
            providerId: provider.id, 
            recovered: false, 
            reason: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      });

      recoveryResults.push(recovery);
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      providersChecked: disabledProviders.length,
      recovered: recoveryResults.filter(r => r.recovered).length,
      recoveryResults,
    };
  }
);

/**
 * Provider unavailability handler
 * Triggered when a provider is marked unavailable
 */
export const providerUnavailableHandler = inngest.createFunction(
  { id: "provider-unavailable-handler" },
  { event: "llm/provider-unavailable" },
  async ({ event, step }) => {
    const { providerId, providerName, reason } = event.data;

    // Get available fallback providers
    const fallbacks = await step.run("get-fallbacks", async () => {
      return prisma.lLMProvider.findMany({
        where: { 
          isActive: true,
          id: { not: providerId },
        },
        select: {
          id: true,
          name: true,
        },
      });
    });

    // Log the incident
    console.error(`[PROVIDER DOWN] ${providerName} is unavailable`, {
      providerId,
      reason,
      activeFallbacks: fallbacks.map(f => f.name),
    });

    // Could send alert to admin here (email, Slack, etc.)

    return {
      success: true,
      providerId,
      providerName,
      reason,
      fallbackProviders: fallbacks,
    };
  }
);

/**
 * Daily provider performance report
 * Generates a daily summary of provider performance
 */
export const dailyProviderReport = inngest.createFunction(
  { id: "daily-provider-report" },
  { cron: "0 6 * * *" }, // 6 AM UTC daily
  async ({ step }) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);

    const report = await step.run("generate-report", async () => {
      // Get all providers
      const providers = await prisma.lLMProvider.findMany();

      const providerStats = [];

      for (const provider of providers) {
        const stats = await prisma.lLMUsageLog.aggregate({
          where: {
            providerId: provider.id,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
          _count: {
            id: true,
          },
          _sum: {
            totalCost: true,
            totalTokens: true,
          },
          _avg: {
            latencyMs: true,
          },
        });

        const errorCount = await prisma.lLMUsageLog.count({
          where: {
            providerId: provider.id,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
            success: false,
          },
        });

        const totalCalls = stats._count.id || 0;
        const errorRate = totalCalls > 0 ? errorCount / totalCalls : 0;

        // Get tier breakdown
        const tierBreakdown = await prisma.lLMUsageLog.groupBy({
          by: ["requestTier"],
          where: {
            providerId: provider.id,
            createdAt: {
              gte: yesterday,
              lt: today,
            },
          },
          _count: {
            id: true,
          },
        });

        providerStats.push({
          providerId: provider.id,
          providerName: provider.name,
          isActive: provider.isActive,
          healthStatus: provider.healthStatus,
          totalCalls,
          totalCost: stats._sum.totalCost || 0,
          totalTokens: stats._sum.totalTokens || 0,
          avgLatency: stats._avg.latencyMs || 0,
          errorCount,
          errorRate,
          tierBreakdown: tierBreakdown.reduce((acc, t) => {
            acc[t.requestTier] = t._count.id;
            return acc;
          }, {} as Record<string, number>),
        });
      }

      return {
        date: yesterday.toISOString().split("T")[0],
        providers: providerStats,
        totalCalls: providerStats.reduce((sum, p) => sum + p.totalCalls, 0),
        totalCost: providerStats.reduce((sum, p) => sum + p.totalCost, 0),
      };
    });

    console.info(`[DAILY PROVIDER REPORT] ${report.date}`, report);

    return {
      success: true,
      report,
    };
  }
);
