import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, PLANS, createCheckoutSession, createCustomerPortalSession } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/billing - Fetch available plans
 */
export async function GET() {
  try {
    const plans = await prisma.billingPlan.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      include: {
        stripePrices: {
          where: { isActive: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    const formatted = plans.map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      agentTier: plan.agentTier,
      trialDays: plan.trialDays,
      prices: plan.stripePrices.reduce((acc: any, price: any) => {
        if (!acc[price.currency]) acc[price.currency] = {};
        acc[price.currency][price.interval] = {
          amount: price.unitAmount,
          priceId: price.stripePriceId,
        };
        return acc;
      }, {}),
    }));

    return NextResponse.json({ plans: formatted });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 500 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's organization
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single();

  if (!orgMember || orgMember.role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can manage billing" }, { status: 403 });
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgMember.organization_id)
    .single();

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action, planType } = body;

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

  try {
    if (action === "create_checkout") {
      // Get or create Stripe customer
      let customerId = organization.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            organizationId: organization.id,
            userId: user.id,
          },
        });
        customerId = customer.id;

        // Save customer ID to organization
        await supabase
          .from("organizations")
          .update({ stripeCustomerId: customerId })
          .eq("id", organization.id);
      }

      const plan = PLANS[planType as keyof typeof PLANS];
      if (!plan || !plan.priceId) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }

      const session = await createCheckoutSession(
        customerId,
        plan.priceId,
        `${baseUrl}/mission-control/settings?success=true`,
        `${baseUrl}/mission-control/settings?canceled=true`
      );

      return NextResponse.json({ url: session.url });
    }

    if (action === "portal") {
      if (!organization.stripeCustomerId) {
        return NextResponse.json({ error: "No billing account" }, { status: 400 });
      }

      const session = await createCustomerPortalSession(
        organization.stripeCustomerId,
        `${baseUrl}/mission-control/settings`
      );

      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Billing error:", error);
    return NextResponse.json({ error: "Billing operation failed" }, { status: 500 });
  }
}
