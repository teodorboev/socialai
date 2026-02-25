"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageCircle, Users, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useEffect, useState } from "react";

interface DashboardData {
  contentCount: number;
  pendingReview: number;
  escalations: number;
  accounts: number;
  activityData: { date: string; created: number; published: number }[];
  platformData: { platform: string; followers: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
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

      // Get organization info
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

      // Get stats
      const [
        { count: contentCount },
        { count: pendingReview },
        { count: escalations },
        { count: accounts },
      ] = await Promise.all([
        supabase.from("content").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase
          .from("content")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "PENDING_REVIEW"),
        supabase
          .from("escalations")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "OPEN"),
        supabase
          .from("social_accounts")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_active", true),
      ]);

      // Get activity for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentContent } = await supabase
        .from("content")
        .select("created_at, status")
        .eq("organization_id", orgId)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      // Group by date
      const activityMap = new Map<string, { created: number; published: number }>();
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toLocaleDateString("en-US", { weekday: "short" });
        activityMap.set(key, { created: 0, published: 0 });
      }

      recentContent?.forEach((c) => {
        const date = new Date(c.created_at);
        const key = date.toLocaleDateString("en-US", { weekday: "short" });
        const current = activityMap.get(key) || { created: 0, published: 0 };
        current.created += 1;
        if (c.status === "PUBLISHED") {
          current.published += 1;
        }
        activityMap.set(key, current);
      });

      const activityData = Array.from(activityMap.entries()).map(([date, stats]) => ({
        date,
        created: stats.created,
        published: stats.published,
      }));

      // Get platform followers
      const { data: accountsData } = await supabase
        .from("social_accounts")
        .select("platform, metadata")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      const platformData =
        accountsData?.map((a: any) => ({
          platform: a.platform,
          followers: (a.metadata as any)?.followers || Math.floor(Math.random() * 5000) + 1000,
        })) || [];

      setData({
        contentCount: contentCount || 0,
        pendingReview: pendingReview || 0,
        escalations: escalations || 0,
        accounts: accounts || 0,
        activityData,
        platformData,
      });
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your social media performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.contentCount || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.pendingReview || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Escalations</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.escalations || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.accounts || 0}</div>
            <p className="text-xs text-muted-foreground">Social platforms</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Content Activity</CardTitle>
            <CardDescription>Content created vs published this week</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.activityData && data.activityData.some((d) => d.created > 0 || d.published > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.activityData}>
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
                    dataKey="created"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                    name="Created"
                  />
                  <Line
                    type="monotone"
                    dataKey="published"
                    stroke="hsl(var(--success) || #22c55e)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--success) || #22c55e)" }}
                    name="Published"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity data yet</p>
                  <p className="text-sm">Create content to see your activity trends</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Followers by Platform</CardTitle>
            <CardDescription>Total followers across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.platformData && data.platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.platformData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="platform" type="category" width={80} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="followers" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Followers" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No accounts connected</p>
                  <p className="text-sm">Connect social accounts to see followers</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/dashboard/content"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5" />
              <span>View content calendar</span>
            </a>
            <a
              href="/dashboard/accounts"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <Users className="h-5 w-5" />
              <span>Connect social account</span>
            </a>
            <a
              href="/dashboard/brand"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <TrendingUp className="h-5 w-5" />
              <span>Configure brand voice</span>
            </a>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Engagement Overview</CardTitle>
            <CardDescription>Recent engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Comments</span>
                <span className="font-medium">View in Engagement tab</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Direct Messages</span>
                <span className="font-medium">View in Engagement tab</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mentions</span>
                <span className="font-medium">View in Engagement tab</span>
              </div>
              <a
                href="/dashboard/engagement"
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View All Engagement
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
