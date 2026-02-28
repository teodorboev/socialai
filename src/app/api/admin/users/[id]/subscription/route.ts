import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";
import { z } from "zod";
import Stripe from "stripe";

// Schema for changing subscription plan
const changePlanSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
});

// Schema for creating subscription
const createSubscriptionSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
  stripeCustomerId: z.string().optional(),
  currency: z.string().default("usd"),
  interval: z.enum(["month", "year"]).default("month"),
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

// POST /api/admin/users/[id]/subscription - Create new subscription
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
    const body = await request.json();
    const { planId, stripeCustomerId, currency, interval } = createSubscriptionSchema.parse(body);

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

    // Check if subscription already exists
    if (orgMember.organization.subscription) {
      return NextResponse.json({ 
        error: "Organization already has a subscription. Cancel or change the existing subscription first." 
      }, { status: 400 });
    }

    // Get the plan with pricing
    const plan = await prismaAdmin.billingPlan.findUnique({
      where: { id: planId },
      include: {
        stripePrices: {
          where: { 
            currency: currency,
            interval: interval,
            isActive: true 
          },
          take: 1,
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.isActive) {
      return NextResponse.json({ error: "Plan is not active" }, { status: 400 });
    }

    const price = plan.stripePrices[0];
    if (!price) {
      return NextResponse.json({ 
        error: `No active ${interval} price for this plan in ${currency.toUpperCase()}` 
      }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId = stripeCustomerId;
    
    if (!customerId && stripe) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        description: `Organization: ${orgMember.organization.name}`,
        metadata: {
          organizationId: orgMember.organizationId,
          orgMemberId: id,
        },
      });
      customerId = customer.id;
    }

    if (!customerId) {
      return NextResponse.json({ 
        error: "No Stripe customer ID available and could not create one" 
      }, { status: 400 });
    }

    // Create Stripe subscription
    let stripeSubscription: Stripe.Subscription | null = null;
    let stripeSubscriptionItemId: string | undefined;
    let stripeCustomerIdValue: string = customerId;

    if (stripe) {
      try {
        stripeSubscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: price.stripePriceId }],
          trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
          metadata: {
            organizationId: orgMember.organizationId,
            orgMemberId: id,
          },
        });

        stripeSubscriptionItemId = stripeSubscription.items.data[0]?.id;
        stripeCustomerIdValue = stripeSubscription.customer as string;
      } catch (stripeError) {
        console.error("Stripe subscription creation error:", stripeError);
        // Continue with DB creation even if Stripe fails
      }
    }

    // Calculate periods
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (interval === "year" ? 12 : 1));

    const trialStart = plan.trialDays > 0 ? now : null;
    const trialEnd = plan.trialDays > 0 
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;

    // Create database subscription
    const subscription = await prismaAdmin.subscription.create({
      data: {
        organizationId: orgMember.organizationId,
        billingPlanId: plan.id,
        stripeCustomerId: stripeCustomerIdValue,
        stripeSubscriptionId: stripeSubscription?.id || `manual_${Date.now()}`,
        stripeSubscriptionItemId: stripeSubscriptionItemId || `manual_item_${Date.now()}`,
        stripePriceId: price.stripePriceId,
        status: plan.trialDays > 0 ? "trialing" : "active",
        currency: currency,
        interval: interval,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart,
        trialEnd,
      },
      include: {
        billingPlan: true,
      },
    });

    // Log billing event
    await prismaAdmin.billingEvent.create({
      data: {
        organizationId: orgMember.organizationId,
        eventType: "subscription_created",
        data: {
          planId: plan.id,
          planName: plan.name,
          priceId: price.stripePriceId,
          interval,
          currency,
          trialDays: plan.trialDays,
          createdByOrgMemberId: id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      subscription,
      message: plan.trialDays > 0 
        ? `Subscription created with ${plan.trialDays}-day trial`
        : "Subscription created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
