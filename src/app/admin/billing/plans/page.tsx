/**
 * Super Admin - Plan Management
 * 
 * Manage billing plans with multi-currency pricing.
 * CRUD operations with Stripe sync.
 */

import { prismaAdmin } from "@/lib/prisma";
import { formatPrice, getSupportedCurrencies, getYearlyDiscountPercent } from "@/lib/billing/currency";
import { Suspense } from "react";
import { connection } from "next/server";

// Force dynamic rendering to avoid static prerendering issues

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

async function getPlans() {
  return prismaAdmin.billingPlan.findMany({
    include: {
      stripePrices: {
        orderBy: [{ currency: "asc" }, { interval: "asc" }],
      },
      _count: {
        select: { subscriptions: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

async function getMRRByPlan() {
  // Get active subscriptions with their billing plan
  const subscriptions = await prismaAdmin.subscription.findMany({
    where: { status: "active" },
    select: {
      billingPlanId: true,
      billingPlan: {
        select: {
          name: true,
          stripePrices: {
            where: { interval: "month", isActive: true },
            select: { unitAmount: true },
          },
        },
      },
    },
  });

  const mrrByPlan: Record<string, number> = {};

  for (const sub of subscriptions) {
    const monthlyPrice = sub.billingPlan.stripePrices[0]?.unitAmount ?? 0;
    const planName = sub.billingPlan.name;
    mrrByPlan[planName] = (mrrByPlan[planName] ?? 0) + monthlyPrice;
  }

  return mrrByPlan;
}

function PlansList() {
  return (
    <div className="space-y-4">
      <div className="text-center py-12 text-muted-foreground">
        Loading plans...
      </div>
    </div>
  );
}

function AlertMessages({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;

  return (
    <>
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          Plan saved and synced to Stripe successfully!
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          Error: {error}
        </div>
      )}
    </>
  );
}

async function PlansContent({ params }: { params: PageProps['searchParams'] }) {
  const searchParams = await params;
  const plans = await getPlans();
  const mrrByPlan = await getMRRByPlan();

  return (
    <>
      <AlertMessages success={searchParams.success} error={searchParams.error} />

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="border rounded-lg p-4 bg-card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Slug: {plan.slug} | Tier: {plan.agentTier}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/admin/billing/plans/${plan.id}`}
                  className="px-3 py-1 text-sm border rounded hover:bg-muted"
                >
                  Edit
                </a>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <span className="text-muted-foreground">Platforms:</span>{" "}
                {plan.maxPlatforms === -1 ? "Unlimited" : plan.maxPlatforms}
              </div>
              <div>
                <span className="text-muted-foreground">Posts/mo:</span>{" "}
                {plan.maxPostsPerMonth === -1 ? "Unlimited" : plan.maxPostsPerMonth}
              </div>
              <div>
                <span className="text-muted-foreground">Trial:</span> {plan.trialDays} days
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                {plan.isActive ? "Active" : "Inactive"}
              </div>
            </div>

            {/* Pricing Grid */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2">Pricing</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2">Currency</th>
                      <th className="pb-2">Monthly</th>
                      <th className="pb-2">Yearly</th>
                      <th className="pb-2">Yearly Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSupportedCurrencies().map((currency) => {
                      const monthlyPrice = plan.stripePrices.find(
                        (p) => p.currency === currency && p.interval === "month"
                      );
                      const yearlyPrice = plan.stripePrices.find(
                        (p) => p.currency === currency && p.interval === "year"
                      );
                      const discount = monthlyPrice
                        ? getYearlyDiscountPercent(monthlyPrice.unitAmount)
                        : 0;

                      return (
                        <tr key={currency}>
                          <td className="py-1">{currency.toUpperCase()}</td>
                          <td className="py-1">
                            {monthlyPrice
                              ? formatPrice(monthlyPrice.unitAmount, currency as any)
                              : "—"}
                          </td>
                          <td className="py-1">
                            {yearlyPrice
                              ? formatPrice(yearlyPrice.unitAmount, currency as any)
                              : "—"}
                          </td>
                          <td className="py-1">{discount > 0 ? `${discount}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats */}
            <div className="border-t mt-4 pt-4 flex gap-8 text-sm">
              <div>
                <span className="text-muted-foreground">Active subscribers:</span>{" "}
                <span className="font-medium">{plan._count.subscriptions}</span>
              </div>
              <div>
                <span className="text-muted-foreground">MRR:</span>{" "}
                <span className="font-medium">
                  ${((mrrByPlan[plan.name] ?? 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No plans configured. Create your first plan to get started.
        </div>
      )}
    </>
  );
}

export default async function BillingPlansPage({
  searchParams,
}: PageProps) {
  await connection();
  const { success, error } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Plan Management</h1>
          <p className="text-muted-foreground">
            Manage billing plans and pricing (synced with Stripe)
          </p>
        </div>
        <a
          href="/admin/billing/plans/new"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          + New Plan
        </a>
      </div>

      <Suspense fallback={<PlansList />}>
        <PlansContent params={searchParams} />
      </Suspense>
    </div>
  );
}
