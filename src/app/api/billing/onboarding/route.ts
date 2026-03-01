/**
 * Billing API - Create Checkout Session for Onboarding
 * 
 * Creates a Stripe Checkout session for the selected plan.
 * Called from onboarding flow after plan selection.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCustomer, createCheckoutSession, getPriceForPlanAndCurrency } from "@/lib/billing/stripe";
import { detectCurrency } from "@/lib/billing/currency";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, planId, currency = "usd", country } = body;

    if (!organizationId || !planId) {
      return NextResponse.json(
        { error: "Missing organizationId or planId" },
        { status: 400 }
      );
    }

    // Get the billing plan
    const plan = await prisma.billingPlan.findUnique({
      where: { id: planId },
      include: {
        stripePrices: { where: { isActive: true } },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Detect currency from country if not provided
    const detectedCurrency = currency || (country ? detectCurrency(country) : "usd");

    // Get the monthly price for this currency
    const priceId = await getPriceForPlanAndCurrency(planId, detectedCurrency as any, "month");
    
    if (!priceId) {
      return NextResponse.json(
        { error: "No pricing available for this currency" },
        { status: 400 }
      );
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: { where: { role: "OWNER" }, take: 1 },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get owner email
    // Note: In real implementation, get from Supabase Auth
    const ownerEmail = `${organization.slug}@socialai.app`;

    // Get or create Stripe customer
    let stripeCustomerId = organization.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await createCustomer({
        organizationId: organization.id,
        email: ownerEmail,
        name: organization.name,
        currency: detectedCurrency as any,
      });
      stripeCustomerId = customer.id;

      // Update org with customer ID
      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId },
      });
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
    
    const session = await createCheckoutSession({
      stripeCustomerId,
      stripePriceId: priceId,
      trialDays: plan.trialDays,
      successUrl: `${baseUrl}/onboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/signup?canceled=true`,
      currency: detectedCurrency as any,
      metadata: {
        organizationId,
        planId,
      },
    });

    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: organizationId,
        event: "checkout_session_created",
        properties: {
          plan_id: planId,
          plan_name: plan.name,
          currency: detectedCurrency,
          trial_days: plan.trialDays,
          organization_id: organizationId,
          stripe_session_id: session.id,
        },
      });
      await posthog.shutdown();
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

/**
 * Get available plans for onboarding
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
          orderBy: [{ currency: "asc" }, { interval: "asc" }],
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Format plans for onboarding UI
    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      agentTier: plan.agentTier,
      trialDays: plan.trialDays,
      prices: plan.stripePrices.reduce((acc, price) => {
        if (!acc[price.currency]) {
          acc[price.currency] = {};
        }
        acc[price.currency][price.interval] = {
          amount: price.unitAmount,
          priceId: price.stripePriceId,
        };
        return acc;
      }, {} as Record<string, Record<string, { amount: number; priceId: string }>>),
    }));

    return NextResponse.json({ plans: formattedPlans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
