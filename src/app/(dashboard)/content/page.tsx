import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ContentGenerator } from "@/components/dashboard/content-generator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle, AlertCircle, XCircle } from "lucide-react";

export default async function ContentPage() {
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

  // Get content
  const { data: content } = await supabase
    .from("content")
    .select(`
      *,
      social_accounts(platform_username, platform)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get brand config status
  const { data: brandConfig } = await supabase
    .from("brand_configs")
    .select("id")
    .eq("organization_id", orgId)
    .single();

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-500",
    PENDING_REVIEW: "bg-yellow-500",
    APPROVED: "bg-blue-500",
    SCHEDULED: "bg-purple-500",
    PUBLISHING: "bg-orange-500",
    PUBLISHED: "bg-green-500",
    FAILED: "bg-red-500",
    REJECTED: "bg-red-700",
  };

  const statusIcons: Record<string, typeof FileText> = {
    DRAFT: FileText,
    PENDING_REVIEW: AlertCircle,
    APPROVED: CheckCircle,
    SCHEDULED: Clock,
    PUBLISHING: Clock,
    PUBLISHED: CheckCircle,
    FAILED: XCircle,
    REJECTED: XCircle,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content</h1>
        <p className="text-muted-foreground">Manage your scheduled and published content</p>
      </div>

      {!brandConfig && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Configure Brand Voice First</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700 mb-4">
              Before generating content, please set up your brand voice configuration.
            </p>
            <a href="/dashboard/brand">
              <Button variant="outline">Go to Brand Settings</Button>
            </a>
          </CardContent>
        </Card>
      )}

      {brandConfig && (
        <div className="grid gap-6 md:grid-cols-2">
          <ContentGenerator />
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Content</h2>
        {content && content.length > 0 ? (
          <div className="space-y-2">
            {content.map((item) => {
              const StatusIcon = statusIcons[item.status] || FileText;
              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={statusColors[item.status] || "bg-gray-500"}>
                            {item.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline">{item.platform}</Badge>
                          <Badge variant="secondary">{item.content_type}</Badge>
                        </div>
                        <p className="text-sm line-clamp-2">{item.caption}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {item.hashtags && item.hashtags.length > 0 && (
                            <span>{item.hashtags.length} hashtags</span>
                          )}
                          <span>Confidence: {Math.round(item.confidence_score * 100)}%</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No content yet. Generate your first post above!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
