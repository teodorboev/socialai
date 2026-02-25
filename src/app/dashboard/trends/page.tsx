"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Zap, AlertCircle, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface TrendData {
  id: string;
  topic: string;
  category: string;
  momentum: number;
  relevance: number;
  sentiment: string;
  lastSeen: string;
  relatedHashtags: string[];
}

export default function TrendsPage() {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadTrends();
  }, []);

  async function loadTrends() {
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

    // For demo, generate trend data
    // In production, this would come from TrendScoutAgent
    setTrends([
      {
        id: "1",
        topic: "AI Tools for Small Business",
        category: "Technology",
        momentum: 92,
        relevance: 88,
        sentiment: "positive",
        lastSeen: new Date().toISOString(),
        relatedHashtags: ["#AI", "#SmallBusiness", "#TechTrends"],
      },
      {
        id: "2",
        topic: "Sustainable Packaging",
        category: "Sustainability",
        momentum: 78,
        relevance: 85,
        sentiment: "positive",
        lastSeen: new Date().toISOString(),
        relatedHashtags: ["#Sustainable", "#EcoFriendly", "#Packaging"],
      },
      {
        id: "3",
        topic: "Remote Work Culture",
        category: "Business",
        momentum: 65,
        relevance: 72,
        sentiment: "neutral",
        lastSeen: new Date().toISOString(),
        relatedHashtags: ["#RemoteWork", "#WorkFromHome", "#OfficeLife"],
      },
      {
        id: "4",
        topic: "Holiday Shopping Early",
        category: "Retail",
        momentum: 88,
        relevance: 90,
        sentiment: "positive",
        lastSeen: new Date().toISOString(),
        relatedHashtags: ["#HolidayShopping", "#BlackFriday", "#EarlyDeals"],
      },
      {
        id: "5",
        topic: "Creator Economy Growth",
        category: "Content",
        momentum: 82,
        relevance: 75,
        sentiment: "positive",
        lastSeen: new Date().toISOString(),
        relatedHashtags: ["#Creator", "#Influencer", "#ContentCreator"],
      },
    ]);
    setLoading(false);
  }

  async function handleScanTrends() {
    setScanning(true);
    // In production, this would call the TrendScoutAgent via API
    setTimeout(() => {
      setScanning(false);
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
          <h1 className="text-3xl font-bold">Trends</h1>
          <p className="text-muted-foreground">Discover and leverage trending topics</p>
        </div>
        <Button onClick={handleScanTrends} disabled={scanning}>
          <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Scan for Trends"}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Trends</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trends.length}</div>
            <p className="text-xs text-muted-foreground">Trending now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Momentum</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trends.filter(t => t.momentum > 80).length}</div>
            <p className="text-xs text-green-500">+20% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Relevance Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(trends.reduce((sum, t) => sum + t.relevance, 0) / trends.length)}%
            </div>
            <p className="text-xs text-muted-foreground">Average relevance</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Trends</TabsTrigger>
          <TabsTrigger value="technology">Technology</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="lifestyle">Lifestyle</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {trends.map((trend) => (
            <Card key={trend.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{trend.topic}</CardTitle>
                    <CardDescription>{trend.category}</CardDescription>
                  </div>
                  <Badge variant={trend.momentum > 80 ? "default" : "secondary"}>
                    {trend.momentum > 80 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                    {trend.momentum}% momentum
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Relevance:</span>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${trend.relevance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{trend.relevance}%</span>
                  </div>
                  <Badge variant={trend.sentiment === "positive" ? "default" : trend.sentiment === "negative" ? "destructive" : "secondary"}>
                    {trend.sentiment}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trend.relatedHashtags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline">Create Content</Button>
                  <Button size="sm" variant="ghost">Add to Watchlist</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="technology">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Filter trends by technology category
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Filter trends by business category
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifestyle">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Filter trends by lifestyle category
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Target({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
