import { OnboardingIntelligenceInput } from "../schemas/onboarding-intelligence";

export interface SurveyQuestion {
  question: string;
  purpose: string;
  exampleAnswer?: string;
  options?: string[];
}

export interface BrandAnalysisInput {
  posts: Array<{
    platform: string;
    caption: string;
    hashtags: string[];
    engagementRate: number;
    postedAt: string;
  }>;
  metrics: Record<string, {
    followers: number;
    avgEngagementRate: number;
    postFrequency: string;
  }>;
  competitors?: Array<{
    name: string;
    handle: string;
    platform: string;
  }>;
}

export interface StrategyGenerationInput {
  brandProfile: {
    tone: string[];
    vocabulary: string;
    emojiUsage: string;
    contentPillars: Array<{ pillar: string; frequency: string; performance: string }>;
  };
  performanceAudit: {
    overallHealth: string;
    platformBreakdown: Record<string, {
      followers: number;
      avgEngagementRate: number;
      bestContentType: string;
      bestPostingTimes: string[];
    }>;
    topPerformingPosts: Array<{
      caption: string;
      engagementRate: number;
      whyItWorked: string;
    }>;
  };
  audienceSnapshot: {
    primaryDemographic: string;
    peakActivityTimes: string[];
    interests: string[];
  };
  connectedPlatforms: string[];
}

export function formatSurveyQuestions(questions: SurveyQuestion[]): string {
  return questions
    .map((q, idx) => {
      let formatted = `${idx + 1}. ${q.question}\n   Purpose: ${q.purpose}`;
      if (q.exampleAnswer) {
        formatted += `\n   Example: "${q.exampleAnswer}"`;
      }
      if (q.options?.length) {
        formatted += `\n   Options: ${q.options.join(", ")}`;
      }
      return formatted;
    })
    .join("\n\n");
}

export function formatBrandAnalysisInput(data: BrandAnalysisInput): string {
  const platformSummaries = Object.entries(data.metrics)
    .map(([platform, metrics]) => {
      return `${platform}:
  - Followers: ${metrics.followers.toLocaleString()}
  - Avg Engagement: ${(metrics.avgEngagementRate * 100).toFixed(2)}%
  - Post Frequency: ${metrics.postFrequency}`;
    })
    .join("\n\n");

  const postExamples = data.posts
    .slice(0, 10)
    .map((post) => {
      const captionPreview =
        post.caption.length > 150
          ? post.caption.slice(0, 150) + "..."
          : post.caption;
      return `- [${post.platform}] ${captionPreview} (${(post.engagementRate * 100).toFixed(2)}% engagement)`;
    })
    .join("\n");

  return `Platform Metrics:
${platformSummaries}

Recent Top Posts:
${postExamples}`;
}

export function formatStrategyContext(input: StrategyGenerationInput): string {
  const platformMix = Object.entries(input.performanceAudit.platformBreakdown)
    .map(([platform, data]) => {
      return `- ${platform}: ${data.followers.toLocaleString()} followers, ${(data.avgEngagementRate * 100).toFixed(2)}% avg engagement, best at ${data.bestContentType}`;
    })
    .join("\n");

  const topPosts = input.performanceAudit.topPerformingPosts
    .slice(0, 3)
    .map((post, idx) => {
      return `${idx + 1}. ${post.whyItWorked}`;
    })
    .join("\n");

  return `Brand Voice:
- Tone: ${input.brandProfile.tone.join(", ")}
- Emoji Usage: ${input.brandProfile.emojiUsage}
- Vocabulary: ${input.brandProfile.vocabulary}

Content Pillars:
${input.brandProfile.contentPillars.map((p) => `- ${p.pillar}: ${p.frequency} (${p.performance} performance)`).join("\n")}

Platform Performance:
${platformMix}

Top Performing Posts Analysis:
${topPosts}

Audience:
- Primary: ${input.audienceSnapshot.primaryDemographic}
- Peak Times: ${input.audienceSnapshot.peakActivityTimes.join(", ")}
- Interests: ${input.audienceSnapshot.interests.join(", ")}

Connected Platforms: ${input.connectedPlatforms.join(", ")}`;
}

export function buildOnboardingPrompt(input: OnboardingIntelligenceInput): string {
  const {
    clientInfo,
    goals,
    budget,
    currentPainPoints,
    competitors,
    existingBrandAssets,
    teamInfo,
  } = input;

  const goalsSection = goals.length
    ? goals
        .map((g) => `- [${g.priority}] ${g.goal} (Metrics: ${g.metrics.join(", ")})`)
        .join("\n")
    : "No specific goals provided";

  const painPointsSection = currentPainPoints?.length
    ? currentPainPoints.map((p) => `- ${p}`).join("\n")
    : "No pain points identified";

  const competitorsSection = competitors?.length
    ? competitors.map((c) => `- ${c}`).join("\n")
    : "No competitors specified";

  const brandAssetsSection = existingBrandAssets
    ? `Brand Guidelines: ${existingBrandAssets.hasBrandGuidelines ? "Yes" : "No"}
Content Library: ${existingBrandAssets.hasContentLibrary ? "Yes" : "No"}
Hashtag Strategy: ${existingBrandAssets.hasHashtagStrategy ? "Yes" : "No"}`
    : "No brand assets provided";

  const teamSection = teamInfo
    ? `Social Manager: ${teamInfo.hasSocialManager ? "Yes" : "No"}
Content Creator: ${teamInfo.hasContentCreator ? "Yes" : "No"}
Designer: ${teamInfo.hasDesigner ? "Yes" : "No"}
Preferred Involvement: ${teamInfo.preferredInvolvement || "Not specified"}`
    : "No team info provided";

  const budgetSection = budget
    ? `Monthly Budget: $${budget.monthly || "Not specified"}`
    : "No budget information";

  return `You are an expert onboarding strategist for SocialAI, an AI-powered social media management platform.

Your role is to design a personalized onboarding experience for new clients based on their business profile, goals, and current social media presence.

═══════════════════════════════════════
CLIENT PROFILE
═══════════════════════════════════════
Company: ${clientInfo.companyName}
Industry: ${clientInfo.industry}
Company Size: ${clientInfo.companySize}
${clientInfo.website ? `Website: ${clientInfo.website}` : ""}

Existing Social Accounts:
${clientInfo.existingSocialAccounts?.length ? clientInfo.existingSocialAccounts.map((a) => `- ${a.platform}: @${a.handle} (${a.followers?.toLocaleString() || "?"} followers)`).join("\n") : "No accounts connected yet"}

═══════════════════════════════════════
GOALS & OBJECTIVES
═══════════════════════════════════════
${goalsSection}

═══════════════════════════════════════
CHALLENGES
═══════════════════════════════════════
${painPointsSection}

═══════════════════════════════════════
COMPETITORS
═══════════════════════════════════════
${competitorsSection}

═══════════════════════════════════════
BRAND ASSETS
═══════════════════════════════════════
${brandAssetsSection}

═══════════════════════════════════════
TEAM & RESOURCES
═══════════════════════════════════════
${teamSection}

═══════════════════════════════════════
BUDGET
═══════════════════════════════════════
${budgetSection}

═══════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════
Create a comprehensive onboarding plan that includes:

1. ONBOARDING STEPS
   - Ordered sequence of steps (QUESTIONNAIRE, ANALYSIS, CONFIGURATION, APPROVAL, EDUCATION)
   - Each step with title, description, estimated time, and whether it can be skipped
   - Form fields for questionnaire steps

2. BRAND VOICE SETUP
   - Required fields for brand voice configuration (with importance levels)
   - Recommended optional fields
   - Questions to ask the client about their brand voice and tone

3. CONTENT STRATEGY RECOMMENDATIONS
   - Recommended subscription tier with rationale
   - Platform priority (PRIMARY, SECONDARY, TERTIARY) with reasoning
   - Content type mix with percentages
   - Suggested initial campaigns
   - Timeline with weekly milestones

4. INTEGRATIONS
   - Required/recommended/optional integrations
   - Setup steps for each

5. TIMELINE
   - Total onboarding duration
   - Phases with milestones and deliverables
   - Target go-live date

6. CONFIDENCE SCORE
   - Rate your confidence (0-1) in this onboarding plan based on how much information was provided

Respond with a single JSON object. No markdown, no backticks.`;
}

export function buildBrandAnalysisPrompt(
  data: BrandAnalysisInput
): string {
  return `You are an expert brand analyst. Analyze the following social media data to detect the brand's voice, style, and performance patterns.

${formatBrandAnalysisInput(data)}

═══════════════════════════════════════
ANALYSIS REQUIREMENTS
═══════════════════════════════════════
Based on the data provided, identify:

1. BRAND VOICE
   - Tone (friendly, professional, casual, authoritative, etc.)
   - Vocabulary style (simple vs technical)
   - Emoji usage (heavy, moderate, minimal, none)
   - Hashtag style
   - Average caption length
   - Signature patterns (recurring phrases, sign-offs)

2. CONTENT PILLARS
   - Main content themes/categories
   - Frequency of each
   - Performance of each (strong, average, weak)

3. VISUAL STYLE
   - Dominant colors (if inferrable)
   - Image types used
   - Consistency level

4. PERFORMANCE HEALTH
   - Overall health assessment
   - Platform-by-platform breakdown
   - Best and worst performing content types
   - Best posting times per platform

5. COMPETITIVE POSITION
   - Detected competitors (from the data)
   - Client's position relative to them

6. AUDIENCE INSIGHTS
   - Primary demographic (if inferrable)
   - Peak activity times
   - Interests

Respond with JSON matching the OnboardingIntelligence schema structure.`;
}

export function buildStrategyGenerationPrompt(
  input: StrategyGenerationInput
): string {
  return `You are an expert social media strategist. Based on the brand analysis and performance data, generate a personalized first-month strategy for this client.

${formatStrategyContext(input)}

═══════════════════════════════════════
STRATEGY REQUIREMENTS
═══════════════════════════════════════
Create a first-month strategy that includes:

1. IMMEDIATE ACTIONS
   - Quick wins the client can start this week
   - High impact, low effort items first

2. CONTENT PLAN
   - Posts per week per platform
   - Content type distribution
   - Key themes to focus on

3. GOALS
   - Primary goal for the first month
   - Key performance indicators with targets

4. CONFIDENCE SETTINGS
   - Suggested auto-publish threshold (conservative for new clients)
   - Reasoning for the threshold

Respond with JSON matching the recommendations section of the OnboardingIntelligence schema.`;
}
