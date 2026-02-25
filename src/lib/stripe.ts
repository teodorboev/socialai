import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.warn("STRIPE_SECRET_KEY not configured");
}

export const stripe = stripeKey
  ? new Stripe(stripeKey, {
      typescript: true,
    })
  : null;

// Plan definitions
export const PLANS = {
  STARTER: {
    name: "Starter",
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    price: 0,
    features: [
      "1 social account",
      "10 posts per month",
      "Basic analytics",
      "Email support",
    ],
  },
  GROWTH: {
    name: "Growth",
    priceId: process.env.STRIPE_GROWTH_PRICE_ID || "",
    price: 49,
    features: [
      "3 social accounts",
      "Unlimited posts",
      "Advanced analytics",
      "AI content generation",
      "Priority support",
    ],
  },
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    price: 99,
    features: [
      "10 social accounts",
      "Unlimited posts",
      "Full analytics suite",
      "AI engagement",
      "A/B testing",
      "Dedicated support",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    price: 299,
    features: [
      "Unlimited accounts",
      "Custom integrations",
      "White-label",
      "SLA guarantee",
      "Account manager",
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  if (!stripe) throw new Error("Stripe not configured");
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  if (!stripe) throw new Error("Stripe not configured");
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function getSubscription(subscriptionId: string) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.subscriptions.cancel(subscriptionId);
}
