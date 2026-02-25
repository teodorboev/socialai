---
name: billing
description: "Complete Stripe billing integration. Multi-currency, usage-based metering, plan management, trial handling, dunning, webhooks. Admin UI to manage plans and pricing without code changes. Orchestrator-integrated: controls agent access per plan, pauses agents on failed payment, triggers churn prediction."
---

# SKILL: Billing System (Stripe)

> This is a PLATFORM skill — not an agent.
> **Prerequisite**: Read `ai-first-ux` and `orchestrator` skills first.

---

## Purpose

Handles all billing: subscription creation, plan changes, trials, invoicing, failed payment recovery, multi-currency pricing, usage metering (for API/agency plans), and a Super Admin interface to manage plans and pricing without deploying code. Deeply integrated with the Orchestrator — billing controls which agents an org can use, pauses operations on failed payments, and triggers churn prediction on billing events.

**No hardcoded prices. No placeholder values. Everything is managed from the admin UI and stored in the database.**

---

## File Location

```
lib/billing/stripe.ts                   → Stripe SDK wrapper
lib/billing/plans.ts                    → Plan/feature resolution
lib/billing/metering.ts                 → Usage tracking
lib/billing/currency.ts                 → Multi-currency logic
lib/billing/entitlements.ts             → Feature gating per plan
lib/billing/dunning.ts                  → Failed payment recovery
app/api/webhooks/stripe/route.ts        → Stripe webhook handler
app/(mission-control)/billing/page.tsx  → Client billing page (minimal)
app/(admin)/billing/plans/page.tsx      → Super Admin plan management
app/(admin)/billing/clients/page.tsx    → Super Admin client billing overview
inngest/functions/billing-events.ts     → Orchestrator billing triggers
```

---

## Database

```prisma
// ════════════════════════════════════════════════════════
// PLAN DEFINITIONS (managed by Super Admin UI, not code)
// ════════════════════════════════════════════════════════

model BillingPlan {
  id              String   @id @default(uuid())
  name            String   // "Starter", "Growth", "Pro", "Agency", "Managed"
  slug            String   @unique // "starter", "growth", "pro", "agency", "managed"
  description     String?
  isActive        Boolean  @default(true)
  isPublic        Boolean  @default(true)  // Show on pricing page
  sortOrder       Int      @default(0)

  // Trial
  trialDays       Int      @default(14)

  // Limits
  maxPlatforms    Int      // 2, 4, -1 (unlimited)
  maxPostsPerMonth Int     // 40, 80, -1 (unlimited)
  maxBrands       Int      @default(1)
  maxTeamMembers  Int      @default(1)

  // Agent access (which agents this plan unlocks)
  agentTier       String   // "core", "intelligence", "full", "custom"
  enabledAgents   String[] // Explicit list if agentTier is "custom"

  // Feature flags
  features        Json     // { "creative_director": true, "roi_attribution": false, ... }

  // Stripe references (one per currency)
  stripePrices    StripePlanPrice[]

  // Usage-based pricing (for agency plans)
  isUsageBased    Boolean  @default(false)
  usageUnitName   String?  // "client", "post", "api_call"
  usageIncluded   Int?     // Included units before overage
  overagePerUnit  Json?    // { "usd": 0.50, "eur": 0.45 } per extra unit

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model StripePlanPrice {
  id              String   @id @default(uuid())
  billingPlanId   String
  billingPlan     BillingPlan @relation(fields: [billingPlanId], references: [id], onDelete: Cascade)

  currency        String   // "usd", "eur", "gbp", "brl", "jpy", etc.
  interval        String   // "month", "year"

  // Prices in smallest currency unit (cents, pence, yen, etc.)
  unitAmount      Int      // 19900 = $199.00, 17900 = €179.00

  // Stripe IDs (created when plan is saved in admin UI)
  stripeProductId String
  stripePriceId   String

  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([billingPlanId, currency, interval])
  @@index([stripePriceId])
}

// ════════════════════════════════════════════════════════
// ORG SUBSCRIPTIONS
// ════════════════════════════════════════════════════════

model Subscription {
  id                  String   @id @default(uuid())
  organizationId      String   @unique
  organization        Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  billingPlanId       String
  billingPlan         BillingPlan @relation(fields: [billingPlanId], references: [id])

  // Stripe
  stripeCustomerId    String   @unique
  stripeSubscriptionId String  @unique
  stripePriceId       String

  // State
  status              String   // "trialing", "active", "past_due", "canceled", "paused", "unpaid"
  currency            String   @default("usd")
  interval            String   @default("month") // "month", "year"
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime

  // Trial
  trialStart          DateTime?
  trialEnd            DateTime?

  // Cancellation
  cancelAtPeriodEnd   Boolean  @default(false)
  canceledAt          DateTime?
  cancellationReason  String?

  // Usage (for agency/metered plans)
  currentUsage        Int      @default(0)

  // Dunning
  failedPaymentCount  Int      @default(0)
  lastPaymentFailedAt DateTime?
  dunningStep         Int      @default(0) // 0=none, 1=first warning, 2=second, 3=final

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([status])
  @@index([stripeCustomerId])
}

// ════════════════════════════════════════════════════════
// BILLING EVENTS LOG
// ════════════════════════════════════════════════════════

model BillingEvent {
  id              String   @id @default(uuid())
  organizationId  String?
  eventType       String   // "subscription_created", "payment_succeeded", "payment_failed", "plan_changed", "canceled", "trial_ending", etc.
  stripeEventId   String?  @unique
  data            Json     // Raw event data
  processedAt     DateTime?
  createdAt       DateTime @default(now())

  @@index([organizationId, eventType])
  @@index([stripeEventId])
}
```

---

## Multi-Currency

```typescript
// lib/billing/currency.ts

const SUPPORTED_CURRENCIES = {
  usd: { symbol: "$", name: "US Dollar", locale: "en-US", zeroDecimal: false },
  eur: { symbol: "€", name: "Euro", locale: "de-DE", zeroDecimal: false },
  gbp: { symbol: "£", name: "British Pound", locale: "en-GB", zeroDecimal: false },
  brl: { symbol: "R$", name: "Brazilian Real", locale: "pt-BR", zeroDecimal: false },
  cad: { symbol: "CA$", name: "Canadian Dollar", locale: "en-CA", zeroDecimal: false },
  aud: { symbol: "A$", name: "Australian Dollar", locale: "en-AU", zeroDecimal: false },
  jpy: { symbol: "¥", name: "Japanese Yen", locale: "ja-JP", zeroDecimal: true },
  inr: { symbol: "₹", name: "Indian Rupee", locale: "en-IN", zeroDecimal: false },
  mxn: { symbol: "MX$", name: "Mexican Peso", locale: "es-MX", zeroDecimal: false },
} as const;

type SupportedCurrency = keyof typeof SUPPORTED_CURRENCIES;

function formatPrice(amountInSmallestUnit: number, currency: SupportedCurrency): string {
  const config = SUPPORTED_CURRENCIES[currency];
  const amount = config.zeroDecimal ? amountInSmallestUnit : amountInSmallestUnit / 100;
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: config.zeroDecimal ? 0 : 2,
  }).format(amount);
}

// Detect currency from user's location (set during signup or from browser)
function detectCurrency(countryCode: string): SupportedCurrency {
  const countryToCurrency: Record<string, SupportedCurrency> = {
    US: "usd", CA: "cad", GB: "gbp", AU: "aud", JP: "jpy",
    BR: "brl", MX: "mxn", IN: "inr",
    // EU countries
    DE: "eur", FR: "eur", IT: "eur", ES: "eur", NL: "eur",
    PT: "eur", BE: "eur", AT: "eur", IE: "eur", FI: "eur",
  };
  return countryToCurrency[countryCode] ?? "usd";
}
```

---

## Stripe SDK Wrapper

```typescript
// lib/billing/stripe.ts

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
  typescript: true,
});

export const billing = {

  // ── CUSTOMER ──────────────────────────────────────────

  async createCustomer(params: {
    organizationId: string;
    email: string;
    name: string;
    currency: SupportedCurrency;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        organizationId: params.organizationId,
        ...params.metadata,
      },
      preferred_locales: [SUPPORTED_CURRENCIES[params.currency].locale],
    });
  },

  // ── SUBSCRIPTION ──────────────────────────────────────

  async createSubscription(params: {
    stripeCustomerId: string;
    stripePriceId: string;
    trialDays?: number;
    currency: SupportedCurrency;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Subscription> {
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

    return stripe.subscriptions.create(subParams);
  },

  async changePlan(params: {
    stripeSubscriptionId: string;
    newStripePriceId: string;
  }): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(params.stripeSubscriptionId);
    return stripe.subscriptions.update(params.stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: params.newStripePriceId,
      }],
      proration_behavior: "always_invoice", // Charge/credit difference immediately
    });
  },

  async cancelSubscription(params: {
    stripeSubscriptionId: string;
    atPeriodEnd: boolean;
    reason?: string;
  }): Promise<Stripe.Subscription> {
    if (params.atPeriodEnd) {
      return stripe.subscriptions.update(params.stripeSubscriptionId, {
        cancel_at_period_end: true,
        metadata: { cancellation_reason: params.reason ?? "" },
      });
    }
    return stripe.subscriptions.cancel(params.stripeSubscriptionId);
  },

  async resumeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
  },

  // ── USAGE METERING (Agency plans) ─────────────────────

  async reportUsage(params: {
    stripeSubscriptionItemId: string;
    quantity: number;
    timestamp?: number;
  }): Promise<Stripe.UsageRecord> {
    return stripe.subscriptionItems.createUsageRecord(
      params.stripeSubscriptionItemId,
      {
        quantity: params.quantity,
        timestamp: params.timestamp ?? Math.floor(Date.now() / 1000),
        action: "set", // Absolute value, not increment
      }
    );
  },

  // ── CHECKOUT (for initial signup) ─────────────────────

  async createCheckoutSession(params: {
    stripeCustomerId: string;
    stripePriceId: string;
    trialDays?: number;
    successUrl: string;
    cancelUrl: string;
    currency: SupportedCurrency;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    return stripe.checkout.sessions.create({
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
  },

  // ── CUSTOMER PORTAL (self-service billing) ────────────

  async createPortalSession(params: {
    stripeCustomerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
  },

  // ── SYNC PRODUCTS/PRICES TO STRIPE ────────────────────

  async syncPlanToStripe(plan: BillingPlan & { stripePrices: StripePlanPrice[] }): Promise<void> {
    // Create or update Stripe Product
    let productId: string;

    const existingPrices = plan.stripePrices;
    if (existingPrices.length > 0 && existingPrices[0].stripeProductId) {
      productId = existingPrices[0].stripeProductId;
      await stripe.products.update(productId, {
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
      const product = await stripe.products.create({
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
  },

  async syncPriceToStripe(params: {
    stripeProductId: string;
    currency: SupportedCurrency;
    interval: "month" | "year";
    unitAmount: number;
    existingStripePriceId?: string;
  }): Promise<string> {
    // Stripe prices are immutable — if amount changed, create new and archive old
    if (params.existingStripePriceId) {
      const existing = await stripe.prices.retrieve(params.existingStripePriceId);
      if (existing.unit_amount === params.unitAmount) {
        return existing.id; // No change needed
      }
      // Archive old price
      await stripe.prices.update(params.existingStripePriceId, { active: false });
    }

    // Create new price
    const price = await stripe.prices.create({
      product: params.stripeProductId,
      currency: params.currency,
      unit_amount: params.unitAmount,
      recurring: { interval: params.interval },
    });

    return price.id;
  },
};
```

---

## Entitlements (Feature Gating)

```typescript
// lib/billing/entitlements.ts

import { cache } from "react";

// Agent tier definitions — which agents each tier unlocks
const AGENT_TIERS: Record<string, string[]> = {
  core: [
    "CONTENT_CREATOR", "ENGAGEMENT", "PUBLISHER", "ANALYTICS",
    "STRATEGY", "TREND_SCOUT", "COMPLIANCE", "CONTENT_REPLENISHMENT",
    "CALENDAR_OPTIMIZER", "HASHTAG_OPTIMIZER",
  ],
  intelligence: [
    // All core agents plus:
    "COMPETITOR_INTELLIGENCE", "SOCIAL_LISTENING", "AUDIENCE_INTELLIGENCE",
    "INFLUENCER_SCOUT", "SOCIAL_SEO", "CAPTION_REWRITER",
    "BRAND_VOICE_GUARDIAN", "REPORTING_NARRATOR",
  ],
  full: [
    // All intelligence agents plus:
    "CREATIVE_DIRECTOR", "PREDICTIVE_CONTENT", "ROI_ATTRIBUTION",
    "CROSS_CHANNEL_ATTRIBUTION", "AD_COPY", "SENTIMENT_INTELLIGENCE",
    "COMPETITIVE_AD_INTELLIGENCE", "PRICING_INTELLIGENCE",
    "COMMUNITY_BUILDER", "MEDIA_PITCH", "UGC_CURATOR",
    "REVIEW_RESPONSE", "REPURPOSE", "LOCALIZATION",
    "CHURN_PREDICTION", "ONBOARDING_INTELLIGENCE",
  ],
};

// Always expand tiers cumulatively
function getAgentsForTier(tier: string): string[] {
  switch (tier) {
    case "core": return AGENT_TIERS.core;
    case "intelligence": return [...AGENT_TIERS.core, ...AGENT_TIERS.intelligence];
    case "full": return [...AGENT_TIERS.core, ...AGENT_TIERS.intelligence, ...AGENT_TIERS.full];
    default: return AGENT_TIERS.core;
  }
}

export const getEntitlements = cache(async (organizationId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { billingPlan: true },
  });

  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return {
      isActive: false,
      plan: null,
      enabledAgents: [],
      maxPlatforms: 0,
      maxPostsPerMonth: 0,
      maxBrands: 0,
      maxTeamMembers: 0,
      features: {},
      canPublish: false,
      reason: subscription?.status === "past_due" ? "payment_past_due" : "no_subscription",
    };
  }

  const plan = subscription.billingPlan;
  const enabledAgents = plan.agentTier === "custom"
    ? plan.enabledAgents
    : getAgentsForTier(plan.agentTier);

  return {
    isActive: true,
    plan,
    enabledAgents,
    maxPlatforms: plan.maxPlatforms,
    maxPostsPerMonth: plan.maxPostsPerMonth,
    maxBrands: plan.maxBrands,
    maxTeamMembers: plan.maxTeamMembers,
    features: plan.features as Record<string, boolean>,
    canPublish: true,
    currentUsage: subscription.currentUsage,
    usageLimit: plan.usageIncluded,
  };
});

// Used by Orchestrator before dispatching any agent:
export async function canRunAgent(organizationId: string, agentName: string): Promise<boolean> {
  const entitlements = await getEntitlements(organizationId);
  if (!entitlements.isActive) return false;
  return entitlements.enabledAgents.includes(agentName);
}

// Used by Publisher before scheduling:
export async function canPublish(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const entitlements = await getEntitlements(organizationId);

  if (!entitlements.isActive) {
    return { allowed: false, reason: entitlements.reason };
  }

  if (entitlements.maxPostsPerMonth !== -1) {
    const postsThisMonth = await prisma.content.count({
      where: {
        organizationId,
        publishedAt: { gte: startOfMonth(new Date()) },
      },
    });

    if (postsThisMonth >= entitlements.maxPostsPerMonth) {
      return { allowed: false, reason: "monthly_post_limit_reached" };
    }
  }

  return { allowed: true };
}
```

---

## Orchestrator Integration

```typescript
// In Orchestrator's runAgent function — add billing gate:

async function runAgent(
  organizationId: string,
  step: InngestStep,
  agentName: string,
  input: any,
): Promise<AgentResult> {
  // BILLING GATE: Check if this org's plan includes this agent
  const allowed = await canRunAgent(organizationId, agentName);
  if (!allowed) {
    await logActivity(organizationId, `Skipped ${agentName} — not included in current plan`);
    return { status: "skipped", reason: "plan_limit" };
  }

  // BILLING GATE: Check subscription is active
  const entitlements = await getEntitlements(organizationId);
  if (!entitlements.canPublish && agentName === "PUBLISHER") {
    await logActivity(organizationId, `⚠️ Publishing paused — ${entitlements.reason}`);
    return { status: "blocked", reason: entitlements.reason };
  }

  // Proceed with agent execution...
}

// In Orchestrator's runPipelineForAllOrgs — filter to active subscriptions:

async function runPipelineForAllOrgs(step: InngestStep, pipelineId: string) {
  const activeOrgs = await step.run("get-active-orgs", () =>
    prisma.subscription.findMany({
      where: { status: { in: ["active", "trialing"] } },
      select: { organizationId: true },
    })
  );

  for (const org of activeOrgs) {
    await runPipeline(org.organizationId, step, pipelineId);
  }
}
```

---

## Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts

import { headers } from "next/headers";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed`, { status: 400 });
  }

  // Log every event
  await prisma.billingEvent.create({
    data: {
      eventType: event.type,
      stripeEventId: event.id,
      data: event.data.object as any,
    },
  });

  switch (event.type) {

    // ── SUBSCRIPTION LIFECYCLE ─────────────────────────

    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionCreated(sub);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(sub);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(sub);
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      await handleTrialEnding(sub);
      break;
    }

    // ── PAYMENT EVENTS ─────────────────────────────────

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentSucceeded(invoice);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }

    // ── CHECKOUT ────────────────────────────────────────

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }
  }

  return new Response("ok", { status: 200 });
}

// ── HANDLERS ──────────────────────────────────────────────

async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  const organizationId = sub.metadata.organizationId;
  if (!organizationId) return;

  const stripePriceId = sub.items.data[0].price.id;
  const planPrice = await prisma.stripePlanPrice.findFirst({
    where: { stripePriceId },
    include: { billingPlan: true },
  });
  if (!planPrice) return;

  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      billingPlanId: planPrice.billingPlanId,
      stripeSubscriptionId: sub.id,
      stripePriceId,
      status: sub.status,
      currency: sub.currency as string,
      interval: planPrice.interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
    create: {
      organizationId,
      billingPlanId: planPrice.billingPlanId,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      stripePriceId,
      status: sub.status,
      currency: sub.currency as string,
      interval: planPrice.interval,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
  });

  // Trigger Orchestrator: start onboarding pipeline
  await inngest.send({
    name: "billing/subscription-activated",
    data: { organizationId, planSlug: planPrice.billingPlan.slug },
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const organizationId = sub.metadata.organizationId;
  if (!organizationId) return;

  const stripePriceId = sub.items.data[0].price.id;
  const planPrice = await prisma.stripePlanPrice.findFirst({
    where: { stripePriceId },
    include: { billingPlan: true },
  });

  const updateData: any = {
    status: sub.status,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };

  if (planPrice) {
    updateData.billingPlanId = planPrice.billingPlanId;
    updateData.stripePriceId = stripePriceId;
  }

  await prisma.subscription.update({
    where: { organizationId },
    data: updateData,
  });

  // If plan changed → log activity
  if (planPrice) {
    await logActivity(organizationId, `Plan changed to ${planPrice.billingPlan.name}`);
  }

  // If past_due → trigger dunning + churn prediction
  if (sub.status === "past_due") {
    await inngest.send({
      name: "billing/payment-past-due",
      data: { organizationId },
    });
  }

  // If canceled → pause all operations
  if (sub.status === "canceled") {
    await inngest.send({
      name: "billing/subscription-canceled",
      data: { organizationId, reason: sub.metadata.cancellation_reason },
    });
  }
}

async function handleSubscriptionCanceled(sub: Stripe.Subscription) {
  const organizationId = sub.metadata.organizationId;
  if (!organizationId) return;

  await prisma.subscription.update({
    where: { organizationId },
    data: { status: "canceled", canceledAt: new Date() },
  });

  await logActivity(organizationId, "⚠️ Subscription canceled — all AI operations paused");

  await inngest.send({
    name: "billing/subscription-canceled",
    data: { organizationId },
  });
}

async function handleTrialEnding(sub: Stripe.Subscription) {
  const organizationId = sub.metadata.organizationId;
  if (!organizationId) return;

  // Create attention item: trial ending in 3 days
  await createAttentionItem(organizationId, {
    type: "trial_ending",
    title: "Your free trial ends in 3 days",
    description: "Add a payment method to keep your AI running. All your content, settings, and AI training will be preserved.",
    priority: "high",
    deadline: new Date(sub.trial_end! * 1000),
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
  });
  if (!sub) return;

  // Reset dunning state
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { failedPaymentCount: 0, dunningStep: 0, lastPaymentFailedAt: null },
  });

  await logActivity(sub.organizationId, "Payment processed successfully");
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
  });
  if (!sub) return;

  const newFailCount = sub.failedPaymentCount + 1;
  const dunningStep = Math.min(newFailCount, 3);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      failedPaymentCount: newFailCount,
      lastPaymentFailedAt: new Date(),
      dunningStep,
    },
  });

  // Trigger dunning sequence
  await inngest.send({
    name: "billing/payment-failed",
    data: {
      organizationId: sub.organizationId,
      failCount: newFailCount,
      dunningStep,
    },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Subscription creation is handled by customer.subscription.created webhook
  // This is for post-checkout actions like sending welcome email
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) return;

  await logActivity(organizationId, "Welcome! Your subscription is active. AI is starting up...");
}
```

---

## Dunning (Failed Payment Recovery)

```typescript
// inngest/functions/billing-events.ts

export const handlePaymentFailed = inngest.createFunction(
  { id: "billing-payment-failed" },
  { event: "billing/payment-failed" },
  async ({ event, step }) => {
    const { organizationId, failCount, dunningStep } = event.data;

    switch (dunningStep) {
      case 1:
        // Day 0: Soft notification
        await step.run("dunning-1", async () => {
          await createAttentionItem(organizationId, {
            type: "payment_failed",
            title: "Payment failed — please update your card",
            description: "We couldn't process your payment. Update your payment method to keep your AI running.",
            priority: "high",
          });
          // Send email
          await sendEmail(organizationId, "payment_failed_soft", {
            portalUrl: await createPortalUrl(organizationId),
          });
          await logActivity(organizationId, "⚠️ Payment failed — please update your payment method");
        });
        break;

      case 2:
        // Day 3-5: Firm warning
        await step.run("dunning-2", async () => {
          await sendEmail(organizationId, "payment_failed_warning", {
            portalUrl: await createPortalUrl(organizationId),
            daysUntilPause: 7,
          });
          await logActivity(organizationId, "⚠️ Second payment attempt failed — service will pause in 7 days");
        });
        break;

      case 3:
        // Day 7-10: Final warning, pause non-essential agents
        await step.run("dunning-3", async () => {
          // Pause intelligence + premium agents, keep core running
          await prisma.subscription.update({
            where: { organizationId },
            data: { status: "past_due" },
          });
          await sendEmail(organizationId, "payment_failed_final", {
            portalUrl: await createPortalUrl(organizationId),
          });
          await logActivity(organizationId, "🔴 Service degraded — only core agents active until payment is resolved");

          // Trigger churn prediction
          await inngest.send({
            name: "billing/payment-failed",
            data: { organizationId },
          });
        });
        break;
    }
  }
);

export const handleSubscriptionCanceled = inngest.createFunction(
  { id: "billing-subscription-canceled" },
  { event: "billing/subscription-canceled" },
  async ({ event, step }) => {
    const { organizationId, reason } = event.data;

    // Pause ALL Orchestrator operations for this org
    // (The Orchestrator already checks subscription status before running pipelines)

    // Send cancellation email with win-back offer
    await step.run("send-cancellation-email", async () => {
      await sendEmail(organizationId, "subscription_canceled", { reason });
    });

    // Log for churn analysis
    await step.run("log-churn", async () => {
      await memory.store({
        organizationId,
        content: `Client canceled subscription. Reason: ${reason ?? "not provided"}`,
        memoryType: "strategy_decision",
        agentSource: "BILLING",
        importance: 1.0,
      });
    });
  }
);
```

---

## Client Billing Page (Mission Control)

The client sees minimal billing UI — just enough to manage their subscription. Accessed via their profile or "Talk to AI":

```
Human: "Change my plan" or "Update my card"
AI: Opens Stripe Customer Portal via createPortalSession()
```

Or in Mission Control profile menu:

```
┌─────────────────────────────────┐
│ Your Plan: Growth ($399/mo)     │
│ Next billing: March 15, 2026    │
│ Status: ✅ Active               │
│                                 │
│ [Change Plan] [Manage Billing]  │
│                                 │
│ Usage this month:               │
│ Posts: 47 / 80                  │
│ Platforms: 3 / 4                │
└─────────────────────────────────┘
```

Both buttons open Stripe's hosted portal — no custom payment forms needed.

---

## Super Admin: Plan Management UI

```
┌──────────────────────────────────────────────────────────────────────┐
│ 💰 Plan Management                                       [+ New Plan]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ STARTER                                            [Edit] [↕]   │ │
│ │ Slug: starter | Agent tier: core | Active: ✅ | Public: ✅      │ │
│ │                                                                  │ │
│ │ Limits: 2 platforms, 40 posts/mo, 1 brand, 1 team member       │ │
│ │ Trial: 14 days                                                  │ │
│ │                                                                  │ │
│ │ Pricing:                                                         │ │
│ │ ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │ │
│ │ │ Currency │ Monthly  │ Yearly   │ Monthly  │ Yearly   │       │ │
│ │ │          │ Amount   │ Amount   │ Stripe   │ Stripe   │       │ │
│ │ ├──────────┼──────────┼──────────┼──────────┼──────────┤       │ │
│ │ │ USD      │ $199     │ $2,148   │ price_x1 │ price_x2 │       │ │
│ │ │ EUR      │ €189     │ €2,039   │ price_x3 │ price_x4 │       │ │
│ │ │ GBP      │ £169     │ £1,823   │ price_x5 │ price_x6 │       │ │
│ │ │ BRL      │ R$499    │ R$5,389  │ price_x7 │ price_x8 │       │ │
│ │ └──────────┴──────────┴──────────┴──────────┴──────────┘       │ │
│ │ [+ Add Currency]                                                 │ │
│ │                                                                  │ │
│ │ Active subscribers: 23                                           │ │
│ │ MRR from this plan: $4,577                                      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ GROWTH                                             [Edit] [↕]   │ │
│ │ Slug: growth | Agent tier: intelligence | Active: ✅ | Public: ✅│ │
│ │ ...                                                              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ PRO                                                [Edit] [↕]   │ │
│ │ Slug: pro | Agent tier: full | Active: ✅ | Public: ✅           │ │
│ │ ...                                                              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ AGENCY                                             [Edit] [↕]   │ │
│ │ Slug: agency | Agent tier: full | Usage-based: ✅               │ │
│ │ Usage unit: "client" | Included: 5 | Overage: $85/client        │ │
│ │ ...                                                              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Plan Edit Form

```
┌──────────────────────────────────────────────────────────────────┐
│ Edit Plan: Growth                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Name: [Growth                    ]                               │
│ Slug: [growth                    ] (URL-safe, cannot change)     │
│ Description: [Full AI social media management with intelligence] │
│                                                                  │
│ ☑ Active  ☑ Public (show on pricing page)                       │
│                                                                  │
│ ── Limits ──────────────────────────────────────────────         │
│ Max platforms:     [4       ] (-1 for unlimited)                 │
│ Max posts/month:   [80      ] (-1 for unlimited)                 │
│ Max brands:        [1       ]                                    │
│ Max team members:  [3       ]                                    │
│ Trial days:        [14      ]                                    │
│                                                                  │
│ ── Agent Access ────────────────────────────────────────         │
│ Agent tier: ● Core  ● Intelligence  ○ Full  ○ Custom            │
│                                                                  │
│ (If Custom selected: checklist of all 39 agents)                 │
│                                                                  │
│ ── Features ────────────────────────────────────────────         │
│ ☑ Creative Director (image generation)                           │
│ ☐ ROI Attribution                                                │
│ ☐ Predictive Content                                             │
│ ☑ Viewer Dashboard                                               │
│ ☐ Ad Copy Generation                                             │
│ ☐ Media Pitch                                                    │
│ ☑ Community Builder                                              │
│                                                                  │
│ ── Pricing ─────────────────────────────────────────────         │
│                                                                  │
│ USD:  Monthly [$399.00   ]  Yearly [$4,189.00  ] ($/yr saved)   │
│ EUR:  Monthly [€379.00   ]  Yearly [€3,989.00  ]                │
│ GBP:  Monthly [£339.00   ]  Yearly [£3,589.00  ]                │
│ BRL:  Monthly [R$999.00  ]  Yearly [R$10,789.00]                │
│ [+ Add Currency]                                                 │
│                                                                  │
│ ── Usage-Based (optional) ──────────────────────────────         │
│ ☐ Enable usage-based pricing                                     │
│ Unit name: [            ]                                        │
│ Included:  [            ]                                        │
│ Overage:   [            ] per unit                               │
│                                                                  │
│ [Save & Sync to Stripe]  [Cancel]                                │
│                                                                  │
│ ⚠️ Changing prices creates new Stripe prices and archives old     │
│   ones. Existing subscribers keep their current price until      │
│   they change plans.                                              │
└──────────────────────────────────────────────────────────────────┘
```

### Save & Sync Logic

```typescript
// When admin clicks "Save & Sync to Stripe":

async function savePlan(planId: string, formData: PlanFormData) {
  // 1. Update plan in database
  const plan = await prisma.billingPlan.update({
    where: { id: planId },
    data: {
      name: formData.name,
      description: formData.description,
      isActive: formData.isActive,
      isPublic: formData.isPublic,
      maxPlatforms: formData.maxPlatforms,
      maxPostsPerMonth: formData.maxPostsPerMonth,
      maxBrands: formData.maxBrands,
      maxTeamMembers: formData.maxTeamMembers,
      trialDays: formData.trialDays,
      agentTier: formData.agentTier,
      enabledAgents: formData.enabledAgents,
      features: formData.features,
      isUsageBased: formData.isUsageBased,
      usageUnitName: formData.usageUnitName,
      usageIncluded: formData.usageIncluded,
      overagePerUnit: formData.overagePerUnit,
    },
  });

  // 2. Sync product to Stripe
  const stripeProductId = await billing.syncPlanToStripe(plan);

  // 3. Sync each currency × interval price to Stripe
  for (const priceData of formData.prices) {
    const existingPrice = await prisma.stripePlanPrice.findFirst({
      where: {
        billingPlanId: planId,
        currency: priceData.currency,
        interval: priceData.interval,
      },
    });

    const stripePriceId = await billing.syncPriceToStripe({
      stripeProductId,
      currency: priceData.currency as SupportedCurrency,
      interval: priceData.interval as "month" | "year",
      unitAmount: priceData.unitAmount,
      existingStripePriceId: existingPrice?.stripePriceId,
    });

    await prisma.stripePlanPrice.upsert({
      where: {
        billingPlanId_currency_interval: {
          billingPlanId: planId,
          currency: priceData.currency,
          interval: priceData.interval,
        },
      },
      update: {
        unitAmount: priceData.unitAmount,
        stripeProductId,
        stripePriceId,
      },
      create: {
        billingPlanId: planId,
        currency: priceData.currency,
        interval: priceData.interval,
        unitAmount: priceData.unitAmount,
        stripeProductId,
        stripePriceId,
      },
    });
  }
}
```

---

## Super Admin: Client Billing Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ 💰 Client Billing Overview                                          │
│                                                                      │
│ MRR: $14,577  |  Active: 43  |  Trialing: 7  |  Past Due: 2       │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Org          │ Plan    │ Status    │ MRR    │ Since    │ Actions    │
│──────────────┼─────────┼───────────┼────────┼──────────┼────────────│
│ PureGlow     │ Growth  │ ✅ Active │ $399   │ Jan 2026 │ [View]     │
│ TechStartup  │ Pro     │ ✅ Active │ $799   │ Dec 2025 │ [View]     │
│ FoodiesCo    │ Starter │ ⚠️ Due    │ $199   │ Feb 2026 │ [View]     │
│ StyleHouse   │ Growth  │ 🕐 Trial  │ -      │ Feb 2026 │ [View]     │
│ ...          │         │           │        │          │            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Onboarding → Billing Flow

```
1. User signs up (Supabase Auth)
2. Onboarding conversation starts
3. After plan review, AI shows pricing:
   "Ready to launch! Here are your options:"
   [Starter $199/mo] [Growth $399/mo] [Pro $799/mo]
   "All plans come with a 14-day free trial."
4. User picks a plan → Stripe Checkout Session opens
5. User enters payment method → trial starts
6. Webhook fires → Subscription created → Orchestrator starts
7. Onboarding pipeline runs → first content generated
```

---

## Rules

1. **No hardcoded prices anywhere in the codebase.** All pricing comes from the BillingPlan + StripePlanPrice tables, managed via Super Admin UI.
2. **Stripe is the source of truth for payment state.** Local DB mirrors Stripe via webhooks. Never trust local status over Stripe.
3. **Idempotent webhook handling.** Use stripeEventId uniqueness constraint to prevent duplicate processing.
4. **Graceful degradation on past_due.** Don't immediately kill everything. Downgrade to core agents first, give the client time to fix payment.
5. **Never expose Stripe keys client-side.** All Stripe interactions happen server-side. Client only gets Checkout Session URLs and Portal URLs.
6. **Test with Stripe CLI.** `stripe listen --forward-to localhost:3000/api/webhooks/stripe` during development.
7. **Price changes don't affect existing subscribers.** Stripe prices are immutable. New prices apply to new subscribers. Existing ones keep their price until they change plans.
8. **Always include tax_id_collection.** Required for EU VAT compliance, also useful for B2B clients in other regions.
