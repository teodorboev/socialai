/**
 * Billing - Stripe SDK Wrapper
 * 
 * Provides all Stripe operations needed for the billing system:
 * - Customer management
 * - Subscription CRUD
 * - Checkout & Portal sessions
 * - Usage metering
 * - Plan/price sync to Stripe
 */

import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import type { SupportedCurrency } from "./currency";

// Lazy initialization of Stripe to avoid build-time errors
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("Stripe is not initialized. Please set STRIPE_SECRET_KEY environment variable.");
    }
    _stripe = new Stripe(apiKey, {
      apiVersion: "2026-02-25.clover" as any,
      typescript: true,
    });
  }
  return _stripe;
}

export { getStripe, stripe };

// Re-export stripe for backwards compatibility (lazy-loaded)
const stripe = {
  get customer() { return getStripe().customers; },
  get subscription() { return getStripe().subscriptions; },
  get subscriptionItems() { return getStripe().subscriptionItems; },
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
  get products() { return getStripe().products; },
  get prices() { return getStripe().prices; },
  get invoices() { return getStripe().invoices; },
};

// ============================================================
// TYPES
// ============================================================

export interface CreateCustomerParams {
  organizationId: string;
  email: string;
  name: string;
  currency: SupportedCurrency;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionParams {
  stripeCustomerId: string;
  stripePriceId: string;
  trialDays?: number;
  currency: SupportedCurrency;
  metadata?: Record<string, string>;
}

export interface ChangePlanParams {
  stripeSubscriptionId: string;
  newStripePriceId: string;
}

export interface CancelSubscriptionParams {
  stripeSubscriptionId: string;
  atPeriodEnd?: boolean;
  reason?: string;
}

export interface CreateCheckoutSessionParams {
  stripeCustomerId: string;
  stripePriceId: string;
  trialDays?: number;
  currency: SupportedCurrency;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePortalSessionParams {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface SyncPriceParams {
  stripeProductId: string;
  billingPlanId: string;
  currency: SupportedCurrency;
  interval: "month" | "year";
  unitAmount: number;
  existingStripePriceId?: string;
}

// ============================================================
// CUSTOMER OPERATIONS
// ============================================================

export async function createCustomer(params: CreateCustomerParams): Promise<Stripe.Customer> {
  const { SUPPORTED_CURRENCIES } = await import("./currency");
  
  return getStripe().customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      organizationId: params.organizationId,
      ...params.metadata,
    },
    preferred_locales: [SUPPORTED_CURRENCIES[params.currency].locale],
  });
}

export async function getCustomer(stripeCustomerId: string): Promise<Stripe.Customer> {
  return getStripe().customers.retrieve(stripeCustomerId) as Promise<Stripe.Customer>;
}

export async function updateCustomer(
  stripeCustomerId: string,
  params: Partial<Stripe.CustomerUpdateParams>
): Promise<Stripe.Customer> {
  return getStripe().customers.update(stripeCustomerId, params);
}

// ============================================================
// SUBSCRIPTION OPERATIONS
// ============================================================

export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<Stripe.Subscription> {
  const subParams: Stripe.SubscriptionCreateParams = {
    customer: params.stripeCustomerId,
    items: [{ price: params.stripePriceId }],
    currency: params.currency,
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
      payment_method_options: {
        card: {
          request_three_d_secure: "automatic",
        },
      },
    },
    expand: ["latest_invoice.payment_intent"],
    metadata: params.metadata ?? {},
  };

  if (params.trialDays && params.trialDays > 0) {
    subParams.trial_period_days = params.trialDays;
    subParams.trial_settings = {
      end_behavior: { missing_payment_method: "cancel" },
    };
  }

  return getStripe().subscriptions.create(subParams);
}

export async function getSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(stripeSubscriptionId);
}

export async function changePlan(params: ChangePlanParams): Promise<Stripe.Subscription> {
  const subscription = await getStripe().subscriptions.retrieve(params.stripeSubscriptionId);
  
  return getStripe().subscriptions.update(params.stripeSubscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: params.newStripePriceId,
    }],
    proration_behavior: "always_invoice",
  });
}

export async function cancelSubscription(
  params: CancelSubscriptionParams
): Promise<Stripe.Subscription> {
  if (params.atPeriodEnd) {
    return getStripe().subscriptions.update(params.stripeSubscriptionId, {
      cancel_at_period_end: true,
      metadata: { cancellation_reason: params.reason ?? "" },
    });
  }
  
  return getStripe().subscriptions.cancel(params.stripeSubscriptionId);
}

export async function resumeSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function updateSubscription(
  stripeSubscriptionId: string,
  params: Partial<Stripe.SubscriptionUpdateParams>
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(stripeSubscriptionId, params);
}

// ============================================================
// USAGE METERING (Agency Plans)
// ============================================================

// Type for usage record response
interface UsageRecordResponse {
  id: string;
  object: "usage_record";
  subscription_item: string;
  quantity: number;
  timestamp: number;
  action: "increment" | "set";
}

export async function reportUsage(params: {
  stripeSubscriptionItemId: string;
  quantity: number;
  timestamp?: number;
}): Promise<UsageRecordResponse> {
  // @ts-ignore - Stripe SDK typing issue with usage records
  return getStripe().subscriptionItems.createUsageRecord(
    params.stripeSubscriptionItemId,
    {
      quantity: params.quantity,
      timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
      action: "set",
    }
  );
}

interface UsageRecordSummary {
  id: string;
  object: "usage_record_summary";
  subscription_item: string;
  period_start: number;
  period_end: number;
  total_usage: number;
}

export async function getUsageRecords(
  stripeSubscriptionItemId: string,
  params?: {
    limit?: number;
    ending_before?: string;
    starting_after?: string;
  }
): Promise<UsageRecordSummary[]> {
  // @ts-ignore - Stripe SDK typing issue
  const result = await getStripe().subscriptionItems.listUsageRecordSummaries(
    stripeSubscriptionItemId,
    {
      limit: params?.limit ?? 100,
    }
  );
  return result.data as unknown as UsageRecordSummary[];
}

// ============================================================
// CHECKOUT SESSION
// ============================================================

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create({
    customer: params.stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: params.stripePriceId, quantity: 1 }],
    currency: params.currency,
    subscription_data: {
      trial_period_days: params.trialDays,
      metadata: params.metadata ?? {},
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    tax_id_collection: { enabled: true },
  });
}

// ============================================================
// CUSTOMER PORTAL
// ============================================================

export async function createPortalSession(
  params: CreatePortalSessionParams
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });
}

// ============================================================
// STRIPE PRODUCT/PRICE SYNC
// ============================================================

interface PlanWithPrices {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  slug: string;
  agentTier: string;
  stripePrices: Array<{
    id: string;
    currency: string;
    interval: string;
    unitAmount: number;
    stripeProductId: string | null;
    stripePriceId: string | null;
  }>;
}

export async function syncPlanToStripe(plan: PlanWithPrices): Promise<string> {
  let productId: string;

  const existingPrices = plan.stripePrices;
  if (existingPrices.length > 0 && existingPrices[0].stripeProductId) {
    productId = existingPrices[0].stripeProductId;
    await getStripe().products.update(productId, {
      name: plan.name,
      description: plan.description ?? undefined,
      active: plan.isActive,
      metadata: {
        planId: plan.id,
        slug: plan.slug,
        agentTier: plan.agentTier,
      },
    });
  } else {
    const product = await getStripe().products.create({
      name: plan.name,
      description: plan.description ?? undefined,
      active: plan.isActive,
      metadata: {
        planId: plan.id,
        slug: plan.slug,
        agentTier: plan.agentTier,
      },
    });
    productId = product.id;
  }

  return productId;
}

export async function syncPriceToStripe(
  params: SyncPriceParams
): Promise<string> {
  // Stripe prices are immutable — if amount changed, create new and archive old
  if (params.existingStripePriceId) {
    const existing = await getStripe().prices.retrieve(params.existingStripePriceId);
    if (existing.unit_amount === params.unitAmount) {
      return existing.id;
    }
    // Archive old price
    await getStripe().prices.update(params.existingStripePriceId, { active: false });
  }

  // Create new price
  const price = await getStripe().prices.create({
    product: params.stripeProductId,
    currency: params.currency,
    unit_amount: params.unitAmount,
    recurring: { interval: params.interval },
  });

  return price.id;
}

// ============================================================
// HELPER: Get or create Stripe customer for organization
// ============================================================

export async function getOrCreateStripeCustomer(organizationId: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  // Get organization details
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        where: { role: "OWNER" },
      },
    },
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  // Get owner email from Supabase or use placeholder
  const ownerEmail = `${organization.slug}@socialai.app`;

  // Create Stripe customer
  const customer = await createCustomer({
    organizationId,
    email: ownerEmail,
    name: organization.name,
    currency: "usd",
  });

  return customer.id;
}

// ============================================================
// PRICE LOOKUP
// ============================================================

export async function getPriceForPlanAndCurrency(
  billingPlanId: string,
  currency: SupportedCurrency,
  interval: "month" | "year"
): Promise<string | null> {
  const price = await prisma.stripePlanPrice.findFirst({
    where: {
      billingPlanId,
      currency,
      interval,
      isActive: true,
    },
  });

  return price?.stripePriceId ?? null;
}

// ============================================================
// INVOICE OPERATIONS
// ============================================================

interface UpcomingInvoiceParams {
  customer: string;
  subscription?: string;
  coupon?: string;
}

export async function getUpcomingInvoice(
  stripeCustomerId: string,
  params?: {
    subscription?: string;
    coupon?: string;
  }
): Promise<Stripe.Invoice> {
  // @ts-ignore - Stripe SDK typing
  return getStripe().invoices.retrieveUpcoming({
    customer: stripeCustomerId,
    subscription: params?.subscription,
    coupon: params?.coupon,
  } as UpcomingInvoiceParams);
}

export async function listInvoices(
  stripeCustomerId: string,
  params?: {
    limit?: number;
    status?: Stripe.InvoiceListParams.Status;
  }
): Promise<Stripe.Invoice[]> {
  const { data } = await getStripe().invoices.list({
    customer: stripeCustomerId,
    limit: params?.limit ?? 10,
    status: params?.status,
  });
  return data;
}
