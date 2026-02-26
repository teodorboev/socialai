import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma";
import { syncPlanToStripe } from "@/lib/billing/stripe";

// POST /api/admin/billing/plans/[id]/sync - Sync plan to Stripe
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get plan with prices
    const plan = await prismaAdmin.billingPlan.findUnique({
      where: { id },
      include: { stripePrices: true },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Sync to Stripe
    const stripeProductId = await syncPlanToStripe(plan as any);

    return NextResponse.json({ 
      success: true, 
      stripeProductId,
      message: "Plan synced to Stripe successfully"
    });
  } catch (error) {
    console.error("Error syncing plan to Stripe:", error);
    return NextResponse.json({ 
      error: "Failed to sync plan to Stripe",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
