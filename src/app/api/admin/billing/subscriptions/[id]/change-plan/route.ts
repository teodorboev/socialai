import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changePlan as changeStripePlan } from "@/lib/billing/stripe";

// POST /api/admin/billing/subscriptions/[id]/change-plan - Change subscription plan
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { newPlanId, prorationBehavior = "always_invoice" } = body;

    if (!newPlanId) {
      return NextResponse.json({ error: "newPlanId is required" }, { status: 400 });
    }

    // Get current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        billingPlan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Get new plan
    const newPlan = await prisma.billingPlan.findUnique({
      where: { id: newPlanId },
      include: {
        stripePrices: {
          where: { 
            currency: subscription.currency,
            interval: subscription.interval,
            isActive: true,
          },
        },
      },
    });

    if (!newPlan) {
      return NextResponse.json({ error: "New plan not found" }, { status: 404 });
    }

    const newPrice = newPlan.stripePrices[0];
    if (!newPrice || !newPrice.stripePriceId) {
      return NextResponse.json({ 
        error: "New plan has no active price. Please sync the plan to Stripe first." 
      }, { status: 400 });
    }

    // Change in Stripe
    try {
      await changeStripePlan({
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        newStripePriceId: newPrice.stripePriceId,
      });
    } catch (stripeError) {
      console.error("Stripe change plan error:", stripeError);
      return NextResponse.json({ 
        error: "Failed to change plan in Stripe",
        details: stripeError instanceof Error ? stripeError.message : "Unknown error"
      }, { status: 500 });
    }

    // Update in database
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        billingPlanId: newPlanId,
        stripePriceId: newPrice.stripePriceId,
        stripeSubscriptionItemId: newPrice.stripePriceId, // Simplified
      },
    });

    // Log event
    await prisma.billingEvent.create({
      data: {
        organizationId: subscription.organizationId,
        eventType: "plan_changed",
        data: { 
          oldPlan: subscription.billingPlan.name,
          newPlan: newPlan.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      subscription: updated,
      message: `Plan changed to ${newPlan.name}`,
    });
  } catch (error) {
    console.error("Error changing plan:", error);
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
  }
}
