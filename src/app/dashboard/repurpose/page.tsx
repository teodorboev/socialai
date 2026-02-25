"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, RefreshCw, ArrowRight, Instagram, Facebook, Linkedin, Twitter, Video, Image, FileText } from "lucide-react";
import { useEffect, useState } from "react";

interface RepurposedContent {
  id: string;
  originalPlatform: string;
  originalType: string;
  adaptations: {
    platform: string;
    type: string;
    caption: string;
  }[];
  status: string;
  engagement: number;
}

export default function RepurposePage() {
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<RepurposedContent[]>([]);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
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

    // Demo data - would come from RepurposeAgent
    setContents([
      {
        id: "1",
        originalPlatform: "youtube",
        originalType: "Video",
        adaptations: [
          {
            platform: "instagram",
            type: "Reel",
            caption: "🎥 5 tips for better social media content! Watch the full video on YouTube #Tips #ContentMarketing",
          },
          {
            platform: "twitter",
            type: "Thread",
            caption: "5 tips for better social media content 🧵👇",
          },
          {
            platform: "linkedin",
            type: "Post",
            caption: "Here are 5 actionable tips to improve your content strategy...",
          },
        ],
        status: "published",
        engagement: 4.2,
      },
      {
        id: "2",
        originalPlatform: "blog",
        originalType: "Article",
        adaptations: [
          {
            platform: "instagram",
            type: "Carousel",
            caption: "10 ways to grow your business in 2024 📱 Swipe to learn more!",
          },
          {
            platform: "facebook",
            type: "Post",
            caption: "Want to grow your business? Here are 10 proven strategies...",
          },
        ],
        status: "draft",
        engagement: 0,
      },
    ]);
    setLoading(false);
  }

  const totalRepurposed = contents.length;
  const publishedCount = contents.filter(c => c.status === "published").length;

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
          <h1 className="text-3xl font-bold">Repurpose</h1>
          <p className="text-muted-foreground">Turn one piece of content into many</p>
        </div>
        <Button>
          <Copy className="mr-2 h-4 w-4" />
          Repurpose Content
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Repurposed</CardTitle>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRepurposed}</div>
            <p className="text-xs text-muted-foreground">Content items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Adaptations</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contents.reduce((sum, c) => sum + c.adaptations.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">New pieces created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedCount}</div>
            <p className="text-xs text-green-500">Ready to post</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          {contents.map((content) => (
            <Card key={content.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {content.originalType === "Video" ? (
                        <Video className="h-5 w-5" />
                      ) : content.originalType === "Article" ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <Image className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base capitalize">
                        {content.originalPlatform} {content.originalType}
                      </CardTitle>
                      <CardDescription>
                        {content.adaptations.length} adaptations
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={content.status === "published" ? "default" : "secondary"}>
                    {content.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4" />
                    <span>Adaptations:</span>
                  </div>
                  {content.adaptations.map((adaptation, i) => (
                    <div key={i} className="flex items-start gap-4 p-3 border rounded-lg">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        {adaptation.platform === "instagram" && <Instagram className="h-4 w-4 text-pink-500" />}
                        {adaptation.platform === "facebook" && <Facebook className="h-4 w-4 text-blue-500" />}
                        {adaptation.platform === "linkedin" && <Linkedin className="h-4 w-4 text-blue-700" />}
                        {adaptation.platform === "twitter" && <Twitter className="h-4 w-4 text-black" />}
                        <span className="text-sm font-medium capitalize">{adaptation.platform}</span>
                        <Badge variant="outline" className="text-xs">
                          {adaptation.type}
                        </Badge>
                      </div>
                      <p className="flex-1 text-sm">{adaptation.caption}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Repurposing Templates</CardTitle>
              <CardDescription>Pre-configured templates for content repurposing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Video to Social", description: "Turn YouTube/Video content into posts, reels, and threads", platforms: ["Instagram", "Twitter", "LinkedIn"] },
                  { name: "Blog to Visual", description: "Convert articles into carousels and infographics", platforms: ["Instagram", "Facebook"] },
                  { name: "Thread Generator", description: "Create Twitter threads from long-form content", platforms: ["Twitter"] },
                  { name: "LinkedIn Expansion", description: "Expand blog posts into professional articles", platforms: ["LinkedIn"] },
                ].map((template, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-muted-foreground">{template.description}</div>
                      <div className="flex gap-2 mt-2">
                        {template.platforms.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Use Template</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Repurposing History</CardTitle>
              <CardDescription>View your past content repurposing activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No repurposing history yet</p>
                <p className="text-sm">Repurpose your first content to see it here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
