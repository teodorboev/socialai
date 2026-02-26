/**
 * Super Admin - Client Billing Overview
 * 
 * Shows MRR, active/trialing/past-due counts, and per-client AI costs.
 */

import { prisma } from "@/lib/prisma";
import { formatPrice, type SupportedCurrency } from "@/lib/billing/currency";

// Force dynamic rendering
export const dynamic = "force-dynamic";

async function getBillingStats() {
  const [
    totalSubscriptions,
    activeSubscriptions,
    trialingSubscriptions,
    pastDueSubscriptions,
    canceledSubscriptions,
  ] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { status: "trialing" } }),
    prisma.subscription.count({ where: { status: "past_due" } }),
    prisma.subscription.count({ where: { status: "canceled" } }),
  ]);

  // Get MRR - use select instead of include to avoid Prisma issues
  const activeSubs = await prisma.subscription.findMany({
    where: { status: "active" },
    select: {
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

  let mrr = 0;
  for (const sub of activeSubs) {
    const price = sub.billingPlan?.stripePrices[0]?.unitAmount ?? 0;
    mrr += price;
  }

  return {
    totalSubscriptions,
    activeSubscriptions,
    trialingSubscriptions,
    pastDueSubscriptions,
    canceledSubscriptions,
    mrr,
  };
}

async function getClientSubscriptions() {
  // Get subscriptions with minimal data first
  const subs = await prisma.subscription.findMany({
    select: {
      id: true,
      status: true,
      currency: true,
      interval: true,
      createdAt: true,
      currentPeriodEnd: true,
      organizationId: true,
      organization: {
        select: { name: true, slug: true },
      },
      billingPlanId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all billing plans with their prices in one query
  const planIds = [...new Set(subs.map(s => s.billingPlanId))];
  const plans = await prisma.billingPlan.findMany({
    where: { id: { in: planIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      stripePrices: {
        where: { interval: "month", isActive: true },
        select: { unitAmount: true, currency: true },
      },
    },
  });

  const planMap = new Map(plans.map(p => [p.id, p]));

  // Merge the data
  return subs.map(sub => ({
    ...sub,
    billingPlan: planMap.get(sub.billingPlanId),
  }));
}

async function getMonthlyCosts(orgId: string) {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const costs = await prisma.agentCostEvent.aggregate({
    where: { organizationId: orgId, period },
    _sum: { costCents: true },
  });

  return (costs._sum.costCents ?? 0) / 100; // Convert cents to dollars
}

export default async function BillingClientsPage() {
  const stats = await getBillingStats();
  const subscriptions = await getClientSubscriptions();

  // Get costs for each client
  const subscriptionsWithCosts = await Promise.all(
    subscriptions.map(async (sub) => ({
      ...sub,
      monthlyCost: await getMonthlyCosts(sub.organizationId),
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Client Billing</h1>
        <p className="text-muted-foreground">
          Overview of all client subscriptions and AI costs
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold">
            ${(stats.mrr / 100).toFixed(2)}
          </div>
          <div className="text-sm text-muted-foreground">Monthly Recurring Revenue</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.trialingSubscriptions}</div>
          <div className="text-sm text-muted-foreground">Trialing</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pastDueSubscriptions}</div>
          <div className="text-sm text-muted-foreground">Past Due</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{stats.canceledSubscriptions}</div>
          <div className="text-sm text-muted-foreground">Canceled</div>
        </div>
      </div>

      {/* Client Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Organization</th>
              <th className="text-left p-3 text-sm font-medium">Plan</th>
              <th className="text-left p-3 text-sm font-medium">Status</th>
              <th className="text-left p-3 text-sm font-medium">MRR</th>
              <th className="text-left p-3 text-sm font-medium">AI Cost (Mo)</th>
              <th className="text-left p-3 text-sm font-medium">Margin</th>
              <th className="text-left p-3 text-sm font-medium">Since</th>
            </tr>
          </thead>
          <tbody>
            {subscriptionsWithCosts.map((sub) => {
              const mrr = sub.billingPlan?.stripePrices?.[0]?.unitAmount ?? 0;
              const margin = mrr - (sub.monthlyCost * 100);
              const marginPercent = mrr > 0 ? (margin / mrr) * 100 : 0;

              return (
                <tr key={sub.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{sub.organization.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {sub.organization.slug}
                    </div>
                  </td>
                  <td className="p-3">{sub.billingPlan?.name ?? "Unknown"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        sub.status === "active"
                          ? "bg-green-100 text-green-800"
                          : sub.status === "trialing"
                          ? "bg-blue-100 text-blue-800"
                          : sub.status === "past_due"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="p-3">${(mrr / 100).toFixed(2)}</td>
                  <td className="p-3">${sub.monthlyCost.toFixed(2)}</td>
                  <td className="p-3">
                    <span
                      className={
                        marginPercent > 70
                          ? "text-green-600"
                          : marginPercent > 30
                          ? "text-yellow-600"
                          : "text-red-600"
                      }
                    >
                      ${(margin / 100).toFixed(2)} ({marginPercent.toFixed(0)}%)
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {sub.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {subscriptions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No client subscriptions yet.
        </div>
      )}
    </div>
  );
}
