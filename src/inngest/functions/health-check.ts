import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

interface HealthStatus {
  status: "healthy" | "degraded" | "critical";
  message: string;
}

interface HealthReport {
  database: HealthStatus;
  agents: HealthStatus;
  socialApis: HealthStatus;
  llmApi: HealthStatus;
  queue: HealthStatus;
  lastRun: string;
  details: Record<string, unknown>;
}

/**
 * Health Check - Verifies all system components are operational
 * Runs every hour to catch issues before they affect clients
 */
export const healthCheck = inngest.createFunction(
  {
    id: "health-check",
    name: "System Health Check",
    retries: 0, // Don't retry health checks
  },
  {
    cron: "0 * * * *", // Every hour
  },
  async ({ step }) => {
    const report: HealthReport = {
      database: { status: "healthy", message: "" },
      agents: { status: "healthy", message: "" },
      socialApis: { status: "healthy", message: "" },
      llmApi: { status: "healthy", message: "" },
      queue: { status: "healthy", message: "" },
      lastRun: new Date().toISOString(),
      details: {},
    };

    // Check database connectivity
    const dbHealth = await step.run("check-database", async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: "healthy" as const, message: "Database connected" };
      } catch (error) {
        return { 
          status: "critical" as const, 
          message: error instanceof Error ? error.message : "Database unavailable" 
        };
      }
    });
    report.database = dbHealth;

    // Check agent activity (have agents run in the last 2 hours?)
    const agentHealth = await step.run("check-agents", async () => {
      try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        // Check recent agent logs
        const recentLogs = await prisma.agentLog.count({
          where: {
            createdAt: { gte: twoHoursAgo },
            status: "SUCCESS",
          },
        });

        // Check for recent failures
        const recentFailures = await prisma.agentLog.count({
          where: {
            createdAt: { gte: twoHoursAgo },
            status: "FAILED",
          },
        });

        if (recentLogs === 0) {
          return { status: "degraded" as const, message: "No agent activity in 2 hours" };
        }

        if (recentFailures > 10) {
          return { status: "degraded" as const, message: `${recentFailures} agent failures in 2 hours` };
        }

        return { status: "healthy" as const, message: `${recentLogs} successful agent runs` };
      } catch (error) {
        return { 
          status: "critical" as const, 
          message: error instanceof Error ? error.message : "Cannot check agents" 
        };
      }
    });
    report.agents = agentHealth;

    // Check social account status
    const socialHealth = await step.run("check-social-apis", async () => {
      try {
        // Check for inactive accounts
        const totalAccounts = await prisma.socialAccount.count({
          where: { isActive: true },
        });

        const inactiveAccounts = await prisma.socialAccount.count({
          where: { isActive: false },
        });

        // Check for accounts with expired tokens
        const expiredTokens = await prisma.socialAccount.count({
          where: {
            isActive: true,
            tokenExpiresAt: { lt: new Date() },
          },
        });

        if (expiredTokens > 0) {
          return { 
            status: "degraded" as const, 
            message: `${expiredTokens} accounts have expired tokens` 
          };
        }

        if (inactiveAccounts > totalAccounts * 0.5) {
          return { 
            status: "degraded" as const, 
            message: `${inactiveAccounts}/${totalAccounts + inactiveAccounts} accounts inactive` 
          };
        }

        return { status: "healthy" as const, message: `${totalAccounts} active accounts` };
      } catch (error) {
        return { 
          status: "critical" as const, 
          message: error instanceof Error ? error.message : "Cannot check social APIs" 
        };
      }
    });
    report.socialApis = socialHealth;

    // Check pending schedules (queue health)
    const queueHealth = await step.run("check-queue", async () => {
      try {
        const pendingSchedules = await prisma.schedule.count({
          where: {
            status: "PENDING",
            scheduledFor: { lte: new Date() }, // overdue
          },
        });

        const failedSchedules = await prisma.schedule.count({
          where: {
            status: "FAILED",
            retryCount: { lt: 3 }, // can still retry
          },
        });

        if (pendingSchedules > 100) {
          return { 
            status: "degraded" as const, 
            message: `${pendingSchedules} overdue schedules` 
          };
        }

        if (failedSchedules > 20) {
          return { 
            status: "degraded" as const, 
            message: `${failedSchedules} failed schedules pending retry` 
          };
        }

        return { 
          status: "healthy" as const, 
          message: `Queue healthy (${pendingSchedules} pending, ${failedSchedules} failed)` 
        };
      } catch (error) {
        return { 
          status: "critical" as const, 
          message: error instanceof Error ? error.message : "Cannot check queue" 
        };
      }
    });
    report.queue = queueHealth;

    // Determine overall status
    const statuses = [
      report.database.status,
      report.agents.status,
      report.socialApis.status,
      report.queue.status,
    ];

    const overallStatus = statuses.includes("critical") ? "critical" :
                         statuses.includes("degraded") ? "degraded" : "healthy";

    report.details = {
      databaseDetails: dbHealth,
      agentDetails: agentHealth,
      socialApiDetails: socialHealth,
      queueDetails: queueHealth,
      organizationCount: await prisma.organization.count(),
      contentCount: await prisma.content.count(),
      escalationCount: await prisma.escalation.count({ where: { status: "OPEN" } }),
    };

    // If critical issues, could trigger alerts here
    if (overallStatus === "critical") {
      console.error("SYSTEM HEALTH CRITICAL:", JSON.stringify(report, null, 2));
      // In production: send alert to on-call team
    }

    return {
      overallStatus,
      report,
    };
  }
);
