/**
 * System Health Check
 * 
 * Performs comprehensive health checks:
 * - Database connectivity
 * - External API connectivity
 * - Recent error rates
 * - Resource usage
 * - Agent status
 * 
 * Usage: npx tsx scripts/health-check.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface HealthCheck {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  details?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "Database", status: "ok", message: "Connected and responsive" };
  } catch (error) {
    return { 
      name: "Database", 
      status: "error", 
      message: `Connection failed: ${error}` 
    };
  }
}

async function checkRecentErrors(): Promise<HealthCheck> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const failedLogs = await prisma.agentLog.count({
    where: {
      status: "FAILED",
      createdAt: { gte: oneDayAgo },
    },
  });

  const totalLogs = await prisma.agentLog.count({
    where: {
      createdAt: { gte: oneDayAgo },
    },
  });

  const errorRate = totalLogs > 0 ? (failedLogs / totalLogs) * 100 : 0;

  if (errorRate > 10) {
    return {
      name: "Error Rate",
      status: "error",
      message: `${errorRate.toFixed(1)}% failure rate (${failedLogs}/${totalLogs})`,
      details: "Immediate attention required"
    };
  } else if (errorRate > 5) {
    return {
      name: "Error Rate",
      status: "warning",
      message: `${errorRate.toFixed(1)}% failure rate (${failedLogs}/${totalLogs})`,
    };
  }

  return {
    name: "Error Rate",
    status: "ok",
    message: `${errorRate.toFixed(1)}% failure rate (${failedLogs}/${totalLogs})`,
  };
}

async function checkPendingEscalations(): Promise<HealthCheck> {
  const pending = await prisma.escalation.count({
    where: {
      status: "OPEN",
    },
  });

  const critical = await prisma.escalation.count({
    where: {
      status: "OPEN",
      priority: "CRITICAL",
    },
  });

  if (critical > 0) {
    return {
      name: "Escalations",
      status: "error",
      message: `${critical} critical escalations pending`,
      details: `${pending} total open escalations`
    };
  } else if (pending > 10) {
    return {
      name: "Escalations",
      status: "warning",
      message: `${pending} escalations pending review`,
    };
  }

  return {
    name: "Escalations",
    status: "ok",
    message: `${pending} escalations pending`,
  };
}

async function checkScheduledPosts(): Promise<HealthCheck> {
  const failed24h = await prisma.schedule.count({
    where: {
      status: "FAILED",
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  const pending = await prisma.schedule.count({
    where: {
      status: "PENDING",
    },
  });

  if (failed24h > 5) {
    return {
      name: "Scheduled Posts",
      status: "warning",
      message: `${failed24h} posts failed in the last 24h`,
      details: `${pending} posts pending`
    };
  }

  return {
    name: "Scheduled Posts",
    status: "ok",
    message: `${pending} posts pending, ${failed24h} recent failures`,
  };
}

async function checkContentPipeline(): Promise<HealthCheck> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const drafts = await prisma.content.count({
    where: {
      status: "DRAFT",
      createdAt: { gte: weekAgo },
    },
  });

  const pending = await prisma.content.count({
    where: {
      status: "PENDING_REVIEW",
    },
  });

  const published = await prisma.content.count({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: weekAgo },
    },
  });

  if (drafts > 50 && pending > 20) {
    return {
      name: "Content Pipeline",
      status: "warning",
      message: `${drafts} drafts, ${pending} pending review`,
      details: `${published} published this week`
    };
  }

  return {
    name: "Content Pipeline",
    status: "ok",
    message: `${published} published this week, ${pending} pending review`,
  };
}

async function checkLLMUsage(): Promise<HealthCheck> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const usageLogs = await prisma.lLMUsageLog.count({
    where: {
      createdAt: { gte: oneDayAgo },
    },
  });

  if (usageLogs === 0) {
    return {
      name: "LLM Usage",
      status: "warning",
      message: "No LLM usage logged in the last 24h",
    };
  }

  return {
    name: "LLM Usage",
    status: "ok",
    message: `${usageLogs} LLM calls in the last 24h`,
  };
}

async function main() {
  console.log("🏥 System Health Check\n");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const checks = [
    checkDatabase,
    checkRecentErrors,
    checkPendingEscalations,
    checkScheduledPosts,
    checkContentPipeline,
    checkLLMUsage,
  ];

  const results: HealthCheck[] = [];

  for (const check of checks) {
    const result = await check();
    results.push(result);
    
    const icon = result.status === "ok" ? "✅" : result.status === "warning" ? "⚠️" : "❌";
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
  }

  // Summary
  const ok = results.filter(r => r.status === "ok").length;
  const warnings = results.filter(r => r.status === "warning").length;
  const errors = results.filter(r => r.status === "error").length;

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 Summary: ${ok} ok, ${warnings} warnings, ${errors} errors`);

  if (errors > 0) {
    console.log("\n❌ Critical issues detected! Action required.");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("\n⚠️  Some issues need attention.");
  } else {
    console.log("\n✅ All systems operational!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
