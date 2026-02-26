import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlanToStripe, syncPriceToStripe } from "@/lib/billing/stripe";

// GET /api/admin/billing/plans - List all plans
// POST /api/admin/billing/plans - Create a new plan
export async function GET() {
  try {
    const plans = await prisma.billingPlan.findMany({
      include: {
        stripePrices: {
          orderBy: [{ currency: "asc" }, { interval: "asc" }],
        },
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      name,
      slug,
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
      prices,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Check if slug already exists
    const existing = await prisma.billingPlan.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Plan with this slug already exists" }, { status: 400 });
    }

    // Create plan
    const plan = await prisma.billingPlan.create({
      data: {
        name,
        slug,
        description: description || "",
        agentTier: agentTier || "core",
        enabledAgents: enabledAgents || [],
        maxPlatforms: maxPlatforms ?? 2,
        maxPostsPerMonth: maxPostsPerMonth ?? 40,
        maxBrands: maxBrands ?? 1,
        maxTeamMembers: maxTeamMembers ?? 1,
        trialDays: trialDays ?? 14,
        isUsageBased: isUsageBased ?? false,
        usageUnitName: usageUnitName || null,
        usageIncluded: usageIncluded || null,
        overagePerUnit: overagePerUnit || null,
        isActive: isActive ?? true,
        isPublic: isPublic ?? true,
        sortOrder: sortOrder || 0,
        features: {},
      },
    });

    // Create prices if provided
    if (prices && prices.length > 0) {
      for (const price of prices) {
        await prisma.stripePlanPrice.create({
          data: {
            billingPlanId: plan.id,
            currency: price.currency,
            interval: price.interval,
            unitAmount: price.unitAmount,
            stripeProductId: "",
            stripePriceId: "",
            isActive: true,
          },
        });
      }
    }

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

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("Error creating plan:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
