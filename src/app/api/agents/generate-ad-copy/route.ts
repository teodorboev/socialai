import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdCopyAgent } from "@/agents/ad-copy";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { 
      organizationId, 
      platform, 
      objective,
      productDescription,
      tone,
      keyMessage 
    } = await request.json();

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
      .select("brand_name, voice_tone")
      .eq("organization_id", organizationId)
      .single();

    // Run ad copy agent
    const agent = new AdCopyAgent();
    const result = await agent.run(organizationId, {
      organizationId,
      platform,
      objective: objective || "awareness",
      productDescription,
      tone: tone || brandConfig?.voice_tone?.adjectives?.[0] || "professional",
      keyMessage,
      brandName: brandConfig?.brand_name || "Your Brand",
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ 
        error: result.escalationReason || "Failed to generate ad copy" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      adCopy: result.data,
      confidenceScore: result.confidenceScore,
    });

  } catch (error) {
    console.error("Generate ad copy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
