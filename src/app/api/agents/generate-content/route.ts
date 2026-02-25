import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContentCreatorAgent } from "@/agents/content-creator";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, platform, contentType } = await request.json();

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

    if (!brandConfig) {
      return NextResponse.json({ error: "Brand config not found" }, { status: 400 });
    }

    // Get social account
    const { data: socialAccount } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("platform", platform.toUpperCase())
      .eq("is_active", true)
      .single();

    if (!socialAccount) {
      return NextResponse.json({ error: "No active social account for this platform" }, { status: 400 });
    }

    // Run content creator agent
    const agent = new ContentCreatorAgent();
    const result = await agent.run(organizationId, {
      organizationId,
      platform: platform.toLowerCase(),
      brandConfig: {
        brandName: brandConfig.brand_name,
        voiceTone: brandConfig.voice_tone,
        contentThemes: brandConfig.content_themes,
        doNots: brandConfig.do_nots,
        targetAudience: brandConfig.target_audience,
        hashtagStrategy: brandConfig.hashtag_strategy,
      },
      manualTrigger: true,
      contentType,
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ 
        error: result.escalationReason || "Failed to generate content" 
      }, { status: 500 });
    }

    const content = result.data as any;

    // Save to database
    const { data: savedContent, error: saveError } = await supabase
      .from("content")
      .insert({
        organization_id: organizationId,
        social_account_id: socialAccount.id,
        platform: platform.toUpperCase(),
        content_type: content.contentType || "POST",
        status: result.confidenceScore >= 0.75 ? "APPROVED" : "PENDING_REVIEW",
        caption: content.caption,
        hashtags: content.hashtags,
        alt_text: content.altText,
        confidence_score: result.confidenceScore,
        agent_notes: content.reasoning,
      })
      .select()
      .single();

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      content: savedContent,
      confidenceScore: result.confidenceScore,
      needsReview: result.confidenceScore < 0.75,
    });

  } catch (error) {
    console.error("Generate content error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
