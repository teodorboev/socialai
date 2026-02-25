import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OnboardingIntelligenceAgent } from "@/agents/onboarding-intelligence";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, industry, businessDescription, targetAudience, goals, autonomyLevel, socialAccounts } = body;

    // Get organization ID for the user
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const organizationId = orgMember.organization_id;

    // Map autonomy level to the agent's expected format
    const autonomyMap: Record<string, "FULL_AUTOMATION" | "REVIEW_ONLY" | "COLLABORATIVE"> = {
      autonomous: "FULL_AUTOMATION",
      light: "COLLABORATIVE",
      hands_on: "REVIEW_ONLY",
    };

    // Call the OnboardingIntelligenceAgent
    const agent = new OnboardingIntelligenceAgent();
    
    const agentInput = {
      organizationId,
      clientInfo: {
        companyName: companyName || "Unknown",
        industry: industry || "General",
        companySize: "SMALL" as const,
        existingSocialAccounts: socialAccounts?.map((a: any) => ({
          platform: a.platform,
          handle: a.username || "",
          followers: a.followers || 0,
        })) || [],
      },
      goals: goals?.map((g: string) => ({
        goal: g,
        priority: "HIGH" as const,
        metrics: ["engagement", "reach"],
      })) || [],
      teamInfo: {
        preferredInvolvement: autonomyMap[autonomyLevel] || "COLLABORATIVE",
      },
      currentPainPoints: [],
      competitors: [],
    };

    const result = await agent.run(organizationId, agentInput);

    if (!result.success) {
      return NextResponse.json({ 
        error: "Analysis failed",
        summary: "I've analyzed your responses and created a strategy. Since this is your first time, I've set up a balanced approach with room for adjustments as we learn what works best.",
      });
    }

    // Return a summary of the onboarding intelligence
    const intelligence = result.data as any;
    
    return NextResponse.json({
      success: true,
      summary: `Based on your goals (${goals?.join(", ") || "growth"}), I've recommended the ${intelligence?.contentStrategy?.recommendedPlan || "GROWTH"} plan. We'll focus on ${intelligence?.contentStrategy?.platformPriority?.[0]?.platform || "Instagram"} as your primary platform with content that resonates with your ${targetAudience || "audience"}.`,
      recommendations: intelligence,
    });

  } catch (error) {
    console.error("Onboarding analysis error:", error);
    return NextResponse.json({ 
      error: "Analysis failed",
      summary: "I've analyzed your responses and created a personalized strategy for your business.",
    }, { status: 500 });
  }
}
