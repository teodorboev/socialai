/**
 * Billing - Stripe Webhook Handler
 * 
 * Handles all Stripe webhook events for subscription lifecycle:
 * - Idempotent processing via stripeEventId uniqueness
 * - Creates BillingEvent logs
 * - Triggers Inngest events for dunning/churn
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================

export async function POST(request: Request) {
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json(
      { error: "Stripe webhook secret not configured" },
      { status: 500 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  try {
    await processEvent(event);
  } catch (error) {
    console.error("Error processing webhook event:", error);
    return NextResponse.json(
      { error: "Event processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// ============================================================
// EVENT PROCESSING
// ============================================================

async function processEvent(event: any): Promise<void> {
  // Check for idempotency
  const existingEvent = await prisma.billingEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  if (existingEvent) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  // Log the event
  await prisma.billingEvent.create({
    data: {
      eventType: event.type,
      stripeEventId: event.id,
      data: event.data.object as any,
    },
  });

  const eventData = event.data.object;
  
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(eventData);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(eventData);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionCanceled(eventData);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialEnding(eventData);
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(eventData);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(eventData);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(eventData);
      break;
    case "customer.subscription.paused":
      await handleSubscriptionPaused(eventData);
      break;
    case "customer.subscription.resumed":
      await handleSubscriptionResumed(eventData);
      break;
  }

  await prisma.billingEvent.update({
    where: { stripeEventId: event.id },
    data: { processedAt: new Date() },
  });
}

// ============================================================
// HELPER: Get organization from subscription
// ============================================================

async function getOrganizationFromSub(sub: any): Promise<string | null> {
  if (sub.metadata?.organizationId) {
    return sub.metadata.organizationId;
  }
  
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  
  return existingSub?.organizationId ?? null;
}

// ============================================================
// SUBSCRIPTION HANDLERS
// ============================================================

async function handleSubscriptionCreated(sub: any) {
  const organizationId = sub.metadata?.organizationId;
  
  if (!organizationId) {
    console.warn("Subscription created without organizationId in metadata");
    return;
  }

  const stripePriceId = sub.items?.data?.[0]?.price?.id;
  if (!stripePriceId) {
    console.warn("Subscription created without price ID");
    return;
  }

  const planPrice = await prisma.stripePlanPrice.findFirst({
    where: { stripePriceId },
    include: { billingPlan: true },
  });

  if (!planPrice) {
    console.warn(`Plan price not found for price ID: ${stripePriceId}`);
    return;
  }

  const subscriptionItemId = sub.items?.data?.[0]?.id;

  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      billingPlanId: planPrice.billingPlanId,
      stripeSubscriptionId: sub.id,
      stripePriceId,
      stripeSubscriptionItemId: subscriptionItemId,
      status: sub.status,
      currency: sub.currency as string,
      interval: planPrice.interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      failedPaymentCount: 0,
      dunningStep: 0,
    },
    create: {
      organizationId,
      billingPlanId: planPrice.billingPlanId,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      stripePriceId,
      stripeSubscriptionItemId: subscriptionItemId,
      status: sub.status,
      currency: sub.currency as string,
      interval: planPrice.interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });

  await logActivity(organizationId, `Subscription activated: ${planPrice.billingPlan.name}`);

  await inngest.send({
    name: "billing/subscription-activated",
    data: { 
      organizationId, 
      planSlug: planPrice.billingPlan.slug,
      status: sub.status,
    },
  });

  console.log(`Subscription created for org ${organizationId}: ${planPrice.billingPlan.name}`);
}

async function handleSubscriptionUpdated(sub: any) {
  const orgIdFromMeta = sub.metadata?.organizationId;
  let organizationId = orgIdFromMeta || await getOrganizationFromSub(sub);

  if (!organizationId) {
    console.warn(`Subscription updated but no organization found: ${sub.id}`);
    return;
  }

  const stripePriceId = sub.items?.data?.[0]?.price?.id;
  
  let billingPlanId: string | undefined;
  if (stripePriceId) {
    const planPrice = await prisma.stripePlanPrice.findFirst({
      where: { stripePriceId },
    });
    billingPlanId = planPrice?.billingPlanId;
  }
  
  const updateData: any = {
    status: sub.status,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };

  if (billingPlanId) {
    updateData.billingPlanId = billingPlanId;
    updateData.stripePriceId = stripePriceId;
  }

  if (sub.metadata?.cancellation_reason) {
    updateData.cancellationReason = sub.metadata.cancellation_reason;
  }

  await prisma.subscription.update({
    where: { organizationId },
    data: updateData,
  });

  if (billingPlanId) {
    const plan = await prisma.billingPlan.findUnique({ where: { id: billingPlanId } });
    await logActivity(organizationId, `Plan changed to: ${plan?.name}`);
  }

  if (sub.status === "past_due") {
    await inngest.send({
      name: "billing/payment-past-due",
      data: { organizationId },
    });
  }

  if (sub.status === "canceled" && sub.cancel_at_period_end) {
    await logActivity(organizationId, "Subscription will cancel at period end");
  }

  console.log(`Subscription updated for org ${organizationId}: status=${sub.status}`);
}

async function handleSubscriptionCanceled(sub: any) {
  const orgIdFromMeta = sub.metadata?.organizationId;
  let organizationId = orgIdFromMeta || await getOrganizationFromSub(sub);

  if (!organizationId) {
    console.warn(`Subscription canceled but no organization found: ${sub.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { organizationId },
    data: { 
      status: "canceled", 
      canceledAt: new Date(),
    },
  });

  await logActivity(organizationId, "Subscription canceled - all AI operations paused");

  await inngest.send({
    name: "billing/subscription-canceled",
    data: { 
      organizationId,
      reason: sub.metadata?.cancellation_reason,
    },
  });

  console.log(`Subscription canceled for org ${organizationId}`);
}

async function handleTrialEnding(sub: any) {
  const orgIdFromMeta = sub.metadata?.organizationId;
  let organizationId = orgIdFromMeta || await getOrganizationFromSub(sub);

  if (!organizationId) {
    console.warn(`Trial ending but no organization found: ${sub.id}`);
    return;
  }

  await prisma.attentionItem.create({
    data: {
      organizationId,
      type: "SYSTEM_ALERT",
      title: "Your free trial ends in 3 days",
      description: "Add a payment method to keep your AI running. All your content, settings, and AI training will be preserved.",
      priority: "HIGH",
    },
  });

  await logActivity(organizationId, "Trial ending in 3 days - action required");

  await inngest.send({
    name: "billing/trial-ending",
    data: { 
      organizationId,
      trialEndDate: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });

  console.log(`Trial ending for org ${organizationId}`);
}

// ============================================================
// PAYMENT HANDLERS
// ============================================================

async function handlePaymentSucceeded(invoice: any) {
  const customerId = invoice.customer;
  
  const subscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!subscription) {
    console.warn(`Payment succeeded but no subscription found for customer: ${customerId}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { 
      failedPaymentCount: 0, 
      dunningStep: 0, 
      lastPaymentFailedAt: null,
    },
  });

  if (subscription.status === "past_due") {
    await logActivity(subscription.organizationId, "Payment recovered - service restored");
  }

  console.log(`Payment succeeded for org ${subscription.organizationId}`);
}

async function handlePaymentFailed(invoice: any) {
  const customerId = invoice.customer;
  
  const subscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!subscription) {
    console.warn(`Payment failed but no subscription found for customer: ${customerId}`);
    return;
  }

  const newFailCount = subscription.failedPaymentCount + 1;
  const dunningStep = Math.min(newFailCount, 3);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      failedPaymentCount: newFailCount,
      lastPaymentFailedAt: new Date(),
      dunningStep,
    },
  });

  await logActivity(subscription.organizationId, `Payment failed (attempt ${newFailCount})`);

  await inngest.send({
    name: "billing/payment-failed",
    data: {
      organizationId: subscription.organizationId,
      failCount: newFailCount,
      dunningStep,
    },
  });

  console.log(`Payment failed for org ${subscription.organizationId}: attempt ${newFailCount}`);
}

// ============================================================
// CHECKOUT HANDLER
// ============================================================

async function handleCheckoutCompleted(session: any) {
  const organizationId = session.metadata?.organizationId;
  
  if (!organizationId) {
    console.warn("Checkout completed but no organization in metadata");
    return;
  }

  await logActivity(organizationId, "Welcome! Your subscription is active. AI is starting up...");

  console.log(`Checkout completed for org ${organizationId}`);
}

// ============================================================
// PAUSE/RESUME HANDLERS
// ============================================================

async function handleSubscriptionPaused(sub: any) {
  const orgIdFromMeta = sub.metadata?.organizationId;
  let organizationId = orgIdFromMeta || await getOrganizationFromSub(sub);

  if (!organizationId) return;

  await prisma.subscription.update({
    where: { organizationId },
    data: { status: "paused" },
  });

  await logActivity(organizationId, "Subscription paused");

  await inngest.send({
    name: "billing/subscription-paused",
    data: { organizationId },
  });
}

async function handleSubscriptionResumed(sub: any) {
  const orgIdFromMeta = sub.metadata?.organizationId;
  let organizationId = orgIdFromMeta || await getOrganizationFromSub(sub);

  if (!organizationId) return;

  await prisma.subscription.update({
    where: { organizationId },
    data: { status: "active" },
  });

  await logActivity(organizationId, "Subscription resumed");

  await inngest.send({
    name: "billing/subscription-resumed",
    data: { organizationId },
  });
}

// ============================================================
// HELPER: Activity Logging
// ============================================================

async function logActivity(organizationId: string, description: string) {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId,
        type: "SYSTEM_ALERT",
        action: "billing",
        description,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
