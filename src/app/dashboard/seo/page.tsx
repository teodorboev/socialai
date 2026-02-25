"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Hash, TrendingUp, AlertCircle, CheckCircle, XCircle, FileText, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

interface SEOAudit {
  keyword: string;
  volume: number;
  difficulty: number;
  currentRank: number | null;
  opportunity: string;
  recommendations: string[];
}

export default function SEOPage() {
  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState<SEOAudit[]>([]);

  useEffect(() => {
    loadSEO();
  }, []);

  async function loadSEO() {
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

    // Demo data - would come from SocialSEOAgent
    setAudits([
      {
        keyword: "social media management",
        volume: 12500,
        difficulty: 72,
        currentRank: 15,
        opportunity: "High - compete for top 10",
        recommendations: ["Add more backlinks", "Increase content frequency"],
      },
      {
        keyword: "AI social media marketing",
        volume: 8200,
        difficulty: 58,
        currentRank: 8,
        opportunity: "Excellent - top 5 achievable",
        recommendations: ["Optimize meta tags", "Add schema markup"],
      },
      {
        keyword: "small business social media",
        volume: 6800,
        difficulty: 45,
        currentRank: 23,
        opportunity: "Good - quick wins available",
        recommendations: ["Target long-tail keywords", "Improve page speed"],
      },
      {
        keyword: "automated content posting",
        volume: 4100,
        difficulty: 38,
        currentRank: null,
        opportunity: "Untapped - create new content",
        recommendations: ["Create pillar content", "Build internal links"],
      },
    ]);
    setLoading(false);
  }

  const trackedKeywords = audits.length;
  const avgDifficulty = audits.reduce((sum, a) => sum + a.difficulty, 0) / audits.length;
  const rankingKeywords = audits.filter(a => a.currentRank !== null).length;
  const top10Keywords = audits.filter(a => a.currentRank && a.currentRank <= 10).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
          <h1 className="text-3xl font-bold">SEO</h1>
          <p className="text-muted-foreground">Optimize your content for social search</p>
        </div>
        <Button>
          <Search className="mr-2 h-4 w-4" />
          Run SEO Audit
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tracked Keywords</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trackedKeywords}</div>
            <p className="text-xs text-muted-foreground">Active keywords</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Difficulty</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDifficulty.toFixed(0)}</div>
            <p className="text-xs text-yellow-500">Moderate competition</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ranking</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankingKeywords}</div>
            <p className="text-xs text-muted-foreground">Keywords indexed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top 10</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{top10Keywords}</div>
            <p className="text-xs text-green-500">+2 from last month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="keywords" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="content">Content Analysis</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtag Strategy</TabsTrigger>
          <TabsTrigger value="technical">Technical SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Rankings</CardTitle>
              <CardDescription>Your search rankings for tracked keywords</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {audits.map((audit) => (
                  <div key={audit.keyword} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{audit.keyword}</div>
                      <div className="text-sm text-muted-foreground">
                        Volume: {audit.volume.toLocaleString()} | Difficulty: {audit.difficulty}/100
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold">
                          {audit.currentRank ? `#${audit.currentRank}` : <XCircle className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="text-xs text-muted-foreground">Current Rank</div>
                      </div>
                      <Badge variant={audit.difficulty < 50 ? "default" : audit.difficulty < 70 ? "secondary" : "destructive"}>
                        {audit.difficulty < 50 ? "Easy" : audit.difficulty < 70 ? "Medium" : "Hard"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Content Analysis</CardTitle>
              <CardDescription>SEO analysis of your social content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["Top Performing Post", "Latest Campaign", "Product Launch"].map((title, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="text-sm text-muted-foreground">
                        SEO Score: {75 + i * 8}/100
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Good keyword density
                      </Badge>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hashtags">
          <Card>
            <CardHeader>
              <CardTitle>Hashtag Performance</CardTitle>
              <CardDescription>Which hashtags drive the most reach</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["#SocialMediaMarketing", "#SmallBusiness", "#AI", "#ContentStrategy", "#Growth"].map((tag, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <Badge variant="outline" className="text-sm">{tag}</Badge>
                    <div className="text-sm">
                      <span className="font-medium">{10000 - i * 1500}</span>
                      <span className="text-muted-foreground"> impressions</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical">
          <Card>
            <CardHeader>
              <CardTitle>Technical SEO</CardTitle>
              <CardDescription>Technical optimization status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Profile Links", status: "good", message: "All links are working" },
                  { name: "Bio Keywords", status: "warning", message: "Add more relevant keywords" },
                  { name: "Alt Text", status: "good", message: "All images have alt text" },
                  { name: "Link Building", status: "needs-work", message: "Only 3 backlinks found" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.status === "good" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : item.status === "warning" ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.message}</div>
                      </div>
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
