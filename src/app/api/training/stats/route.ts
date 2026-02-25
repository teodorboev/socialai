import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPreferences, getExemplars } from "@/lib/training/feedback";
import { getTrainingStats } from "@/lib/training/prompt-injection";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "stats") {
      const stats = await getTrainingStats(orgMember.organization_id);
      return NextResponse.json({ stats });
    }

    if (type === "preferences") {
      const preferences = await getPreferences(orgMember.organization_id);
      return NextResponse.json({ preferences });
    }

    if (type === "exemplars") {
      const exemplars = await getExemplars(orgMember.organization_id);
      return NextResponse.json({ exemplars });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Training API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
