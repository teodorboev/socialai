"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Target, DollarSign, MousePointer, Sparkles, Copy, RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";

interface AdCopy {
  id: string;
  headline: string;
  body: string;
  cta: string;
  platform: string;
  status: string;
  engagement: number;
}

export default function AdCopyPage() {
  const [loading, setLoading] = useState(true);
  const [adCopies, setAdCopies] = useState<AdCopy[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("instagram");

  useEffect(() => {
    loadAdCopies();
  }, []);

  async function loadAdCopies() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
      return;
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      redirect("/onboarding");
      return;
    }

    // Demo data - would come from AdCopyAgent
    setAdCopies([
      {
        id: "1",
        headline: "Automate Your Social Media Like a Pro",
        body: "Let AI handle your posting schedule while you focus on growing your business. Join 10,000+ small businesses saving 5 hours/week.",
        cta: "Start Free Trial",
        platform: "instagram",
        status: "active",
        engagement: 4.8,
      },
      {
        id: "2",
        headline: "The Smart Way to Build Your Brand",
        body: "Create, schedule, and analyze your social content in one place. No expertise required.",
        cta: "Get Started",
        platform: "facebook",
        status: "paused",
        engagement: 3.2,
      },
      {
        id: "3",
        headline: "Stop Wasting Time on Manual Posting",
        body: "Our AI creates and schedules posts that actually perform. See results in your first week.",
        cta: "Try Free",
        platform: "linkedin",
        status: "active",
        engagement: 5.1,
      },
    ]);
    setLoading(false);
  }

  const activeAds = adCopies.filter(a => a.status === "active").length;
  const avgEngagement = adCopies.reduce((sum, a) => sum + a.engagement, 0) / adCopies.length;

  async function handleGenerateAd() {
    setGenerating(true);
    // In production, would call AdCopyAgent
    setTimeout(() => {
      setGenerating(false);
    }, 2000);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ad Copy</h1>
          <p className="text-muted-foreground">Generate high-converting ad copy with AI</p>
        </div>
        <Button onClick={handleGenerateAd} disabled={generating}>
          <Sparkles className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating..." : "Generate Ad Copy"}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Ads</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adCopies.length}</div>
            <p className="text-xs text-muted-foreground">Generated copies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAds}</div>
            <p className="text-xs text-muted-foreground">Running ads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Engagement</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement.toFixed(1)}%</div>
            <p className="text-xs text-green-500">+0.5% from last campaign</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Create New Ad Copy</CardTitle>
              <CardDescription>Generate AI-powered ad copy for your campaigns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter/X</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ad Objective</Label>
                  <Select defaultValue="awareness">
                    <SelectTrigger>
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="awareness">Brand Awareness</SelectItem>
                      <SelectItem value="engagement">Engagement</SelectItem>
                      <SelectItem value="traffic">Website Traffic</SelectItem>
                      <SelectItem value="conversion">Conversions</SelectItem>
                      <SelectItem value="leads">Lead Generation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Product/Service Description</Label>
                <Textarea 
                  placeholder="Describe your product or service, target audience, and key benefits..." 
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Tone of Voice</Label>
                <Select defaultValue="professional">
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="humorous">Humorous</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="Inspirational">Inspirational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Key Message (optional)</Label>
                <Textarea 
                  placeholder="Any specific message or angle you want to emphasize..." 
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex justify-end">
                <Button size="lg">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Ad Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          {adCopies.map((ad) => (
            <Card key={ad.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{ad.headline}</CardTitle>
                    <CardDescription className="capitalize">{ad.platform}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ad.status === "active" ? "default" : "secondary"}>
                      {ad.status}
                    </Badge>
                    <Badge variant="outline">
                      {ad.engagement}% engagement
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg mb-4">
                  <p className="text-sm">{ad.body}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">CTA:</span> {ad.cta}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline">
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Regenerate
                    </Button>
                    <Button size="sm">
                      <Send className="mr-1 h-3 w-3" />
                      Use in Campaign
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
              <CardDescription>Manage your ad campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["Summer Sale", "Product Launch", "Brand Awareness Q1"].map((campaign, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{campaign}</div>
                      <div className="text-sm text-muted-foreground">
                        {["Instagram, Facebook", "LinkedIn, Twitter", "All Platforms"][i]}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">${(Math.random() * 5000 + 1000).toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">Spent</div>
                      </div>
                      <Button size="sm" variant="outline">Manage</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
