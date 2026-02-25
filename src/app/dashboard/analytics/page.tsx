import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Eye, Heart, Share2, MessageCircle } from "lucide-react";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!orgMember) {
    redirect("/onboarding");
  }

  const orgId = orgMember.organization_id;

  // Get analytics snapshots
  const { data: snapshots } = await supabase
    .from("analytics_snapshots")
    .select("*")
    .eq("organization_id", orgId)
    .order("snapshot_date", { ascending: false })
    .limit(30);

  // Get social accounts
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("platform, platform_username")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  // Get content stats
  const { data: contentStats } = await supabase
    .from("content")
    .select("status, platform, content_type")
    .eq("organization_id", orgId)
    .eq("status", "PUBLISHED");

  // Calculate totals
  const totalFollowers = snapshots?.reduce((sum, s) => sum + (s.followers || 0), 0) || 0;
  const totalImpressions = snapshots?.reduce((sum, s) => sum + (s.impressions || 0), 0) || 0;
  const totalReach = snapshots?.reduce((sum, s) => sum + (s.reach || 0), 0) || 0;
  const totalEngagements = snapshots?.reduce(
    (sum, s) => sum + ((s.clicks || 0) + (s.shares || 0) + (s.saves || 0)),
    0
  ) || 0;
  const avgEngagementRate =
    snapshots && snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + (s.engagement_rate || 0), 0) / snapshots.length
      : 0;

  // Group by platform
  const platformStats = snapshots?.reduce(
    (acc, s) => {
      if (!acc[s.platform]) {
        acc[s.platform] = { followers: 0, impressions: 0, reach: 0 };
      }
      acc[s.platform].followers += s.followers || 0;
      acc[s.platform].impressions += s.impressions || 0;
      acc[s.platform].reach += s.reach || 0;
      return acc;
    },
    {} as Record<string, { followers: number; impressions: number; reach: number }>
  ) || {};

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
            <div className="text-2xl font-bold">{totalFollowers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reach</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReach.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagementRate.toFixed(2)}%</div>
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
              {accounts && accounts.length > 0 ? (
                <div className="space-y-4">
                  {accounts.map((account: any) => {
                    const stats = platformStats[account.platform] || {
                      followers: 0,
                      impressions: 0,
                      reach: 0,
                    };
                    return (
                      <div key={account.platform} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge>{account.platform}</Badge>
                          <span className="text-sm text-muted-foreground">
                            @{account.platform_username}
                          </span>
                        </div>
                        <div className="flex gap-8 text-sm">
                          <div>
                            <span className="text-muted-foreground">Followers: </span>
                            <span className="font-medium">{stats.followers.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Impressions: </span>
                            <span className="font-medium">{stats.impressions.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reach: </span>
                            <span className="font-medium">{stats.reach.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

        {/* Platform-specific tabs would show more detailed metrics */}
        <TabsContent value="instagram">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>Instagram analytics details coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="facebook">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>Facebook analytics details coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tiktok">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>TikTok analytics details coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="twitter">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p>Twitter analytics details coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Content Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Content Performance</CardTitle>
          <CardDescription>Your published content metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {contentStats && contentStats.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-3xl font-bold">{contentStats.length}</div>
                <div className="text-sm text-muted-foreground">Total Posts</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {contentStats.filter((c: any) => c.content_type === "REEL" || c.content_type === "VIDEO")
                    .length}
                </div>
                <div className="text-sm text-muted-foreground">Videos/Reels</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {contentStats.filter((c: any) => c.content_type === "CAROUSEL").length}
                </div>
                <div className="text-sm text-muted-foreground">Carousels</div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No published content yet</p>
              <p className="text-sm">Create and publish content to see performance</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
