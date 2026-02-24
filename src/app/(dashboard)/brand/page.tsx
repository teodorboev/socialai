"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Sparkles, AlertCircle } from "lucide-react";

interface BrandConfig {
  brand_name: string;
  industry: string;
  voice_tone: {
    adjectives: string[];
    examples: string[];
    avoid: string[];
  };
  content_themes: string[];
  do_nots: string[];
  target_audience: {
    demographics?: string;
    interests?: string[];
    pain_points?: string[];
  };
  hashtag_strategy?: {
    always?: string[];
    never?: string[];
    rotating?: string[];
  };
}

const defaultConfig: BrandConfig = {
  brand_name: "",
  industry: "",
  voice_tone: {
    adjectives: [],
    examples: [],
    avoid: [],
  },
  content_themes: [],
  do_nots: [],
  target_audience: {
    demographics: "",
    interests: [],
    pain_points: [],
  },
  hashtag_strategy: {
    always: [],
    never: [],
    rotating: [],
  },
};

export default function BrandPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<BrandConfig>(defaultConfig);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Form state
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [adjectives, setAdjectives] = useState("");
  const [examples, setExamples] = useState("");
  const [avoid, setAvoid] = useState("");
  const [contentThemes, setContentThemes] = useState("");
  const [doNots, setDoNots] = useState("");
  const [demographics, setDemographics] = useState("");
  const [interests, setInterests] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [alwaysHashtags, setAlwaysHashtags] = useState("");
  const [neverHashtags, setNeverHashtags] = useState("");
  const [rotatingHashtags, setRotatingHashtags] = useState("");

  useEffect(() => {
    async function loadConfig() {
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

      setOrgId(orgMember.organization_id);

      // Load existing config
      const { data: brandConfig } = await supabase
        .from("brand_configs")
        .select("*")
        .eq("organization_id", orgMember.organization_id)
        .single();

      if (brandConfig) {
        const voiceTone = (brandConfig.voice_tone as any) || {};
        const targetAudience = (brandConfig.target_audience as any) || {};
        const hashtagStrategy = (brandConfig.hashtag_strategy as any) || {};

        setBrandName(brandConfig.brand_name || "");
        setIndustry(brandConfig.industry || "");
        setAdjectives((voiceTone.adjectives || []).join(", "));
        setExamples((voiceTone.examples || []).join("\n"));
        setAvoid((voiceTone.avoid || []).join("\n"));
        setContentThemes((brandConfig.content_themes || []).join(", "));
        setDoNots((brandConfig.do_nots || []).join("\n"));
        setDemographics(targetAudience.demographics || "");
        setInterests((targetAudience.interests || []).join(", "));
        setPainPoints((targetAudience.pain_points || []).join(", "));
        setAlwaysHashtags((hashtagStrategy.always || []).join(", "));
        setNeverHashtags((hashtagStrategy.never || []).join(", "));
        setRotatingHashtags((hashtagStrategy.rotating || []).join(", "));
      }

      setLoading(false);
    }

    loadConfig();
  }, [supabase, router]);

  const handleSave = async () => {
    if (!orgId) return;
    if (!brandName.trim()) {
      toast.error("Please enter your brand name");
      return;
    }

    setSaving(true);

    const data = {
      organization_id: orgId,
      brand_name: brandName.trim(),
      industry: industry.trim() || null,
      voice_tone: {
        adjectives: adjectives.split(",").map((s) => s.trim()).filter(Boolean),
        examples: examples.split("\n").map((s) => s.trim()).filter(Boolean),
        avoid: avoid.split("\n").map((s) => s.trim()).filter(Boolean),
      },
      content_themes: contentThemes.split(",").map((s) => s.trim()).filter(Boolean),
      do_nots: doNots.split("\n").map((s) => s.trim()).filter(Boolean),
      target_audience: {
        demographics: demographics.trim() || null,
        interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
        pain_points: painPoints.split(",").map((s) => s.trim()).filter(Boolean),
      },
      hashtag_strategy: {
        always: alwaysHashtags.split(",").map((s) => s.trim()).filter(Boolean),
        never: neverHashtags.split(",").map((s) => s.trim()).filter(Boolean),
        rotating: rotatingHashtags.split(",").map((s) => s.trim()).filter(Boolean),
      },
    };

    const { error } = await supabase.from("brand_configs").upsert(data, {
      onConflict: "organization_id",
    });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Brand voice saved!");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Voice</h1>
        <p className="text-muted-foreground">
          Configure your brand voice to help AI create on-brand content
        </p>
      </div>

      <Card className="border-yellow-500 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Complete your brand profile</p>
              <p className="text-sm text-yellow-700">
                The more details you provide, the better the AI can match your brand voice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="basics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="voice">Voice & Tone</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
        </TabsList>

        <TabsContent value="basics">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Tell us about your brand</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name *</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e: any) => setBrandName(e.target.value)}
                  placeholder="Your brand name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={industry}
                  onChange={(e: any) => setIndustry(e.target.value)}
                  placeholder="e.g., SaaS, E-commerce, Fitness"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contentThemes">Content Themes</Label>
                <Input
                  id="contentThemes"
                  value={contentThemes}
                  onChange={(e: any) => setContentThemes(e.target.value)}
                  placeholder="e.g., product updates, customer stories, tips"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of content themes you typically post about
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice">
          <Card>
            <CardHeader>
              <CardTitle>Voice & Tone</CardTitle>
              <CardDescription>Define how your brand sounds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjectives">Voice Adjectives</Label>
                <Input
                  id="adjectives"
                  value={adjectives}
                  onChange={(e: any) => setAdjectives(e.target.value)}
                  placeholder="e.g., friendly, professional, witty"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated adjectives that describe your brand voice
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="examples">Example Posts</Label>
                <Textarea
                  id="examples"
                  value={examples}
                  onChange={(e: any) => setExamples(e.target.value)}
                  placeholder="Paste example posts that represent your brand voice&#10;(one per line)"
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avoid">Things to Avoid</Label>
                <Textarea
                  id="avoid"
                  value={avoid}
                  onChange={(e: any) => setAvoid(e.target.value)}
                  placeholder="Things your brand would never say&#10;(one per line)"
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doNots">Do Nots</Label>
                <Textarea
                  id="doNots"
                  value={doNots}
                  onChange={(e: any) => setDoNots(e.target.value)}
                  placeholder="Hard rules - things the AI should never do&#10;(one per line)"
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience">
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>Who are you trying to reach?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="demographics">Demographics</Label>
                <Textarea
                  id="demographics"
                  value={demographics}
                  onChange={(e: any) => setDemographics(e.target.value)}
                  placeholder="e.g., Small business owners, 25-45, tech-savvy"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interests">Interests</Label>
                <Input
                  id="interests"
                  value={interests}
                  onChange={(e: any) => setInterests(e.target.value)}
                  placeholder="e.g., productivity, entrepreneurship, marketing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="painPoints">Pain Points</Label>
                <Textarea
                  id="painPoints"
                  value={painPoints}
                  onChange={(e: any) => setPainPoints(e.target.value)}
                  placeholder="What problems does your audience face?&#10;(comma-separated)"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hashtags">
          <Card>
            <CardHeader>
              <CardTitle>Hashtag Strategy</CardTitle>
              <CardDescription>Define your hashtag approach</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alwaysHashtags">Always Use</Label>
                <Input
                  id="alwaysHashtags"
                  value={alwaysHashtags}
                  onChange={(e: any) => setAlwaysHashtags(e.target.value)}
                  placeholder="e.g., #YourBrand"
                />
                <p className="text-xs text-muted-foreground">
                  Hashtags to always include in posts
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="neverHashtags">Never Use</Label>
                <Input
                  id="neverHashtags"
                  value={neverHashtags}
                  onChange={(e: any) => setNeverHashtags(e.target.value)}
                  placeholder="e.g., #spam, #follow4follow"
                />
                <p className="text-xs text-muted-foreground">
                  Hashtags the AI should never use
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rotatingHashtags">Rotate Through</Label>
                <Input
                  id="rotatingHashtags"
                  value={rotatingHashtags}
                  onChange={(e: any) => setRotatingHashtags(e.target.value)}
                  placeholder="e.g., #Tips, #MondayMotivation, #FeatureFriday"
                />
                <p className="text-xs text-muted-foreground">
                  Hashtags to rotate between different posts
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.refresh()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Brand Voice
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
