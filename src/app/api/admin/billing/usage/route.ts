import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

// GET /api/admin/billing/usage - Get AI usage/costs
export async function GET(request: Request) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");
    const period = searchParams.get("period"); // "month", "year"

    let dateFilter: { gte: Date; lte: Date } | undefined;

    if (period === "month") {
      const now = new Date();
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: now,
      };
    } else if (period === "year") {
      const now = new Date();
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1),
        lte: now,
      };
    }

    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    // Get total costs
    const costAggregation = await prismaAdmin.agentCostEvent.aggregate({
      where,
      _sum: {
        costCents: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // Get costs by organization
    const costsByOrg = await prismaAdmin.agentCostEvent.groupBy({
      by: ["organizationId"],
      where,
      _sum: {
        costCents: true,
      },
      orderBy: {
        _sum: {
          costCents: "desc",
        },
      },
    });

    // Get org names
    const orgIds = costsByOrg.map((c: { organizationId: string }) => c.organizationId);
    const orgs = await prismaAdmin.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgMap = new Map(orgs.map((o: { id: string; name: string }) => [o.id, o.name]));

    const orgCosts = costsByOrg.map((c: { organizationId: string; _sum: { costCents: number | null } }) => ({
      organizationId: c.organizationId,
      organizationName: orgMap.get(c.organizationId) || "Unknown",
      totalCost: (c._sum.costCents || 0) / 100,
    }));

    // Get costs by agent
    const costsByAgent = await prismaAdmin.agentCostEvent.groupBy({
      by: ["agentName"],
      where,
      _sum: {
        costCents: true,
      },
      orderBy: {
        _sum: {
          costCents: "desc",
        },
      },
    });

    const agentCosts = costsByAgent.map((c: { agentName: string; _sum: { costCents: number | null } }) => ({
      agentName: c.agentName,
      totalCost: (c._sum.costCents || 0) / 100,
    }));

    return NextResponse.json({
      summary: {
        totalCost: (costAggregation._sum.costCents || 0) / 100,
        totalInputTokens: costAggregation._sum.inputTokens || 0,
        totalOutputTokens: costAggregation._sum.outputTokens || 0,
        totalTokens: costAggregation._sum.totalTokens || 0,
        totalEvents: costAggregation._count,
      },
      byOrganization: orgCosts,
      byAgent: agentCosts,
      overTime: [], // Simplified - can be added later
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
