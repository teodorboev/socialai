import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RepurposeAgent } from "@/agents/repurpose";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { 
      organizationId, 
      contentId,
      targetPlatforms,
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

    // Get original content
    const { data: originalContent } = await supabase
      .from("content")
      .select("*")
      .eq("id", contentId)
      .single();

    if (!originalContent) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Get brand config
    const { data: brandConfig } = await supabase
      .from("brand_configs")
      .select("brand_name, voice_tone")
      .eq("organization_id", organizationId)
      .single();

    // Run repurpose agent
    const agent = new RepurposeAgent();
    const result = await agent.run(organizationId, {
      organizationId,
      originalContent: {
        caption: originalContent.caption,
        platform: originalContent.platform.toLowerCase(),
        hashtags: originalContent.hashtags,
      },
      targetPlatforms: targetPlatforms || ["instagram", "twitter", "linkedin"],
      brandName: brandConfig?.brand_name || "Your Brand",
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ 
        error: result.escalationReason || "Failed to repurpose content" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      repurposedContent: result.data,
      confidenceScore: result.confidenceScore,
    });

  } catch (error) {
    console.error("Repurpose content error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
