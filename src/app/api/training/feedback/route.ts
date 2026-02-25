import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitFeedback, submitPreference, bookmarkExemplar } from "@/lib/training/feedback";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const body = await request.json();
    const { type, ...data } = body;

    switch (type) {
      case "feedback": {
        const feedback = await submitFeedback({
          organizationId: orgMember.organization_id,
          userId: user.id,
          agentName: data.agentName,
          contentId: data.contentId,
          feedbackType: data.feedbackType,
          rating: data.rating,
          originalOutput: data.originalOutput,
          correctedOutput: data.correctedOutput,
          rejectionReason: data.rejectionReason,
          notes: data.notes,
        });
        return NextResponse.json({ success: true, feedback });
      }

      case "preference": {
        const preference = await submitPreference(
          orgMember.organization_id,
          user.id,
          data.rule,
          data.ruleType,
          data.agentName,
          data.platform
        );
        return NextResponse.json({ success: true, preference });
      }

      case "exemplar": {
        const exemplar = await bookmarkExemplar(
          orgMember.organization_id,
          user.id,
          data.agentName,
          data.content,
          data.platform,
          data.contentType,
          data.context
        );
        return NextResponse.json({ success: true, exemplar });
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Training API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
