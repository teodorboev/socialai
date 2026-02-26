/**
 * Database Optimization Script
 * 
 * Run this script periodically to optimize database performance:
 * - Analyze tables for query planning
 * - Vacuum/analyze for storage optimization
 * - Clean up old data
 * 
 * Usage: npx tsx scripts/db-optimize.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗄️  Starting database optimization...\n");

  // 1. Analyze all tables for query planner
  console.log("📊 Analyzing tables...");
  const tables = [
    "content",
    "engagement", 
    "schedule",
    "agent_logs",
    "escalations",
    "analytics_snapshots",
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ANALYZE "${table}"`);
      console.log(`  ✓ Analyzed ${table}`);
    } catch (error) {
      console.log(`  ✗ Failed to analyze ${table}`);
    }
  }

  // 2. Clean up old agent logs (keep last 90 days)
  console.log("\n🧹 Cleaning up old agent logs...");
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const deletedLogs = await prisma.agentLog.deleteMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
    },
  });

  console.log(`  ✓ Deleted ${deletedLogs.count} old agent logs`);

  // 3. Clean up old resolved escalations (keep last 30 days)
  console.log("\n🧹 Cleaning up old escalations...");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deletedEscalations = await prisma.escalation.deleteMany({
    where: {
      status: "RESOLVED",
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  console.log(`  ✓ Deleted ${deletedEscalations.count} old escalations`);

  // 4. Clean up old schedules (published > 30 days ago)
  console.log("\n🧹 Cleaning up old schedules...");
  const oldSchedules = await prisma.schedule.deleteMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lt: thirtyDaysAgo },
    },
  });

  console.log(`  ✓ Deleted ${oldSchedules.count} old schedule records`);

  // 5. Clean up old failed schedules
  console.log("\n🧹 Cleaning up failed schedules...");
  const failedSchedules = await prisma.schedule.deleteMany({
    where: {
      status: "FAILED",
      updatedAt: { lt: thirtyDaysAgo },
    },
  });

  console.log(`  ✓ Deleted ${failedSchedules.count} failed schedule records`);

  console.log("\n✅ Database optimization complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
