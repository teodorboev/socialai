import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/organization/pause
 * Toggle the pause state of the organization.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { paused } = await request.json();

    if (typeof paused !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // First do the update (without select)
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        is_paused: paused,
        paused_at: paused ? new Date().toISOString() : null,
      })
      .eq("id", orgMember.organization_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ 
        error: "Failed to update", 
        details: updateError.message 
      }, { status: 500 });
    }

    // Then fetch to get the updated value
    const { data: organization, error: fetchError } = await supabase
      .from("organizations")
      .select("is_paused, paused_at")
      .eq("id", orgMember.organization_id)
      .single();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
    }

    return NextResponse.json({
      success: true,
      isPaused: organization?.is_paused ?? paused,
      pausedAt: organization?.paused_at,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organization/pause
 * Get the current pause state of the organization.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orgMember, error: orgError } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { data: organization, error: fetchError } = await supabase
      .from("organizations")
      .select("is_paused, paused_at")
      .eq("id", orgMember.organization_id)
      .single();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      isPaused: organization.is_paused ?? false,
      pausedAt: organization.paused_at,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
