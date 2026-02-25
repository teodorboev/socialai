"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, PieChart, TrendingUp, UserPlus, UserMinus, Activity } from "lucide-react";
import { useEffect, useState } from "react";

interface AudienceSegment {
  id: string;
  name: string;
  percentage: number;
  size: number;
  interests: string[];
  topAgeRange: string;
  topLocation: string;
  engagementRate: number;
}

export default function AudiencePage() {
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);

  useEffect(() => {
    loadAudience();
  }, []);

  async function loadAudience() {
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

    // Demo data - in production would come from AudienceIntelligenceAgent
    setSegments([
      {
        id: "1",
        name: "Young Professionals",
        percentage: 35,
        size: 12500,
        interests: ["Technology", "Career Growth", "Productivity"],
        topAgeRange: "25-34",
        topLocation: "New York, NY",
        engagementRate: 4.8,
      },
      {
        id: "2",
        name: "Small Business Owners",
        percentage: 28,
        size: 10000,
        interests: ["Marketing", "Finance", "Business Tools"],
        topAgeRange: "35-44",
        topLocation: "Los Angeles, CA",
        engagementRate: 5.2,
      },
      {
        id: "3",
        name: "Tech Enthusiasts",
        percentage: 20,
        size: 7140,
        interests: ["Gadgets", "AI", "Software"],
        topAgeRange: "18-24",
        topLocation: "San Francisco, CA",
        engagementRate: 6.1,
      },
      {
        id: "4",
        name: "Lifestyle Content Consumers",
        percentage: 17,
        size: 6070,
        interests: ["Wellness", "Travel", "Food"],
        topAgeRange: "25-34",
        topLocation: "Chicago, IL",
        engagementRate: 3.9,
      },
    ]);
    setLoading(false);
  }

  const totalAudience = segments.reduce((sum, s) => sum + s.size, 0);
  const avgEngagement = segments.reduce((sum, s) => sum + s.engagementRate, 0) / segments.length;

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
          <h1 className="text-3xl font-bold">Audience</h1>
          <p className="text-muted-foreground">Understand your audience segments and behavior</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Analyze Audience
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Audience</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAudience.toLocaleString()}</div>
            <p className="text-xs text-green-500">+15% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Segments</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segments.length}</div>
            <p className="text-xs text-muted-foreground">Active segments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement.toFixed(1)}%</div>
            <p className="text-xs text-green-500">+0.8% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12.5%</div>
            <p className="text-xs text-green-500">Monthly growth</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="segments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="interests">Interests</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        <TabsContent value="segments" className="space-y-4">
          {segments.map((segment) => (
            <Card key={segment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{segment.name}</CardTitle>
                    <CardDescription>{segment.size.toLocaleString()} followers ({segment.percentage}%)</CardDescription>
                  </div>
                  <Badge variant={segment.engagementRate > 5 ? "default" : "secondary"}>
                    {segment.engagementRate}% engagement
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Top Age Range:</span>
                    <p className="font-medium">{segment.topAgeRange}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Top Location:</span>
                    <p className="font-medium">{segment.topLocation}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Engagement Rate:</span>
                    <p className="font-medium">{segment.engagementRate}%</p>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">Interests:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {segment.interests.map((interest) => (
                      <Badge key={interest} variant="outline">{interest}</Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline">View Details</Button>
                  <Button size="sm" variant="ghost">Target This Segment</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="demographics">
          <Card>
            <CardHeader>
              <CardTitle>Demographics Breakdown</CardTitle>
              <CardDescription>Age, gender, and location distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["18-24", "25-34", "35-44", "45-54", "55+"].map((age, i) => (
                  <div key={age} className="flex items-center gap-4">
                    <span className="w-16 text-sm">{age}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${[35, 40, 15, 7, 3][i]}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm text-right">{[35, 40, 15, 7, 3][i]}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interests">
          <Card>
            <CardHeader>
              <CardTitle>Interest Categories</CardTitle>
              <CardDescription>Top interests across your audience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["Technology", "Business", "Marketing", "Finance", "Travel", "Wellness", "Food", "Entertainment", "Sports", "Fashion"].map((interest) => (
                  <Badge key={interest} variant="outline" className="px-4 py-2">
                    {interest}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior">
          <Card>
            <CardHeader>
              <CardTitle>Audience Behavior</CardTitle>
              <CardDescription>How your audience interacts with your content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">3.2x</div>
                  <div className="text-sm text-muted-foreground">Avg. content views</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">8.5%</div>
                  <div className="text-sm text-muted-foreground">Click-through rate</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">12 min</div>
                  <div className="text-sm text-muted-foreground">Avg. time on content</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold">2.1 days</div>
                  <div className="text-sm text-muted-foreground">Avg. return interval</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
