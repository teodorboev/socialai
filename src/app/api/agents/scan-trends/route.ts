import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TrendScoutAgent } from "@/agents/trend-scout";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await request.json();

    // Verify user has access to this organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get brand config for context
    const { data: brandConfig } = await supabase
      .from("brand_configs")
      .select("industry, target_audience, content_themes")
      .eq("organization_id", organizationId)
      .single();

    // Get social accounts for platform context
    const { data: socialAccounts } = await supabase
      .from("social_accounts")
      .select("platform")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    // Run trend scout agent
    const agent = new TrendScoutAgent();
    const result = await agent.run(organizationId, {
      organizationId,
      platforms: socialAccounts?.map(a => a.platform.toLowerCase()) || ["instagram"],
      industry: brandConfig?.industry || "general",
      targetAudience: brandConfig?.target_audience,
      contentThemes: brandConfig?.content_themes || [],
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: result.escalationReason || "Failed to scan trends" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trends: result.data,
      confidenceScore: result.confidenceScore,
    });

  } catch (error) {
    console.error("Scan trends error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
