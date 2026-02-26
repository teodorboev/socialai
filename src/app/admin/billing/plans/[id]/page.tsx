"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Pencil } from "lucide-react";

const CURRENCIES = ["usd", "eur", "gbp"] as const;
const INTERVALS = ["month", "year"] as const;

interface PlanData {
  id: string;
  name: string;
  slug: string;
  description: string;
  agentTier: string;
  enabledAgents: string[];
  maxPlatforms: number;
  maxPostsPerMonth: number;
  maxBrands: number;
  maxTeamMembers: number;
  trialDays: number;
  isUsageBased: boolean;
  usageUnitName: string | null;
  usageIncluded: number | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  stripePrices: Array<{
    id: string;
    currency: string;
    interval: string;
    unitAmount: number;
  }>;
  _count: {
    subscriptions: number;
  };
}

function formatPrice(amount: number, currency: string): string {
  const formatted = (amount / 100).toFixed(2);
  switch (currency) {
    case "usd": return `$${formatted}`;
    case "eur": return `€${formatted}`;
    case "gbp": return `£${formatted}`;
    default: return `${amount} ${currency}`;
  }
}

function formatAgentName(agent: string): string {
  return agent.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [plan, setPlan] = useState<PlanData | null>(null);

  useEffect(() => {
    async function loadPlan() {
      try {
        const response = await fetch(`/api/admin/billing/plans/${planId}`);
        if (!response.ok) {
          throw new Error("Plan not found");
        }
        const data: PlanData = await response.json();
        setPlan(data);
      } catch (error) {
        router.push("/admin/billing/plans");
      } finally {
        setLoadingPlan(false);
      }
    }
    
    if (planId) {
      loadPlan();
    }
  }, [planId, router]);

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{plan.name}</h1>
              <Badge variant={plan.isActive ? "default" : "secondary"}>
                {plan.isActive ? "Active" : "Inactive"}
              </Badge>
              {plan.isPublic && <Badge variant="outline">Public</Badge>}
            </div>
            <p className="text-muted-foreground">Slug: {plan.slug}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/billing/plans/${planId}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Plan
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{plan._count.subscriptions}</div>
            <div className="text-xs text-muted-foreground">Subscribers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {plan.maxPlatforms === -1 ? "∞" : plan.maxPlatforms}
            </div>
            <div className="text-xs text-muted-foreground">Platforms</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {plan.maxPostsPerMonth === -1 ? "∞" : plan.maxPostsPerMonth}
            </div>
            <div className="text-xs text-muted-foreground">Posts/mo</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold capitalize">{plan.agentTier}</div>
            <div className="text-xs text-muted-foreground">Agent Tier</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="agents">Agents ({plan.enabledAgents?.length || 0})</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.description && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Description</div>
                  <div>{plan.description}</div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Max Brands</div>
                  <div>{plan.maxBrands === -1 ? "Unlimited" : plan.maxBrands}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Max Team Members</div>
                  <div>{plan.maxTeamMembers === -1 ? "Unlimited" : plan.maxTeamMembers}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Trial Days</div>
                  <div>{plan.trialDays} days</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Usage-Based</div>
                  <div>{plan.isUsageBased ? `Yes (${plan.usageUnitName})` : "No"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Enabled Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {plan.enabledAgents?.map((agent) => (
                  <Badge key={agent} variant="secondary">
                    {formatAgentName(agent)}
                  </Badge>
                ))}
                {(!plan.enabledAgents || plan.enabledAgents.length === 0) && (
                  <div className="text-muted-foreground">No custom agents configured</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {CURRENCIES.map((currency) => {
                  const currencyPrices = plan.stripePrices?.filter((p) => p.currency === currency) || [];
                  if (currencyPrices.length === 0) return null;
                  
                  return (
                    <div key={currency} className="border rounded-lg p-4">
                      <Badge className="mb-2">{currency.toUpperCase()}</Badge>
                      <div className="grid grid-cols-2 gap-4">
                        {INTERVALS.map((interval) => {
                          const price = currencyPrices.find((p) => p.interval === interval);
                          return (
                            <div key={interval}>
                              <div className="text-sm text-muted-foreground capitalize">{interval}</div>
                              <div className="text-lg font-semibold">
                                {price ? formatPrice(price.unitAmount, currency) : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
