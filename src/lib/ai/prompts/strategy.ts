interface StrategyInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    industry: string;
    targetAudience: {
      demographics?: string;
      interests?: string;
      painPoints?: string;
    };
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    contentThemes: string[];
    competitors?: Array<{ name: string; platform: string; handle: string }>;
    brandColors?: { primary: string; secondary: string; accent: string };
    doNots: string[];
  };
  analyticsReport?: {
    summary: string;
    topContent: Array<{ contentId: string; whyItWorked: string }>;
    recommendations: Array<{ recommendation: string; priority: string; targetAgent: string }>;
    optimalPostingTimes: Record<string, string[]>;
  };
  previousPlan?: {
    themes: string[];
    platformMix: Record<string, number>;
    whatWorked: string;
    whatDidnt: string;
  };
  trendContext?: string;
  connectedPlatforms: string[];
  planPeriod: {
    start: string;
    end: string;
  };
  clientGoals?: string[];
}

export function buildStrategyPrompt(input: StrategyInput): string {
  const { brandConfig, analyticsReport, previousPlan, trendContext, connectedPlatforms, planPeriod, clientGoals } = input;

  return `You are an expert social media strategist for ${brandConfig.brandName}.

Your job is to create a comprehensive content strategy and monthly content calendar for the period ${planPeriod.start} to ${planPeriod.end}.

═══════════════════════════════════════
BRAND PROFILE
═══════════════════════════════════════
Brand Name: ${brandConfig.brandName}
Industry: ${brandConfig.industry}

Target Audience:
${brandConfig.targetAudience.demographics ? `- Demographics: ${brandConfig.targetAudience.demographics}` : ""}
${brandConfig.targetAudience.interests ? `- Interests: ${brandConfig.targetAudience.interests}` : ""}
${brandConfig.targetAudience.painPoints ? `- Pain Points: ${brandConfig.targetAudience.painPoints}` : ""}

Brand Voice:
- Tone: ${brandConfig.voiceTone.adjectives.join(", ")}
- Examples: ${brandConfig.voiceTone.examples.map((e) => `"${e}"`).join(", ")}
- Avoid: ${brandConfig.voiceTone.avoid.join(", ")}

Content Themes: ${brandConfig.contentThemes.join(", ")}

Do Not: ${brandConfig.doNots.join(", ")}

Connected Platforms: ${connectedPlatforms.join(", ")}

${brandConfig.competitors?.length ? `Competitors to Monitor:\n${brandConfig.competitors.map((c) => `- ${c.name} (@${c.handle}) on ${c.platform}`).join("\n")}` : ""}

${clientGoals?.length ? `Client Goals:\n${clientGoals.map((g) => `- ${g}`).join("\n")}` : ""}

═══════════════════════════════════════
PERFORMANCE CONTEXT
═══════════════════════════════════════
${analyticsReport ? `Latest Analytics Summary:
${analyticsReport.summary}

Top Performing Content:
${analyticsReport.topContent.map((c) => `- ${c.contentId}: ${c.whyItWorked}`).join("\n")}

Recommendations to Incorporate:
${analyticsReport.recommendations.map((r) => `- [${r.priority}] ${r.recommendation} (${r.targetAgent})`).join("\n")}

Optimal Posting Times:
${Object.entries(analyticsReport.optimalPostingTimes).map(([platform, times]) => `- ${platform}: ${times.join(", ")}`).join("\n")}` : "No analytics data available yet."}

${previousPlan ? `Previous Strategy Review:
What Worked: ${previousPlan.whatWorked}
What Didn't: ${previousPlan.whatDidnt}
Previous Themes: ${previousPlan.themes.join(", ")}
Previous Platform Mix: ${Object.entries(previousPlan.platformMix).map(([p, v]) => `${p}: ${v}%`).join(", ")}` : "This is the first strategy plan."}

${trendContext ? `Current Trends to Consider:
${trendContext}` : ""}

═══════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════
Create a complete strategy document that includes:
1. A compelling title and overview
2. 3-8 content themes with descriptions, platforms, frequency, and content types
3. Platform mix percentages (must sum to 100%)
4. Posts per week per platform
5. Content type distribution (POST, REEL, CAROUSEL, STORY, THREAD)
6. Weekly calendar with specific post suggestions
7. Key dates to leverage (holidays, events, awareness days)
8. KPIs with targets
9. Confidence score and reasoning

For the weekly calendar, create 4-5 weeks of content suggestions with:
- Day of week
- Platform
- Content type
- Theme alignment
- Topic suggestion
- Optimal time

Respond with a single JSON object. No markdown, no backticks.`;
}
