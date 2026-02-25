/**
 * Pricing Page
 * 
 * Shows available plans with multi-currency pricing.
 * After selection, creates Stripe Checkout and redirects to onboarding.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  agentTier: string;
  trialDays: number;
  prices: Record<string, Record<string, { amount: number; priceId: string }>>;
}

const CURRENCIES = [
  { code: "usd", label: "USD", symbol: "$", flag: "🇺🇸" },
  { code: "eur", label: "EUR", symbol: "€", flag: "🇪🇺" },
  { code: "gbp", label: "GBP", symbol: "£", flag: "🇬🇧" },
];

export default function PricingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currency, setCurrency] = useState("usd");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchPlans();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  }

  async function fetchPlans() {
    try {
      const res = await fetch("/api/billing/plans");
      const data = await res.json();
      if (data.plans) {
        setPlans(data.plans);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    }
  }

  async function handleSelectPlan(plan: Plan) {
    if (!user) {
      // Redirect to signup first
      router.push("/signup?redirect=/pricing");
      return;
    }

    setLoading(plan.id);

    try {
      // Get or create organization for user
      const { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      let organizationId = orgMember?.organization_id;

      // Create org if doesn't exist
      if (!organizationId) {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: `${user.email?.split("@")[0]}'s Business`,
            slug: `org-${Date.now()}`,
          })
          .select()
          .single();

        if (orgError) throw orgError;

        await supabase
          .from("org_members")
          .insert({
            organization_id: org.id,
            user_id: user.id,
            role: "OWNER",
          });

        organizationId = org.id;
      }

      // Get price for selected currency
      const priceData = plan.prices[currency]?.month;
      if (!priceData) {
        throw new Error("No pricing available");
      }

      // Create Stripe Checkout session
      const res = await fetch("/api/billing/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          planId: plan.id,
          currency,
        }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to Stripe
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  const tierFeatures: Record<string, string[]> = {
    core: [
      "Content Creator AI",
      "Engagement Manager",
      "Analytics Dashboard",
      "Basic Publishing",
      "Up to 2 platforms",
      "40 posts/month",
    ],
    intelligence: [
      "Everything in Core",
      "Competitor Intelligence",
      "Social Listening",
      "Audience Insights",
      "Influencer Scout",
      "Up to 4 platforms",
      "80 posts/month",
    ],
    full: [
      "Everything in Intelligence",
      "Creative Director (AI Images)",
      "ROI Attribution",
      "Predictive Content",
      "A/B Testing",
      "Unlimited platforms",
      "Unlimited posts",
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">SocialAI</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
                Sign Out
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => router.push("/login")}>
                  Log In
                </Button>
                <Button onClick={() => router.push("/signup")}>Get Started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Currency Selector */}
        <div className="flex justify-end mb-8">
          <div className="flex gap-2">
            {CURRENCIES.map((c) => (
              <Button
                key={c.code}
                variant={currency === c.code ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrency(c.code)}
              >
                {c.flag} {c.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required to start.
            Cancel anytime.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const price = plan.prices[currency]?.month?.amount;
            const yearlyPrice = plan.prices[currency]?.year?.amount;
            const savings = yearlyPrice ? Math.round(((price! * 12 - yearlyPrice) / (price! * 12)) * 100) : 0;

            return (
              <Card
                key={plan.id}
                className={`relative ${plan.slug === "growth" ? "border-blue-500 shadow-lg shadow-blue-100" : ""}`}
              >
                {plan.slug === "growth" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      {price ? `${CURRENCIES.find(c => c.code === currency)?.symbol}${Math.round(price / 100)}` : "—"}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  
                  {yearlyPrice && savings > 0 && (
                    <div className="mb-4 text-sm text-green-600">
                      Save {savings}% with yearly billing
                    </div>
                  )}

                  <ul className="space-y-3">
                    {tierFeatures[plan.agentTier]?.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.slug === "growth" ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loading !== null}
                  >
                    {loading === plan.id
                      ? "Processing..."
                      : plan.trialDays > 0
                      ? `Start ${plan.trialDays}-Day Free Trial`
                      : "Get Started"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ or Trust */}
        <div className="text-center text-muted-foreground">
          <p>💳 Secure payment via Stripe • 🔒 SSL encrypted • 📱 Cancel anytime</p>
        </div>
      </main>
    </div>
  );
}
