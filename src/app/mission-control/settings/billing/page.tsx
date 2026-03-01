/**
 * Client Billing Page
 * 
 * Shows current plan, usage, and provides self-service actions.
 * Uses Stripe Checkout for plan changes and Portal for billing management.
 */

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/billing/currency";
import { getAvailablePlans } from "@/lib/billing/entitlements";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Check, AlertCircle, Loader2, LogOut } from "lucide-react";
import Link from "next/link";

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

async function getOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  return orgMember?.organization_id || null;
}

export default async function BillingPage({ searchParams }: PageProps) {
  // Explicitly opt into dynamic rendering for production PPR
  await connection();

  const params = await searchParams;

  // Get organization from authenticated user
  const organizationId = await getOrganizationId();

  if (!organizationId) {
    redirect("/login");
  }

  const [subscription, postsThisMonth, platformsConnected, availablePlans, organization] = await Promise.all([
    getSubscription(organizationId),
    getPostCount(organizationId),
    getPlatformCount(organizationId),
    getAvailablePlans(),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, trialEndsAt: true },
    }),
  ]);

  async function handleCreateCheckout(formData: FormData) {
    "use server";

    const priceId = formData.get("priceId") as string;
    if (!priceId) return;

    // Get fresh organization data
    const orgId = await getOrganizationId();
    if (!orgId) return;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    });

    let customerId: string;

    if (!org?.stripeCustomerId) {
      // Create customer if doesn't exist
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create Stripe customer
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { organizationId: orgId },
      });

      await prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customer.id },
      });

      customerId = customer.id;
    } else {
      customerId = org.stripeCustomerId;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      successUrl: `${baseUrl}/mission-control/settings/billing?success=true`,
      cancelUrl: `${baseUrl}/mission-control/settings/billing?canceled=true`,
      currency: "usd",
      metadata: { organizationId: orgId },
    });

    if (session.url) {
      redirect(session.url);
    }
  }

  async function handleOpenPortal() {
    "use server";

    const orgId = await getOrganizationId();
    if (!orgId) return;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    });

    if (!org?.stripeCustomerId) {
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

    const session = await createPortalSession({
      stripeCustomerId: org.stripeCustomerId,
      returnUrl: `${baseUrl}/mission-control/settings/billing`,
    });

    if (session.url) {
      redirect(session.url);
    }
  }

  async function handleLogout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/mission-control">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              Settings & Billing
            </h1>
            <p className="text-muted-foreground">
              Manage your subscription for {organization?.name || "your organization"}
            </p>
          </div>
        </div>
        <form action={handleLogout}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </form>
      </div>

      {/* Success/Cancel Messages */}
      {params.success && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4 flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <span className="text-green-800 dark:text-green-200">
              Your billing has been updated successfully!
            </span>
          </CardContent>
        </Card>
      )}

      {params.canceled && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="py-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              Billing update was cancelled.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Trial Banner */}
      {organization?.trialEndsAt && organization.trialEndsAt > new Date() && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardContent className="py-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">
              Your trial ends on {organization.trialEndsAt.toLocaleDateString()}.
              Subscribe now to continue using SocialAI.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Current Plan */}
      {subscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Plan
              <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                {subscription.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-red-600">
                    Cancels on {subscription.currentPeriodEnd.toLocaleDateString()}
                  </p>
                )}
                <div className="text-sm text-muted-foreground">
                  {subscription.status === "trialing" && subscription.trialEnd ? (
                    <>Trial ends {subscription.trialEnd.toLocaleDateString()}</>
                  ) : (
                    <>Next billing: {subscription.currentPeriodEnd.toLocaleDateString()}</>
                  )}
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="border-t pt-6">
              <h3 className="font-medium mb-3">Usage This Month</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{postsThisMonth}</div>
                  <div className="text-sm text-muted-foreground">
                    / {subscription.billingPlan.maxPostsPerMonth === -1
                      ? "∞"
                      : subscription.billingPlan.maxPostsPerMonth} posts
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{platformsConnected}</div>
                  <div className="text-sm text-muted-foreground">
                    / {subscription.billingPlan.maxPlatforms === -1
                      ? "∞"
                      : subscription.billingPlan.maxPlatforms} platforms
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{subscription.billingPlan.maxTeamMembers}</div>
                  <div className="text-sm text-muted-foreground">team members</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <form action={handleOpenPortal}>
                <Button type="submit" variant="outline">
                  Manage Billing
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No active subscription</p>
            <p className="text-muted-foreground mb-6">
              Choose a plan to start using SocialAI
            </p>
            <Link href="/pricing">
              <Button>View Plans</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {availablePlans
                .filter((plan) => plan.id !== subscription?.billingPlanId)
                .map((plan) => {
                  const monthlyPrice = plan.prices.find((p: any) => p.interval === "month");

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
                        <Button
                          type="submit"
                          disabled={!monthlyPrice?.priceId}
                          className="w-full"
                        >
                          Upgrade
                        </Button>
                      </form>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
