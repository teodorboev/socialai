/**
 * Client Billing Page
 * 
 * Shows current plan, usage, and provides self-service actions.
 * Uses Stripe Checkout for plan changes and Portal for billing management.
 */

import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/billing/currency";
import { getAvailablePlans } from "@/lib/billing/entitlements";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}

async function getSubscription(organizationId: string) {
  return prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      billingPlan: {
        include: {
          stripePrices: {
            where: { isActive: true },
            orderBy: { interval: "asc" },
          },
        },
      },
    },
  });
}

async function getPostCount(organizationId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return prisma.content.count({
    where: {
      organizationId,
      publishedAt: { gte: startOfMonth },
    },
  });
}

async function getPlatformCount(organizationId: string) {
  return prisma.socialAccount.count({
    where: { organizationId, isActive: true },
  });
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // Get organization from session (placeholder - implement auth)
  // For now, redirect if no org
  // const organizationId = await getCurrentOrganizationId()
  
  // TODO: Replace with actual auth
  const organizationId = "demo-org-id"; // Placeholder

  const subscription = await getSubscription(organizationId);
  const postsThisMonth = await getPostCount(organizationId);
  const platformsConnected = await getPlatformCount(organizationId);
  const availablePlans = await getAvailablePlans();

  async function handleCreateCheckout(formData: FormData) {
    "use server";
    
    const priceId = formData.get("priceId") as string;
    if (!priceId || !subscription?.stripeCustomerId) {
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
    
    const session = await createCheckoutSession({
      stripeCustomerId: subscription.stripeCustomerId,
      stripePriceId: priceId,
      successUrl: `${baseUrl}/mission-control/settings/billing?success=true`,
      cancelUrl: `${baseUrl}/mission-control/settings/billing?canceled=true`,
      currency: "usd",
      metadata: { organizationId },
    });

    if (session.url) {
      redirect(session.url);
    }
  }

  async function handleOpenPortal() {
    "use server";
    
    if (!subscription?.stripeCustomerId) {
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
    
    const session = await createPortalSession({
      stripeCustomerId: subscription.stripeCustomerId,
      returnUrl: `${baseUrl}/mission-control/settings/billing`,
    });

    if (session.url) {
      redirect(session.url);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      {params.success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          Your billing has been updated successfully!
        </div>
      )}

      {params.canceled && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
          Billing update was cancelled.
        </div>
      )}

      {/* Current Plan */}
      {subscription ? (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-3xl font-bold">{subscription.billingPlan.name}</div>
              <div className="text-muted-foreground">
                {subscription.billingPlan.stripePrices.find(p => p.interval === "month")
                  ? formatPrice(
                      subscription.billingPlan.stripePrices.find(p => p.interval === "month")!.unitAmount,
                      subscription.currency as any
                    )
                  : "—"
                }
                /month
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    subscription.status === "active"
                      ? "bg-green-100 text-green-800"
                      : subscription.status === "trialing"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {subscription.status}
                </span>
                
                {subscription.cancelAtPeriodEnd && (
                  <span className="text-xs text-red-600">
                    (Cancels {subscription.currentPeriodEnd.toLocaleDateString()})
                  </span>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {subscription.status === "trialing" && subscription.trialEnd ? (
                  <>Trial ends {subscription.trialEnd.toLocaleDateString()}</>
                ) : (
                  <>Next billing date: {subscription.currentPeriodEnd.toLocaleDateString()}</>
                )}
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="border-t mt-6 pt-6">
            <h3 className="font-medium mb-3">Usage This Month</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-2xl font-bold">{postsThisMonth}</div>
                <div className="text-sm text-muted-foreground">
                  / {subscription.billingPlan.maxPostsPerMonth === -1 
                    ? "∞" 
                    : subscription.billingPlan.maxPostsPerMonth} posts
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{platformsConnected}</div>
                <div className="text-sm text-muted-foreground">
                  / {subscription.billingPlan.maxPlatforms === -1 
                    ? "∞" 
                    : subscription.billingPlan.maxPlatforms} platforms
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{subscription.billingPlan.maxTeamMembers}</div>
                <div className="text-sm text-muted-foreground">team members</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t mt-6 pt-6 flex gap-4">
            <form action={handleOpenPortal}>
              <button
                type="submit"
                className="px-4 py-2 border rounded hover:bg-muted"
              >
                Manage Billing
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-6 text-center">
          <p className="text-muted-foreground mb-4">
            You don't have an active subscription yet.
          </p>
          <a
            href="/pricing"
            className="inline-flex px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            View Plans
          </a>
        </div>
      )}

      {/* Available Plans (for upgrade) */}
      {subscription && (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
          
          <div className="grid gap-4 md:grid-cols-3">
            {availablePlans
              .filter((plan) => plan.id !== subscription.billingPlanId)
              .map((plan) => {
                // prices is Record<currency, Record<interval, { amount, priceId }>>
                const monthlyPrice = (plan.prices as any)?.usd?.month;
                
                return (
                  <div key={plan.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <div className="text-2xl font-bold mt-2">
                      {monthlyPrice
                        ? formatPrice(monthlyPrice.amount, "usd")
                        : "—"}
                      {monthlyPrice && <span className="text-sm font-normal">/mo</span>}
                    </div>
                    
                    <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                      <li>{plan.maxPlatforms === -1 ? "∞" : plan.maxPlatforms} platforms</li>
                      <li>{plan.maxPostsPerMonth === -1 ? "∞" : plan.maxPostsPerMonth} posts/mo</li>
                      <li>{plan.maxTeamMembers} team members</li>
                    </ul>

                    <form action={handleCreateCheckout} className="mt-4">
                      <input type="hidden" name="priceId" value={monthlyPrice?.priceId} />
                      <button
                        type="submit"
                        disabled={!monthlyPrice?.priceId}
                        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                      >
                        Upgrade
                      </button>
                    </form>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
