import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Heart, MessageCircle, Award, Sparkles } from "lucide-react";

export default async function CommunityPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get org member
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!orgMember) redirect("/onboarding");

  const orgId = orgMember.organization_id;

  // Get engagement stats for community health
  const { data: engagements } = await supabase
    .from("engagements")
    .select("*")
    .eq("organization_id", orgId)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const totalEngagements = engagements?.length || 0;
  const positiveEngagements = engagements?.filter(e => e.sentiment === "POSITIVE").length || 0;
  
  // Get content stats
  const { data: content } = await supabase
    .from("content")
    .select("id, status, platform")
    .eq("organization_id", orgId)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const publishedContent = content?.filter(c => c.status === "PUBLISHED").length || 0;

  // Mock super fans (in real app, would calculate from engagement data)
  const superFans = [
    { handle: "@brandadvocate1", platform: "Instagram", engagement: 156, score: 95 },
    { handle: "@loyalcustomer", platform: "Twitter", engagement: 89, score: 88 },
    { handle: "@communityhero", platform: "Facebook", engagement: 67, score: 82 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Community</h1>
        <p className="text-muted-foreground">
          Build and nurture your brand community
        </p>
      </div>

      {/* Community Health */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Engagements</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagements}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEngagements > 0 ? Math.round((positiveEngagements / totalEngagements) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Of all engagements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published Content</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedContent}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Community Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">Month over month</p>
          </CardContent>
        </Card>
      </div>

      {/* Super Fans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Top Super Fans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {superFans.map((fan, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{fan.handle}</p>
                    <p className="text-sm text-muted-foreground">{fan.platform}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{fan.engagement} engagements</Badge>
                  <p className="text-xs text-muted-foreground mt-1">Score: {fan.score}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Community Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Launch a community engagement campaign to boost interaction and identify brand advocates.
            </p>
            <Button>Create Campaign</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>UGC Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Request user-generated content from your community to build social proof.
            </p>
            <Button variant="outline">Request UGC</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
