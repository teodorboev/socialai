import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";
import Stripe from "stripe";

// POST /api/admin/users/[id]/subscription/cancel - Cancel subscription

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();
  
  // Initialize Stripe
  let stripe: Stripe | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { immediate } = body; // If true, cancel immediately; otherwise cancel at period end

    // Find org member
    const orgMember = await prismaAdmin.orgMember.findUnique({
      where: { id },
      include: {
        organization: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!orgMember) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const subscription = orgMember.organization.subscription;
    if (!subscription) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    if (subscription.status === "canceled") {
      return NextResponse.json({ error: "Subscription is already canceled" }, { status: 400 });
    }

    // Cancel in Stripe if we have a valid setup
    if (stripe && subscription.stripeSubscriptionId) {
      try {
        if (immediate) {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } else {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        }
      } catch (stripeError) {
        console.error("Stripe cancel error:", stripeError);
        // Continue with DB update
      }
    }

    // Update database
    const canceledAt = immediate ? new Date() : null;
    const updatedSubscription = await prismaAdmin.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: !immediate,
        canceledAt,
        status: immediate ? "canceled" : subscription.status,
      },
    });

    // Log billing event
    await prismaAdmin.billingEvent.create({
      data: {
        organizationId: orgMember.organizationId,
        eventType: immediate ? "subscription_canceled" : "subscription_cancellation_scheduled",
        data: {
          canceledByOrgMemberId: id,
          immediate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      message: immediate 
        ? "Subscription canceled immediately" 
        : "Subscription will be canceled at the end of the billing period",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
