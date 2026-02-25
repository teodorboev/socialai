import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AudienceIntelligenceAgent } from "@/agents/audience-intelligence";

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

    // Get brand config
    const { data: brandConfig } = await supabase
      .from("brand_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    // Get social accounts
    const { data: socialAccounts } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    // Get analytics data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analyticsSnapshots } = await supabase
      .from("analytics_snapshots")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0]);

    // Run audience intelligence agent
    const agent = new AudienceIntelligenceAgent();
    const result = await agent.run(organizationId, {
      organizationId,
      platform: socialAccounts?.[0]?.platform || "INSTAGRAM",
      brandConfig: brandConfig ? {
        brandName: brandConfig.brand_name,
        targetAudience: brandConfig.target_audience,
      } : undefined,
      analyticsData: analyticsSnapshots || [],
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: result.escalationReason || "Failed to analyze audience" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      confidenceScore: result.confidenceScore,
    });

  } catch (error) {
    console.error("Analyze audience error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
