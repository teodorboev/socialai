import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CostDashboard } from "./cost-dashboard";

export const dynamic = 'force-dynamic';

async function getCostData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get daily summaries for last 30 days
  const dailySummaries = await prisma.dailyCostSummary.findMany({
    where: {
      date: {
        gte: thirtyDaysAgo,
        lt: today,
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  // Get today's real-time data
  const todayStats = await prisma.lLMUsageLog.aggregate({
    where: {
      createdAt: {
        gte: today,
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

  // Get tier breakdown for today
  const tierBreakdown = await prisma.lLMUsageLog.groupBy({
    by: ["requestTier"],
    where: {
      createdAt: {
        gte: today,
      },
    },
    _sum: {
      totalCost: true,
      totalTokens: true,
    },
    _count: {
      id: true,
    },
  });

  // Get provider breakdown for today
  const providerBreakdown = await prisma.lLMUsageLog.groupBy({
    by: ["providerName"],
    where: {
      createdAt: {
        gte: today,
      },
    },
    _sum: {
      totalCost: true,
      totalTokens: true,
    },
    _count: {
      id: true,
    },
  });

  // Get agent breakdown for today
  const agentBreakdown = await prisma.lLMUsageLog.groupBy({
    by: ["agentName"],
    where: {
      createdAt: {
        gte: today,
      },
    },
    _sum: {
      totalCost: true,
      totalTokens: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    dailySummaries,
    todayStats: {
      totalCost: todayStats._sum.totalCost || 0,
      totalTokens: todayStats._sum.totalTokens || 0,
      inputTokens: todayStats._sum.inputTokens || 0,
      outputTokens: todayStats._sum.outputTokens || 0,
      totalCalls: todayStats._count.id,
    },
    tierBreakdown,
    providerBreakdown,
    agentBreakdown,
  };
}

export default async function CostDashboardPage() {
  const data = await getCostData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">LLM Cost Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor AI usage costs and performance across all providers
        </p>
      </div>

      <CostDashboard initialData={data} />
    </div>
  );
}
