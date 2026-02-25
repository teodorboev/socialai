import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Heart, User, AlertTriangle, Check, X, Send } from "lucide-react";

const sentimentColors: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800",
  NEUTRAL: "bg-gray-100 text-gray-800",
  NEGATIVE: "bg-red-100 text-red-800",
  URGENT: "bg-red-200 text-red-900",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  AUTO_RESPONDED: "bg-green-100 text-green-800",
  PENDING_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SKIPPED: "bg-gray-100 text-gray-800",
};

export default async function EngagementPage() {
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

  // Get engagements
  const { data: engagements } = await supabase
    .from("engagements")
    .select(`
      *,
      social_accounts!inner(platform, platform_username),
      content(caption)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Get counts by status
  const { data: statusCounts } = await supabase
    .from("engagements")
    .select("ai_response_status")
    .eq("organization_id", orgId);

  const counts = {
    pending: statusCounts?.filter((e) => e.ai_response_status === "PENDING").length || 0,
    pendingReview: statusCounts?.filter((e) => e.ai_response_status === "PENDING_REVIEW").length || 0,
    autoResponded: statusCounts?.filter((e) => e.ai_response_status === "AUTO_RESPONDED").length || 0,
    escalated: statusCounts?.filter((e: any) => e.is_escalated === true).length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Engagement</h1>
        <p className="text-muted-foreground">Monitor and respond to comments, mentions, and messages</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Need Review</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.pendingReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Auto-Replied</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.autoResponded}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Escalated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.escalated}</div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="review">Review ({counts.pendingReview})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({counts.escalated})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <EngagementList engagements={engagements || []} />
        </TabsContent>
        <TabsContent value="pending" className="space-y-4">
          <EngagementList
            engagements={(engagements || []).filter((e: any) => e.ai_response_status === "PENDING")}
          />
        </TabsContent>
        <TabsContent value="review" className="space-y-4">
          <EngagementList
            engagements={(engagements || []).filter((e: any) => e.ai_response_status === "PENDING_REVIEW")}
          />
        </TabsContent>
        <TabsContent value="escalated" className="space-y-4">
          <EngagementList
            engagements=          {(engagements || []).filter((e: any) => e.is_escalated === true)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EngagementList({ engagements }: { engagements: any[] }) {
  if (engagements.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No engagements found</p>
          <p className="text-sm">Connect a social account to start monitoring engagement</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {engagements.map((engagement: any) => (
        <Card key={engagement.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">@{engagement.author_username || "anonymous"}</span>
                  <Badge variant="outline">{engagement.engagement_type}</Badge>
                  {engagement.sentiment && (
                    <Badge className={sentimentColors[engagement.sentiment] || "bg-gray-100"}>
                      {engagement.sentiment}
                    </Badge>
                  )}
                  <Badge className={statusColors[engagement.ai_response_status] || "bg-gray-100"}>
                    {engagement.ai_response_status?.replace("_", " ") || "PENDING"}
                  </Badge>
                </div>
                <p className="text-sm">{engagement.body}</p>
                {engagement.ai_response && (
                  <div className="rounded-md bg-green-50 p-3 text-sm">
                    <div className="flex items-center gap-2 text-green-700">
                      <Send className="h-3 w-3" />
                      <span className="font-medium">AI Response:</span>
                    </div>
                    <p className="mt-1">{engagement.ai_response}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(engagement.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {engagement.ai_response_status === "PENDING_REVIEW" && (
                  <>
                    <Button size="sm" variant="default">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
