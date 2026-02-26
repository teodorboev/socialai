/**
 * Agent Performance Analyzer
 * 
 * Analyzes agent performance metrics:
 * - Average execution time
 * - Success rate
 * - Token usage
 * - Cost per execution
 * - Confidence score distribution
 * 
 * Usage: npx tsx scripts/analyze-agents.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AgentStats {
  agentName: string;
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  avgTokens: number;
  avgCost: number;
  avgConfidence: number;
}

async function main() {
  console.log("📈 Agent Performance Analysis\n");
  console.log("=".repeat(80));

  // Get all agent logs from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const agentLogs = await prisma.agentLog.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by agent
  const agentMap = new Map<string, typeof agentLogs>();
  
  for (const log of agentLogs) {
    const existing = agentMap.get(log.agentName) || [];
    existing.push(log);
    agentMap.set(log.agentName, existing);
  }

  // Calculate stats for each agent
  const stats: AgentStats[] = [];

  for (const [agentName, logs] of agentMap) {
    const successful = logs.filter(l => l.status === "SUCCESS");
    const totalDuration = logs.reduce((sum, l) => sum + (l.durationMs || 0), 0);
    const totalTokens = logs.reduce((sum, l) => sum + (l.tokensUsed || 0), 0);
    const totalCost = logs.reduce((sum, l) => sum + (l.costEstimate || 0), 0);
    const totalConfidence = logs.reduce((sum, l) => sum + (l.confidenceScore || 0), 0);

    stats.push({
      agentName,
      totalExecutions: logs.length,
      successRate: logs.length > 0 ? (successful.length / logs.length) * 100 : 0,
      avgDurationMs: logs.length > 0 ? totalDuration / logs.length : 0,
      avgTokens: logs.length > 0 ? totalTokens / logs.length : 0,
      avgCost: logs.length > 0 ? totalCost / logs.length : 0,
      avgConfidence: logs.length > 0 ? totalConfidence / logs.length : 0,
    });
  }

  // Sort by total executions
  stats.sort((a, b) => b.totalExecutions - a.totalExecutions);

  // Print results
  console.log("\nAgent Statistics (Last 30 Days)\n");
  console.log("Agent".padEnd(25), "Executions".padEnd(12), "Success%".padEnd(10), "Avg Time".padEnd(12), "Avg Tokens".padEnd(12), "Avg Cost".padEnd(10), "Avg Conf".padEnd(10));
  console.log("-".repeat(80));

  for (const stat of stats) {
    console.log(
      stat.agentName.padEnd(25),
      stat.totalExecutions.toString().padEnd(12),
      `${stat.successRate.toFixed(1)}%`.padEnd(10),
      `${stat.avgDurationMs.toFixed(0)}ms`.padEnd(12),
      stat.avgTokens.toFixed(0).padEnd(12),
      `$${stat.avgCost.toFixed(4)}`.padEnd(10),
      `${(stat.avgConfidence * 100).toFixed(1)}%`.padEnd(10)
    );
  }

  // Summary
  const totalExecutions = stats.reduce((sum, s) => sum + s.totalExecutions, 0);
  const totalCost = stats.reduce((sum, s) => sum + (s.avgCost * s.totalExecutions), 0);
  const avgSuccessRate = stats.length > 0 
    ? stats.reduce((sum, s) => sum + s.successRate, 0) / stats.length 
    : 0;

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Summary:");
  console.log(`  Total Executions: ${totalExecutions}`);
  console.log(`  Total Cost: $${totalCost.toFixed(2)}`);
  console.log(`  Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);

  // Identify issues
  console.log("\n⚠️  Issues Detected:");

  for (const stat of stats) {
    if (stat.successRate < 90) {
      console.log(`  - ${stat.agentName}: Low success rate (${stat.successRate.toFixed(1)}%)`);
    }
    if (stat.avgConfidence < 0.7) {
      console.log(`  - ${stat.agentName}: Low confidence (${(stat.avgConfidence * 100).toFixed(1)}%)`);
    }
    if (stat.avgCost > 1) {
      console.log(`  - ${stat.agentName}: High cost ($${stat.avgCost.toFixed(2)} per execution)`);
    }
  }

  console.log("\n✅ Analysis complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
