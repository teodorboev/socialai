import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { resolveAction, getContentStatusFromAction, DEFAULT_THRESHOLDS } from "@/agents/shared/confidence";
import { z } from "zod";

const GenerateContentSchema = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "TWITTER", "LINKEDIN"]),
  socialAccountId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { platform, socialAccountId } = GenerateContentSchema.parse(body);

    // Get organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const orgId = orgMember.organization_id;

    // Get brand config
    const { data: brandConfig } = await supabase
      .from("brand_configs")
      .select("*")
      .eq("organization_id", orgId)
      .single();

    if (!brandConfig) {
      return NextResponse.json(
        { error: "Please configure your brand voice first" },
        { status: 400 }
      );
    }

    // Get recent top performing content for context
    const { data: topContent } = await supabase
      .from("content")
      .select("caption, confidence_score")
      .eq("organization_id", orgId)
      .eq("status", "PUBLISHED")
      .order("confidence_score", { ascending: false })
      .limit(3);

    // Get active content plan
    const { data: contentPlan } = await supabase
      .from("content_plans")
      .select("strategy")
      .eq("organization_id", orgId)
      .eq("status", "ACTIVE")
      .order("period_start", { ascending: false })
      .limit(1)
      .single();

    // Get social account
    let socialAccount = null;
    if (socialAccountId) {
      const { data } = await supabase
        .from("social_accounts")
        .select("id, platform")
        .eq("id", socialAccountId)
        .single();
      socialAccount = data;
    } else {
      const { data } = await supabase
        .from("social_accounts")
        .select("id, platform")
        .eq("organization_id", orgId)
        .eq("platform", platform)
        .eq("is_active", true)
        .limit(1)
        .single();
      socialAccount = data;
    }

    if (!socialAccount) {
      return NextResponse.json(
        { error: `No connected ${platform} account found` },
        { status: 400 }
      );
    }

    // Run the content creator agent
    const agent = new ContentCreatorAgent();
    const result = await agent.run(orgId, {
      organizationId: orgId,
      platform: socialAccount.platform,
      brandConfig: {
        brandName: brandConfig.brand_name,
        voiceTone: brandConfig.voice_tone as any,
        contentThemes: brandConfig.content_themes,
        doNots: brandConfig.do_nots,
        targetAudience: brandConfig.target_audience as any,
        hashtagStrategy: brandConfig.hashtag_strategy as any,
      },
      contentPlanContext: contentPlan?.strategy
        ? JSON.stringify(contentPlan.strategy)
        : undefined,
      previousTopPerformers: topContent?.map((c) => ({
        caption: c.caption,
        engagementRate: c.confidence_score * 100,
      })),
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.escalationReason || "Failed to generate content" },
        { status: 500 }
      );
    }

    const content = result.data as {
      contentType: string;
      caption: string;
      hashtags: string[];
      mediaPrompt?: string;
      altText?: string;
      reasoning: string;
    };
    const action = resolveAction(result.confidenceScore, DEFAULT_THRESHOLDS);
    const status = getContentStatusFromAction(action);

    // Save to database
    const { data: savedContent, error: saveError } = await supabase
      .from("content")
      .insert({
        organization_id: orgId,
        social_account_id: socialAccount.id,
        platform: socialAccount.platform,
        content_type: content.contentType,
        status,
        caption: content.caption,
        hashtags: content.hashtags,
        media_urls: content.mediaPrompt ? [] : [],
        alt_text: content.altText,
        confidence_score: result.confidenceScore,
        agent_notes: content.reasoning,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save content:", saveError);
      return NextResponse.json(
        { error: "Failed to save content" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      content: savedContent,
      confidenceScore: result.confidenceScore,
      action,
      needsReview: status === "PENDING_REVIEW",
    });
  } catch (error) {
    console.error("Generate content error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
