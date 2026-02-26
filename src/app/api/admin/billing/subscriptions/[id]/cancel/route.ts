import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelSubscription as cancelStripeSubscription } from "@/lib/billing/stripe";

// POST /api/admin/billing/subscriptions/[id]/cancel - Cancel subscription
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { atPeriodEnd = true, reason } = body;

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Cancel in Stripe
    try {
      await cancelStripeSubscription({
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        atPeriodEnd,
      });
    } catch (stripeError) {
      console.error("Stripe cancel error:", stripeError);
      // Continue even if Stripe fails - we'll update locally
    }

    // Update in database
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        cancelAtPeriodEnd: atPeriodEnd,
        canceledAt: new Date(),
        cancellationReason: reason || null,
        status: atPeriodEnd ? "active" : "canceled",
      },
    });

    // Log event
    await prisma.billingEvent.create({
      data: {
        organizationId: subscription.organizationId,
        eventType: "subscription_canceled",
        data: { reason, atPeriodEnd },
      },
    });

    return NextResponse.json({
      success: true,
      subscription: updated,
      message: atPeriodEnd ? "Subscription will cancel at period end" : "Subscription canceled immediately",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
