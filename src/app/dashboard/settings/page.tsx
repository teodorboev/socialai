"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    price: 0,
    description: "Perfect for trying out the platform",
    features: [
      "1 social account",
      "10 posts per month",
      "Basic analytics",
      "Email support",
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 49,
    description: "For growing businesses",
    features: [
      "3 social accounts",
      "Unlimited posts",
      "Advanced analytics",
      "AI content generation",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "PRO",
    name: "Pro",
    price: 99,
    description: "For professional marketers",
    features: [
      "10 social accounts",
      "Unlimited posts",
      "Full analytics suite",
      "AI engagement",
      "A/B testing",
      "Dedicated support",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 299,
    description: "For large organizations",
    features: [
      "Unlimited accounts",
      "Custom integrations",
      "White-label",
      "SLA guarantee",
      "Account manager",
    ],
  },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrg() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!orgMember) {
        router.push("/onboarding");
        return;
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgMember.organization_id)
        .single();

      if (org) {
        setOrganization(org);
        setOrgName(org.name);
      }
      setLoading(false);
    }

    fetchOrg();
  }, [supabase, router]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Payment successful! Your plan has been updated.");
      router.replace("/dashboard/settings");
    } else if (searchParams.get("canceled") === "true") {
      toast.error("Payment was canceled.");
      router.replace("/dashboard/settings");
    }
  }, [searchParams, router]);

  const handleUpdateOrg = async () => {
    if (!orgName.trim()) {
      toast.error("Organization name cannot be empty");
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName })
      .eq("id", organization.id);

    if (error) {
      toast.error("Failed to update organization");
    } else {
      toast.success("Organization updated");
      setOrganization({ ...organization, name: orgName });
    }
  };

  const handleUpgrade = async (planId: string) => {
    setBillingLoading(planId);

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_checkout", planType: planId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      toast.error("Failed to start checkout");
      console.error(error);
    } finally {
      setBillingLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading("portal");

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to open billing portal");
      }
    } catch (error) {
      toast.error("Failed to open billing portal");
      console.error(error);
    } finally {
      setBillingLoading(null);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const currentPlan = PLANS.find((p) => p.id === organization?.plan) || PLANS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your account and billing</p>
      </div>

      <Tabs defaultValue="organization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Update your organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <Button onClick={handleUpdateOrg}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>You are currently on the {currentPlan.name} plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    ${currentPlan.price}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </p>
                </div>
                {organization?.stripeSubId && (
                  <Button variant="outline" onClick={handleManageBilling} disabled={!!billingLoading}>
                    {billingLoading === "portal" ? "Loading..." : "Manage Billing"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <Card key={plan.id} className={plan.popular ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.popular && (
                      <Badge variant="default">Popular</Badge>
                    )}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-3xl font-bold">
                    ${plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.id === currentPlan.id ? "outline" : "default"}
                    disabled={plan.id === currentPlan.id || !!billingLoading}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {billingLoading === plan.id
                      ? "Loading..."
                      : plan.id === currentPlan.id
                      ? "Current Plan"
                      : plan.price > currentPlan.price
                      ? "Upgrade"
                      : "Downgrade"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
