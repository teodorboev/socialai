import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";
import { z } from "zod";
import Stripe from "stripe";

// Schema for changing subscription plan
const changePlanSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
});

// GET /api/admin/users/[id]/subscription - Get current subscription
// PUT /api/admin/users/[id]/subscription - Change subscription plan

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const { id } = await params;

    // Find org member
    const orgMember = await prismaAdmin.orgMember.findUnique({
      where: { id },
      include: {
        organization: {
          include: {
            subscription: {
              include: {
                billingPlan: {
                  include: {
                    stripePrices: {
                      where: { isActive: true },
                      orderBy: [{ currency: "asc" }, { interval: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!orgMember) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!orgMember.organization.subscription) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    return NextResponse.json(orgMember.organization.subscription);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();
  
  // Initialize Stripe (will be null if no key)
  let stripe: Stripe | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { planId } = changePlanSchema.parse(body);

    // Find org member
    const orgMember = await prismaAdmin.orgMember.findUnique({
      where: { id },
      include: {
        organization: {
          include: {
            subscription: {
              include: {
                billingPlan: {
                  include: {
                    stripePrices: {
                      where: { interval: "month", isActive: true },
                      take: 1,
                    },
                  },
                },
              },
            },
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

    // Get the new plan
    const newPlan = await prismaAdmin.billingPlan.findUnique({
      where: { id: planId },
      include: {
        stripePrices: {
          where: { interval: "month", isActive: true },
          take: 1,
        },
      },
    });

    if (!newPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!newPlan.isActive) {
      return NextResponse.json({ error: "Plan is not active" }, { status: 400 });
    }

    const newPrice = newPlan.stripePrices[0];
    if (!newPrice) {
      return NextResponse.json({ error: "No active price for this plan" }, { status: 400 });
    }

    const oldPlan = subscription.billingPlan;

    // Update in Stripe if we have a valid Stripe setup
    if (stripe && subscription.stripeSubscriptionId && subscription.stripeSubscriptionItemId) {
      try {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [
            {
              id: subscription.stripeSubscriptionItemId,
              price: newPrice.stripePriceId,
            },
          ],
          proration_behavior: "create_prorations",
        });
      } catch (stripeError) {
        console.error("Stripe update error:", stripeError);
        // Continue with DB update even if Stripe fails
      }
    }

    // Update database
    const updatedSubscription = await prismaAdmin.subscription.update({
      where: { id: subscription.id },
      data: {
        billingPlanId: newPlan.id,
        stripePriceId: newPrice.stripePriceId,
      },
      include: {
        billingPlan: true,
      },
    });

    // Log billing event
    await prismaAdmin.billingEvent.create({
      data: {
        organizationId: orgMember.organizationId,
        eventType: "plan_changed",
        data: {
          oldPlanId: oldPlan?.id,
          oldPlanName: oldPlan?.name,
          newPlanId: newPlan.id,
          newPlanName: newPlan.name,
          changedByOrgMemberId: id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      message: `Plan changed from ${oldPlan?.name || 'None'} to ${newPlan.name}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error changing subscription plan:", error);
    return NextResponse.json({ error: "Failed to change subscription plan" }, { status: 500 });
  }
}
