import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const ScheduleSchema = z.object({
  scheduledFor: z.string().datetime(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scheduledFor } = ScheduleSchema.parse(body);

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    // Get the content
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("*, social_accounts(*)")
      .eq("id", id)
      .eq("organization_id", orgMember.organization_id)
      .single();

    if (contentError || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (content.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved content can be scheduled" },
        { status: 400 }
      );
    }

    if (!content.social_accounts) {
      return NextResponse.json(
        { error: "No social account linked to this content" },
        { status: 400 }
      );
    }

    // Create schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .insert({
        organization_id: orgMember.organization_id,
        content_id: content.id,
        social_account_id: content.social_accounts.id,
        scheduled_for: scheduledFor,
        status: "PENDING",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scheduleError) {
      console.error("Schedule error:", scheduleError);
      return NextResponse.json(
        { error: scheduleError.message },
        { status: 500 }
      );
    }

    // Update content status
    await supabase
      .from("content")
      .update({ status: "SCHEDULED" })
      .eq("id", content.id);

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Schedule API error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
