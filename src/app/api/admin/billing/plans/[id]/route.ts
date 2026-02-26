import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlanToStripe } from "@/lib/billing/stripe";

// GET /api/admin/billing/plans/[id] - Get a single plan
// PUT /api/admin/billing/plans/[id] - Update a plan
// DELETE /api/admin/billing/plans/[id] - Delete a plan
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const plan = await prisma.billingPlan.findUnique({
      where: { id },
      include: {
        stripePrices: {
          orderBy: [{ currency: "asc" }, { interval: "asc" }],
        },
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      agentTier,
      enabledAgents,
      maxPlatforms,
      maxPostsPerMonth,
      maxBrands,
      maxTeamMembers,
      trialDays,
      isUsageBased,
      usageUnitName,
      usageIncluded,
      overagePerUnit,
      isActive,
      isPublic,
      sortOrder,
    } = body;

    // Check if plan exists
    const existing = await prisma.billingPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Update plan
    const plan = await prisma.billingPlan.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description ?? existing.description,
        agentTier: agentTier ?? existing.agentTier,
        enabledAgents: enabledAgents ?? existing.enabledAgents,
        maxPlatforms: maxPlatforms ?? existing.maxPlatforms,
        maxPostsPerMonth: maxPostsPerMonth ?? existing.maxPostsPerMonth,
        maxBrands: maxBrands ?? existing.maxBrands,
        maxTeamMembers: maxTeamMembers ?? existing.maxTeamMembers,
        trialDays: trialDays ?? existing.trialDays,
        isUsageBased: isUsageBased ?? existing.isUsageBased,
        usageUnitName: usageUnitName ?? existing.usageUnitName,
        usageIncluded: usageIncluded ?? existing.usageIncluded,
        overagePerUnit: overagePerUnit ?? existing.overagePerUnit,
        isActive: isActive ?? existing.isActive,
        isPublic: isPublic ?? existing.isPublic,
        sortOrder: sortOrder ?? existing.sortOrder,
      },
    });

    // Try to sync to Stripe (non-blocking)
    try {
      const planWithPrices = await prisma.billingPlan.findUnique({
        where: { id: plan.id },
        include: { stripePrices: true },
      });
      if (planWithPrices) {
        await syncPlanToStripe(planWithPrices as any);
      }
    } catch (stripeError) {
      console.error("Stripe sync failed (non-blocking):", stripeError);
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if plan exists
    const existing = await prisma.billingPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Check if plan has subscribers - don't delete, just deactivate
    if (existing._count.subscriptions > 0) {
      // Instead of deleting, mark as inactive
      const plan = await prisma.billingPlan.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ 
        message: "Plan has subscribers - marked as inactive instead of deleting",
        plan 
      });
    }

    // Delete prices first
    await prisma.stripePlanPrice.deleteMany({ where: { billingPlanId: id } });

    // Delete plan
    await prisma.billingPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
