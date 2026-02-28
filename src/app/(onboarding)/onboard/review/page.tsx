"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle, X, ArrowRight, Loader2, Instagram, Linkedin, Globe } from "lucide-react";

interface ProposedPlan {
  platforms: { name: string; followers: number; schedule: string[] }[];
  postingSchedule: Record<string, { days: string[]; times: string[] }>;
  contentMix: { type: string; percentage: number; description: string }[];
  brandVoice: { description: string; example: string };
  automationLevel: string;
  goals: string[];
}

const PLATFORM_ICONS: Record<string, any> = {
  Instagram: Instagram,
  Facebook: Globe,
  LinkedIn: Linkedin,
  TikTok: Globe,
  Twitter: Globe,
};

export default function OnboardReviewPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<ProposedPlan>({
    platforms: [
      { name: "Instagram", followers: 2340, schedule: ["Mon-Fri", "9am & 6pm"] },
      { name: "LinkedIn", followers: 890, schedule: ["Tue, Wed, Thu", "8am"] },
    ],
    postingSchedule: {
      Instagram: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], times: ["9:00 AM", "6:00 PM"] },
      LinkedIn: { days: ["Tue", "Wed", "Thu"], times: ["8:00 AM"] },
    },
    contentMix: [
      { type: "Educational", percentage: 40, description: "Skincare tips, ingredient spotlights" },
      { type: "Product", percentage: 30, description: "Lifestyle shots, reviews, UGC" },
      { type: "Behind the Scenes", percentage: 20, description: "Making process, team moments" },
      { type: "Trending", percentage: 10, description: "Seasonal, cultural moments" },
    ],
    brandVoice: {
      description: "Warm, knowledgeable, nature-inspired",
      example: "Like a trusted friend who happens to be a skincare expert",
    },
    automationLevel: "light",
    goals: ["Drive website sales"],
  });
  const [showTweaks, setShowTweaks] = useState(false);
  const [tweakRequest, setTweakRequest] = useState("");

  useEffect(() => {
    checkAndLoadPlan();
  }, []);

  async function checkAndLoadPlan() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      redirect("/login");
      return;
    }

    // Check if onboarding is complete
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgMember) {
      const { data: brandConfig } = await supabase
        .from("brand_configs")
        .select("id")
        .eq("organization_id", orgMember.organization_id)
        .single();

      if (brandConfig) {
        redirect("/mission-control");
        return;
      }
    }

    // Load saved plan from sessionStorage (set by analysis)
    const savedPlan = sessionStorage.getItem("onboarding_proposed_plan");
    if (savedPlan) {
      setPlan(JSON.parse(savedPlan));
    }

    setLoading(false);
  }

  async function handleLaunch() {
    setSaving(true);
    
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get or create organization
      let { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      let organizationId = orgMember?.organization_id;

      if (!organizationId) {
        const { data: org } = await supabase
          .from("organizations")
          .insert({ name: "My Organization", slug: `org-${Date.now()}` })
          .select()
          .single();

        if (org) {
          organizationId = org.id;
          await supabase
            .from("org_members")
            .insert({ organization_id: org.id, user_id: user.id, role: "OWNER" });
        }
      }

      if (!organizationId) {
        throw new Error("Failed to create organization");
      }

      // Save brand config
      await supabase.from("brand_configs").insert({
        organization_id: organizationId,
        brand_name: "My Brand",
        industry: "General",
        content_themes: plan.contentMix.map(m => m.type),
        voice_tone: {
          adjectives: plan.brandVoice.description.split(", ").map(s => s.trim()),
          examples: [plan.brandVoice.example],
          avoid: [],
        },
        do_nots: [],
      });

      // Save organization config
      await supabase.from("org_settings").insert({
        organization_id: organizationId,
        automation_level: plan.automationLevel,
        posting_schedule: plan.postingSchedule,
        content_mix: plan.contentMix.reduce((acc, m) => ({ ...acc, [m.type]: m.percentage }), {}),
        connected_platforms: plan.platforms.map(p => p.name),
        goals: plan.goals,
      });

      // Clear session storage
      sessionStorage.removeItem("onboarding_proposed_plan");

      // Redirect to mission control
      redirect("/mission-control");
    } catch (error) {
      console.error("Error launching:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleTweak() {
    if (!tweakRequest.trim()) return;
    
    setSaving(true);
    
    // Simulate AI processing the tweak
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Apply mock tweaks based on request
    const lower = tweakRequest.toLowerCase();
    if (lower.includes("reel") || lower.includes("video")) {
      setPlan(prev => ({
        ...prev,
        contentMix: prev.contentMix.map(m => 
          m.type === "Trending" 
            ? { ...m, percentage: Math.max(0, m.percentage - 10) }
            : m.type === "Product"
            ? { ...m, percentage: m.percentage + 10 }
            : m
        ),
      }));
    }
    
    if (lower.includes("weekend")) {
      setPlan(prev => ({
        ...prev,
        postingSchedule: {
          ...prev.postingSchedule,
          Instagram: {
            ...prev.postingSchedule.Instagram,
            days: [...prev.postingSchedule.Instagram.days, "Sat", "Sun"],
          },
        },
      }));
    }
    
    setShowTweaks(false);
    setTweakRequest("");
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-400" />
            <span className="font-semibold text-white">SocialAI</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Your AI Social Media Plan</h1>
          <p className="text-slate-400">Here's what I'm proposing based on our conversation</p>
        </div>

        {/* Platforms */}
        <Card className="mb-4 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {plan.platforms.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.name] || Globe;
                return (
                  <div
                    key={platform.name}
                    className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2"
                  >
                    <Icon className="h-4 w-4 text-slate-300" />
                    <span className="text-white font-medium">{platform.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {platform.followers.toLocaleString()} followers
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Posting Schedule */}
        <Card className="mb-4 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Posting Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(plan.postingSchedule).map(([platform, schedule]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-white font-medium">{platform}</span>
                <div className="text-right">
                  <div className="text-slate-300 text-sm">
                    {schedule.days.join(", ")}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {schedule.times.join(" & ")}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Content Mix */}
        <Card className="mb-4 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Content Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.contentMix.map((item) => (
              <div key={item.type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{item.type}</span>
                  <span className="text-blue-400">{item.percentage}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <p className="text-slate-400 text-xs">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Brand Voice */}
        <Card className="mb-4 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Brand Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white mb-2">{plan.brandVoice.description}</p>
            <p className="text-slate-400 text-sm italic">"{plan.brandVoice.example}"</p>
          </CardContent>
        </Card>

        {/* Goals & Automation */}
        <Card className="mb-4 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Goals & Automation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-slate-400 text-sm">Goal: </span>
              <span className="text-white">{plan.goals.join(", ")}</span>
            </div>
            <div>
              <span className="text-slate-400 text-sm">Automation: </span>
              <Badge className={
                plan.automationLevel === "autonomous" ? "bg-green-500" :
                plan.automationLevel === "light" ? "bg-blue-500" : "bg-purple-500"
              }>
                {plan.automationLevel === "autonomous" ? "Fully Autonomous" :
                 plan.automationLevel === "light" ? "Light Touch" : "Hands On"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tweaks Section */}
        {showTweaks && (
          <Card className="mb-4 bg-slate-800/50 border-blue-600">
            <CardHeader>
              <CardTitle className="text-white">What would you change?</CardTitle>
              <CardDescription className="text-slate-400">
                Tell me what you'd like to adjust, like "more Reels" or "post on weekends"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="e.g., Can we do more Reels? And post on weekends too."
                value={tweakRequest}
                onChange={(e) => setTweakRequest(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTweaks(false)}
                  className="border-slate-600 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTweak}
                  disabled={saving || !tweakRequest.trim()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Apply Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <Button
            variant="outline"
            onClick={() => setShowTweaks(true)}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            disabled={saving}
          >
            <X className="h-4 w-4 mr-2" />
            Let me tweak a few things
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Launch it!
          </Button>
        </div>
      </main>
    </div>
  );
}
