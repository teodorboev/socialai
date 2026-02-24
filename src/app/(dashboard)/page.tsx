import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, MessageCircle, Users, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get organization info
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .single();

  if (!orgMember) {
    redirect("/onboarding");
  }

  const orgId = orgMember.organization_id;
  const orgName = (orgMember as any).organizations?.name || "Your Organization";

  // Get stats
  const [
    { count: contentCount },
    { count: pendingReview },
    { count: escalations },
    { count: accounts },
  ] = await Promise.all([
    supabase.from("content").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("content").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "PENDING_REVIEW"),
    supabase.from("escalations").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "OPEN"),
    supabase.from("social_accounts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.email?.split("@")[0]}</h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with {orgName}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentCount || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Escalations</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{escalations || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts || 0}</div>
            <p className="text-xs text-muted-foreground">Social platforms</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your AI agents have been busy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity yet.</p>
              <p className="text-sm">Connect a social account to get started!</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/dashboard/content/create"
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5" />
              <span>Generate new content</span>
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
      </div>
    </div>
  );
}
