"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, AlertCircle, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ContentItem {
  id: string;
  caption: string;
  hashtags: string[];
  platform: string;
  content_type: string;
  confidence_score: number;
  agent_notes: string;
  created_at: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!orgMember) {
        router.push("/onboarding");
        return;
      }

      const { data } = await supabase
        .from("content")
        .select("*")
        .eq("organization_id", orgMember.organization_id)
        .eq("status", "PENDING_REVIEW")
        .order("created_at", { ascending: false });

      setContent(data || []);
      setLoading(false);
    }

    loadContent();
  }, [supabase, router]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    const { error } = await supabase
      .from("content")
      .update({ status: "APPROVED" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to approve content");
    } else {
      toast.success("Content approved!");
      setContent(content.filter((c) => c.id !== id));
    }
    setProcessing(null);
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(id);
    const { error } = await supabase
      .from("content")
      .update({ status: "REJECTED", rejection_reason: rejectionReason })
      .eq("id", id);

    if (error) {
      toast.error("Failed to reject content");
    } else {
      toast.success("Content rejected");
      setContent(content.filter((c) => c.id !== id));
    }
    setRejectionReason("");
    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">
          Review AI-generated content before publishing
        </p>
      </div>

      {content.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No content pending review. Generate more content to see it here.
            </p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/content")}>
              Go to Content
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {content.length} item{content.length !== 1 ? "s" : ""} pending review
          </p>
          {content.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.platform}</Badge>
                    <Badge variant="secondary">{item.content_type}</Badge>
                    <Badge variant="outline" className="bg-yellow-50">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {Math.round(item.confidence_score * 100)}% confidence
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Caption</h4>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="whitespace-pre-wrap">{item.caption}</p>
                  </div>
                </div>

                {item.hashtags && item.hashtags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Hashtags</h4>
                    <div className="flex flex-wrap gap-2">
                      {item.hashtags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {item.agent_notes && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Notes
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {item.agent_notes}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">Rejection Reason (optional)</h4>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e: any) => setRejectionReason(e.target.value)}
                    placeholder="Why are you rejecting this content? (helps the AI improve)"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleReject(item.id)}
                    disabled={processing === item.id}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleApprove(item.id)}
                    disabled={processing === item.id}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
