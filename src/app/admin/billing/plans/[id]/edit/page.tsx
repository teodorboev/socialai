"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AgentSelector, type AgentTier } from "@/components/admin/agent-selector";
import { ArrowLeft, Save, Loader2, RefreshCw } from "lucide-react";

const CURRENCIES = ["usd", "eur", "gbp"] as const;
const INTERVALS = ["month", "year"] as const;

interface PriceInput {
  currency: typeof CURRENCIES[number];
  interval: typeof INTERVALS[number];
  unitAmount: number;
}

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
  overagePerUnit: Record<string, number> | null;
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

export default function EditPlanPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(true);
  
  // Basic info
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  
  // Agent selection
  const [agentTier, setAgentTier] = useState<AgentTier>("core");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  
  // Limits
  const [maxPlatforms, setMaxPlatforms] = useState(2);
  const [maxPostsPerMonth, setMaxPostsPerMonth] = useState(40);
  const [maxBrands, setMaxBrands] = useState(1);
  const [maxTeamMembers, setMaxTeamMembers] = useState(1);
  const [trialDays, setTrialDays] = useState(14);
  
  // Usage-based
  const [isUsageBased, setIsUsageBased] = useState(false);
  const [usageUnitName, setUsageUnitName] = useState("");
  const [usageIncluded, setUsageIncluded] = useState(10);
  
  // Pricing
  const [prices, setPrices] = useState<PriceInput[]>([]);
  
  // Status
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  // Subscriber count
  const [subscriberCount, setSubscriberCount] = useState(0);

  // Load plan data
  useEffect(() => {
    async function loadPlan() {
      try {
        const response = await fetch(`/api/admin/billing/plans/${planId}`);
        if (!response.ok) {
          throw new Error("Plan not found");
        }
        const data: PlanData = await response.json();
        
        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description || "");
        setAgentTier(data.agentTier as AgentTier || "core");
        setSelectedAgents(data.enabledAgents || []);
        setMaxPlatforms(data.maxPlatforms);
        setMaxPostsPerMonth(data.maxPostsPerMonth);
        setMaxBrands(data.maxBrands);
        setMaxTeamMembers(data.maxTeamMembers);
        setTrialDays(data.trialDays);
        setIsUsageBased(data.isUsageBased);
        setUsageUnitName(data.usageUnitName || "");
        setUsageIncluded(data.usageIncluded || 10);
        setIsActive(data.isActive);
        setIsPublic(data.isPublic);
        setSubscriberCount(data._count.subscriptions);
        
        // Initialize prices
        const initialPrices: PriceInput[] = [];
        for (const currency of CURRENCIES) {
          for (const interval of INTERVALS) {
            const existingPrice = data.stripePrices.find(
              (p) => p.currency === currency && p.interval === interval
            );
            initialPrices.push({
              currency,
              interval,
              unitAmount: existingPrice?.unitAmount || 0,
            });
          }
        }
        setPrices(initialPrices);
      } catch (error) {
        toast.error("Failed to load plan");
        router.push("/admin/billing/plans");
      } finally {
        setLoadingPlan(false);
      }
    }
    
    if (planId) {
      loadPlan();
    }
  }, [planId, router]);

  const updatePrice = (index: number, field: keyof PriceInput, value: string | number) => {
    const newPrices = [...prices];
    newPrices[index] = { ...newPrices[index], [field]: value };
    setPrices(newPrices);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/billing/plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          agentTier,
          enabledAgents: agentTier === "custom" ? selectedAgents : undefined,
          maxPlatforms,
          maxPostsPerMonth,
          maxBrands,
          maxTeamMembers,
          trialDays,
          isUsageBased,
          usageUnitName: isUsageBased ? usageUnitName : null,
          usageIncluded: isUsageBased ? usageIncluded : null,
          isActive,
          isPublic,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update plan");
      }

      toast.success("Plan updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update plan");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToStripe = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/admin/billing/plans/${planId}/sync`, {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync to Stripe");
      }
      
      toast.success("Plan synced to Stripe successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync to Stripe");
    } finally {
      setSyncing(false);
    }
  };

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
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
            <h1 className="text-2xl font-bold">Edit Plan</h1>
            <p className="text-muted-foreground">Update billing plan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subscriberCount > 0 && (
            <Badge variant="secondary">
              {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button 
            variant="outline" 
            onClick={handleSyncToStripe}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync to Stripe
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Slug cannot be changed</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  <span>Public (show on pricing page)</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Agent Access</CardTitle>
            </CardHeader>
            <CardContent>
              <AgentSelector
                selectedTier={agentTier}
                selectedAgents={selectedAgents}
                onTierChange={setAgentTier}
                onAgentsChange={setSelectedAgents}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Limits Tab */}
        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Plan Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Platforms</Label>
                  <Input
                    type="number"
                    value={maxPlatforms}
                    onChange={(e) => setMaxPlatforms(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Use -1 for unlimited</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Posts Per Month</Label>
                  <Input
                    type="number"
                    value={maxPostsPerMonth}
                    onChange={(e) => setMaxPostsPerMonth(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Use -1 for unlimited</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Brands</Label>
                  <Input
                    type="number"
                    value={maxBrands}
                    onChange={(e) => setMaxBrands(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Team Members</Label>
                  <Input
                    type="number"
                    value={maxTeamMembers}
                    onChange={(e) => setMaxTeamMembers(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Trial Days</Label>
                <Input
                  type="number"
                  value={trialDays}
                  onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                />
              </div>

              {/* Usage-based section */}
              <div className="border-t pt-4 space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isUsageBased}
                    onChange={(e) => setIsUsageBased(e.target.checked)}
                    className="rounded"
                  />
                  <span className="font-medium">Usage-based pricing</span>
                </label>

                {isUsageBased && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>Unit Name</Label>
                      <Input
                        value={usageUnitName}
                        onChange={(e) => setUsageUnitName(e.target.value)}
                        placeholder="e.g., client, post"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Included Units</Label>
                      <Input
                        type="number"
                        value={usageIncluded}
                        onChange={(e) => setUsageIncluded(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
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
                {CURRENCIES.map((currency) => (
                  <div key={currency} className="border rounded-lg p-4">
                    <Badge className="mb-2">{currency.toUpperCase()}</Badge>
                    <div className="grid grid-cols-2 gap-4">
                      {INTERVALS.map((interval) => {
                        const priceIndex = prices.findIndex(
                          (p) => p.currency === currency && p.interval === interval
                        );
                        const price = prices[priceIndex];
                        
                        return (
                          <div key={interval} className="space-y-2">
                            <Label className="capitalize">{interval}</Label>
                            <div className="flex items-center">
                              <span className="mr-2">
                                {currency === "usd" ? "$" : currency === "eur" ? "€" : "£"}
                              </span>
                              <Input
                                type="number"
                                value={price?.unitAmount ? price.unitAmount / 100 : 0}
                                onChange={(e) =>
                                  updatePrice(priceIndex, "unitAmount", Math.round(parseFloat(e.target.value) * 100))
                                }
                                min={0}
                                step={0.01}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !name}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
