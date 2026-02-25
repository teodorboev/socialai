/**
 * Sign Up + Pricing Combined Page
 * 
 * Modern flow:
 * 1. Create account (email/password)
 * 2. Choose plan
 * 3. Payment → Onboarding
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Step = "signup" | "pricing";

export default function SignupWithPricingPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [step, setStep] = useState<Step>("signup");
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currency, setCurrency] = useState("usd");
  
  // Signup form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/onboard`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Move to pricing step
      setStep("pricing");
      setLoading(false);
    }
  }

  async function handleSelectPlan(plan: Plan) {
    setLoading(true);

    try {
      // Get or create organization
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in first");
        return;
      }

      const { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      let organizationId = orgMember?.organization_id;

      if (!organizationId) {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: fullName || user.email?.split("@")[0] || "My Business",
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

      // Get price
      const priceData = plan.prices[currency]?.month;
      if (!priceData) {
        throw new Error("No pricing available");
      }

      // Create Stripe Checkout
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
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }

  // Step 1: Sign Up Form
  if (step === "signup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500 text-white text-xl font-bold mb-4">
              S
            </div>
            <h1 className="text-3xl font-bold text-white">Get Started</h1>
            <p className="text-slate-400 mt-2">Create your account to begin</p>
          </div>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Create Account</CardTitle>
              <CardDescription className="text-slate-400">
                Start your 14-day free trial
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSignup}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-500">Must be at least 8 characters</p>
                </div>
              </CardContent>
              
              <CardFooter className="flex flex-col gap-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Continue"}
                </Button>
                
                <p className="text-sm text-slate-400">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-blue-400 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </CardFooter>
            </form>
          </Card>

          <p className="text-center text-xs text-slate-500 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Choose Plan
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">
              S
            </div>
            <span className="text-lg font-bold">SocialAI</span>
          </div>
          <Button variant="ghost" onClick={() => supabase.auth.signOut().then(() => setStep("signup"))}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Welcome */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Welcome, {fullName || email.split("@")[0]}! Select a plan to start your free trial.
          </p>
        </div>

        {/* Currency Selector */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-2">
            {[
              { code: "usd", flag: "🇺🇸", label: "USD" },
              { code: "eur", flag: "🇪🇺", label: "EUR" },
              { code: "gbp", flag: "🇬🇧", label: "GBP" },
            ].map((c) => (
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

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const price = plan.prices[currency]?.month?.amount;
            const symbol = currency === "usd" ? "$" : currency === "eur" ? "€" : "£";

            return (
              <Card
                key={plan.id}
                className={`relative hover:shadow-lg transition-shadow ${
                  plan.slug === "growth" ? "border-blue-500 shadow-md shadow-blue-100" : ""
                }`}
              >
                {plan.slug === "growth" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">
                      {price ? `${symbol}${Math.round(price / 100)}` : "—"}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  
                  <ul className="space-y-2">
                    {plan.agentTier === "core" && (
                      <>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Content AI</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Analytics</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> 2 platforms</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> 40 posts/mo</li>
                      </>
                    )}
                    {plan.agentTier === "intelligence" && (
                      <>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Everything in Core</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Social Listening</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Audience Insights</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> 4 platforms</li>
                      </>
                    )}
                    {plan.agentTier === "full" && (
                      <>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Everything in Intelligence</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> AI Image Generation</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> ROI Attribution</li>
                        <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> Unlimited</li>
                      </>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.slug === "growth" ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loading}
                  >
                    {loading ? "Processing..." : plan.trialDays > 0 ? `Start Free Trial` : "Get Started"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          🔒 Secure payment via Stripe • Cancel anytime • 14-day free trial
        </p>
      </main>
    </div>
  );
}
