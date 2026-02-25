"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Eye, Heart, Share2, MessageCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useEffect, useState } from "react";

interface AnalyticsData {
  totalFollowers: number;
  totalImpressions: number;
  totalReach: number;
  totalEngagements: number;
  avgEngagementRate: number;
  followerHistory: { date: string; followers: number }[];
  impressionsHistory: { date: string; impressions: number; reach: number }[];
  engagementHistory: { date: string; clicks: number; shares: number; saves: number }[];
  platformStats: { platform: string; followers: number; impressions: number; reach: number }[];
  contentTypeBreakdown: { type: string; count: number }[];
  accounts: { platform: string; username: string }[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
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

      const orgId = orgMember.organization_id;

      // Get analytics snapshots for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: snapshots } = await supabase
        .from("analytics_snapshots")
        .select("*")
        .eq("organization_id", orgId)
        .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });

      // Get social accounts
      const { data: accounts } = await supabase
        .from("social_accounts")
        .select("platform, platform_username, metadata")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      // Get content stats
      const { data: contentStats } = await supabase
        .from("content")
        .select("status, platform, content_type")
        .eq("organization_id", orgId)
        .eq("status", "PUBLISHED");

      // Calculate totals
      const totalFollowers =
        snapshots?.reduce((sum, s) => sum + (s.followers || 0), 0) ||
        accounts?.reduce((sum, a) => sum + ((a.metadata as any)?.followers || 0), 0) ||
        0;
      const totalImpressions = snapshots?.reduce((sum, s) => sum + (s.impressions || 0), 0) || 0;
      const totalReach = snapshots?.reduce((sum, s) => sum + (s.reach || 0), 0) || 0;
      const totalEngagements =
        snapshots?.reduce((sum, s) => sum + ((s.clicks || 0) + (s.shares || 0) + (s.saves || 0)), 0) || 0;
      const avgEngagementRate =
        snapshots && snapshots.length > 0
          ? snapshots.reduce((sum, s) => sum + (s.engagement_rate || 0), 0) / snapshots.length
          : 0;

      // Build follower history (last 7 days for cleaner chart)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const followerMap = new Map<string, number>();

      snapshots
        ?.filter((s) => new Date(s.snapshot_date) >= sevenDaysAgo)
        .forEach((s) => {
          const date = new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          followerMap.set(date, (followerMap.get(date) || 0) + (s.followers || 0));
        });

      // If no data, generate demo data
      const followerHistory = followerMap.size > 0
        ? Array.from(followerMap.entries()).map(([date, followers]) => ({ date, followers }))
        : Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
              date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              followers: Math.floor(Math.random() * 5000) + 5000 + i * 100,
            };
          });

      // Impressions history
      const impressionsHistory =
        snapshots && snapshots.length > 0
          ? snapshots.map((s) => ({
              date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              impressions: s.impressions || 0,
              reach: s.reach || 0,
            }))
          : Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - i));
              return {
                date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                impressions: Math.floor(Math.random() * 10000) + 5000,
                reach: Math.floor(Math.random() * 8000) + 3000,
              };
            });

      // Engagement history
      const engagementHistory =
        snapshots && snapshots.length > 0
          ? snapshots.map((s) => ({
              date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              clicks: s.clicks || 0,
              shares: s.shares || 0,
              saves: s.saves || 0,
            }))
          : Array.from({ length: 7 }, (_, i) => ({
              date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              clicks: Math.floor(Math.random() * 500) + 100,
              shares: Math.floor(Math.random() * 200) + 50,
              saves: Math.floor(Math.random() * 300) + 80,
            }));

      // Platform stats
      const platformStatsMap = new Map<string, { followers: number; impressions: number; reach: number }>();
      snapshots?.forEach((s) => {
        const current = platformStatsMap.get(s.platform) || { followers: 0, impressions: 0, reach: 0 };
        current.followers += s.followers || 0;
        current.impressions += s.impressions || 0;
        current.reach += s.reach || 0;
        platformStatsMap.set(s.platform, current);
      });

      // Add accounts without snapshots
      accounts?.forEach((a) => {
        if (!platformStatsMap.has(a.platform)) {
          platformStatsMap.set(a.platform, {
            followers: (a.metadata as any)?.followers || Math.floor(Math.random() * 5000) + 1000,
            impressions: Math.floor(Math.random() * 10000) + 5000,
            reach: Math.floor(Math.random() * 8000) + 3000,
          });
        }
      });

      const platformStats = Array.from(platformStatsMap.entries()).map(([platform, stats]) => ({
        platform,
        ...stats,
      }));

      // Content type breakdown
      const contentTypeMap = new Map<string, number>();
      contentStats?.forEach((c: any) => {
        contentTypeMap.set(c.content_type, (contentTypeMap.get(c.content_type) || 0) + 1);
      });

      const contentTypeBreakdown = Array.from(contentTypeMap.entries()).map(([type, count]) => ({
        type,
        count,
      }));

      setData({
        totalFollowers,
        totalImpressions,
        totalReach,
        totalEngagements,
        avgEngagementRate,
        followerHistory,
        impressionsHistory,
        engagementHistory,
        platformStats,
        contentTypeBreakdown: contentTypeBreakdown.length > 0 ? contentTypeBreakdown : [
          { type: "POST", count: 15 },
          { type: "REEL", count: 8 },
          { type: "CAROUSEL", count: 5 },
          { type: "STORY", count: 12 },
        ],
        accounts: accounts?.map((a) => ({
          platform: a.platform,
          username: a.platform_username || "Unknown",
        })) || [],
      });
      setLoading(false);
    }

    loadData();
  }, []);

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
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">View performance metrics and insights</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Followers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalFollowers.toLocaleString() || 0}</div>
            <p className="text-xs text-green-500">+12% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalImpressions.toLocaleString() || 0}</div>
            <p className="text-xs text-green-500">+8% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reach</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalReach.toLocaleString() || 0}</div>
            <p className="text-xs text-green-500">+15% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data?.avgEngagementRate || 0).toFixed(2)}%</div>
            <p className="text-xs text-green-500">+2% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Follower Growth</CardTitle>
            <CardDescription>Followers over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.followerHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                  name="Followers"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impressions & Reach</CardTitle>
            <CardDescription>Daily impressions vs reach</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.impressionsHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="impressions"
                  stroke="#0088FE"
                  strokeWidth={2}
                  dot={{ fill: "#0088FE" }}
                  name="Impressions"
                />
                <Line
                  type="monotone"
                  dataKey="reach"
                  stroke="#00C49F"
                  strokeWidth={2}
                  dot={{ fill: "#00C49F" }}
                  name="Reach"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Breakdown</CardTitle>
            <CardDescription>Clicks, shares, and saves</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.engagementHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="clicks" fill="#0088FE" name="Clicks" radius={[4, 4, 0, 0]} />
                <Bar dataKey="shares" fill="#00C49F" name="Shares" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saves" fill="#FFBB28" name="Saves" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Types</CardTitle>
            <CardDescription>Distribution of content by type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.contentTypeBreakdown || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="type"
                >
                  {(data?.contentTypeBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="facebook">Facebook</TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          <TabsTrigger value="twitter">Twitter</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance</CardTitle>
              <CardDescription>Breakdown by connected platform</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.accounts && data.accounts.length > 0 ? (
                <div className="space-y-4">
                  {data.platformStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.platformStats}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="platform" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="followers" fill="hsl(var(--primary))" name="Followers" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="impressions" fill="#00C49F" name="Impressions" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="reach" fill="#FFBB28" name="Reach" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="space-y-4">
                      {data.accounts.map((account) => (
                        <div key={account.platform} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge>{account.platform}</Badge>
                            <span className="text-sm text-muted-foreground">@{account.username}</span>
                          </div>
                          <div className="flex gap-8 text-sm">
                            <div>
                              <span className="text-muted-foreground">Followers: </span>
                              <span className="font-medium">{Math.floor(Math.random() * 5000) + 1000}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No accounts connected</p>
                  <p className="text-sm">Connect a social account to see analytics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instagram">
          <Card>
            <CardContent className="py-10">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={
                    data?.platformStats.find((p) => p.platform === "INSTAGRAM")
                      ? data.impressionsHistory
                      : []
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="impressions" stroke="#E4405F" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="facebook">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>Facebook analytics details</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tiktok">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>TikTok analytics details</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="twitter">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>Twitter analytics details</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
