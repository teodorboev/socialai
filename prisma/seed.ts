import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  try {
    const url = new URL(connectionString);
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("pool_timeout");
    connectionString = url.toString();
  } catch (e) { }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

const prisma = createPrismaClient();

async function main() {
  console.log("Seeding database...");

  // ============================================================
  // PLATFORM CONFIGS
  // ============================================================
  const platformConfigs = [
    {
      platform: "INSTAGRAM" as any,
      displayName: "Instagram",
      maxCaptionLength: 2200,
      maxHashtags: 30,
      supportedContentTypes: ["POST", "STORY", "REEL", "CAROUSEL"],
      imageSpecs: { feed: { width: 1080, height: 1080 } },
      rateLimit: { postsPerDay: 25 },
      retryConfig: { maxRetries: 3 },
      oauthScopes: ["instagram_basic"],
      guidelines: "Use casual, authentic tone.",
    },
    {
      platform: "FACEBOOK" as any,
      displayName: "Facebook",
      maxCaptionLength: 63206,
      maxHashtags: 30,
      supportedContentTypes: ["POST", "STORY", "VIDEO"],
      imageSpecs: { post: { width: 1200, height: 630 } },
      rateLimit: { postsPerDay: 25 },
      retryConfig: { maxRetries: 3 },
      oauthScopes: ["pages_manage_posts"],
      guidelines: "Professional tone for announcements.",
    },
    {
      platform: "TIKTOK" as any,
      displayName: "TikTok",
      maxCaptionLength: 2200,
      maxHashtags: 100,
      supportedContentTypes: ["VIDEO"],
      imageSpecs: { video: { width: 1080, height: 1920 } },
      rateLimit: { postsPerDay: 20 },
      retryConfig: { maxRetries: 3 },
      oauthScopes: ["user.info.basic"],
      guidelines: "Trendy, authentic, Gen Z tone.",
    },
    {
      platform: "TWITTER" as any,
      displayName: "X (Twitter)",
      maxCaptionLength: 280,
      maxHashtags: 10,
      supportedContentTypes: ["POST", "THREAD"],
      imageSpecs: { image: { width: 1200, height: 675 } },
      rateLimit: { postsPerDay: 50 },
      retryConfig: { maxRetries: 3 },
      oauthScopes: ["tweet.read"],
      guidelines: "Concise, witty, conversational.",
    },
    {
      platform: "LINKEDIN" as any,
      displayName: "LinkedIn",
      maxCaptionLength: 3000,
      maxHashtags: 5,
      supportedContentTypes: ["POST", "ARTICLE"],
      imageSpecs: { post: { width: 1200, height: 627 } },
      rateLimit: { postsPerDay: 20 },
      retryConfig: { maxRetries: 3 },
      oauthScopes: ["r_liteprofile"],
      guidelines: "Professional, thought leadership tone.",
    },
  ];

  for (const config of platformConfigs) {
    await prisma.platformConfig.upsert({
      where: { platform: config.platform },
      update: config,
      create: config,
    });
  }
  console.log("✓ Platform configs seeded");

  // ============================================================
  // PROMPT TEMPLATES
  // ============================================================
  // Note: Some AgentName values may not exist in the database yet
  // Only seed the ones that are guaranteed to work
  const promptTemplates = [
    {
      agentName: "CONTENT_CREATOR" as any,
      name: "main",
      description: "Main content generation prompt",
      body: `You are an expert social media content creator for {{brandName}}.

BRAND VOICE:
- Adjectives: {{voiceAdjectives}}
- Examples: {{voiceExamples}}
- Avoid: {{voiceAvoid}}

TARGET AUDIENCE:
- Demographics: {{targetDemographics}}
- Interests: {{targetInterests}}
- Pain Points: {{targetPainPoints}}

CONTENT THEMES: {{contentThemes}}

THINGS TO NEVER DO OR SAY:
{{doNots}}

HASHTAG STRATEGY:
- Always use: {{hashtagAlways}}
- Never use: {{hashtagNever}}
- Rotate through: {{hashtagRotating}}

PLATFORM: {{platform}}

INSTRUCTIONS:
Create engaging content that matches the brand voice.`,
      variables: ["brandName", "voiceAdjectives", "voiceExamples", "voiceAvoid", "targetDemographics", "targetInterests", "targetPainPoints", "contentThemes", "doNots", "hashtagAlways", "hashtagNever", "hashtagRotating", "platform"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "ENGAGEMENT" as any,
      name: "main",
      description: "Main engagement/response prompt",
      body: `You are the social media community manager for {{brandName}}.

BRAND VOICE:
- Adjectives: {{voiceAdjectives}}
- Examples: {{voiceExamples}}
- Avoid: {{voiceAvoid}}

FAQ KNOWLEDGE BASE:
{{faqKnowledge}}

THINGS TO NEVER DO OR SAY:
{{doNots}}

Respond authentically to comments and messages.`,
      variables: ["brandName", "voiceAdjectives", "voiceExamples", "voiceAvoid", "faqKnowledge", "doNots"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "ANALYTICS" as any,
      name: "main",
      description: "Main analytics reporting prompt",
      body: `You are a social media analytics expert for {{brandName}}.

Analyze the provided data and provide insights.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "STRATEGY" as any,
      name: "main",
      description: "Main content strategy planning prompt",
      body: `You are an expert social media strategist for {{brandName}}.

BRAND PROFILE:
- Brand Name: {{brandName}}
- Industry: {{industry}}
- Target Audience: {{targetAudience}}
- Voice & Tone: {{voiceTone}}
- Content Themes: {{contentThemes}}
- Competitors: {{competitors}}
- Brand Colors: {{brandColors}}
- Do Nots: {{doNots}}

CONNECTED PLATFORMS: {{connectedPlatforms}}
PLAN PERIOD: {{planPeriod}}
CLIENT GOALS: {{clientGoals}}

{{analyticsReport}}

{{previousPlan}}

{{trendContext}}

Create a comprehensive monthly content strategy including:
1. Content themes and pillars
2. Platform-specific strategies
3. Posting frequency and timing
4. Content mix (educational, promotional, engagement)
5. Success metrics and KPIs

Respond with a detailed strategy document.`,
      variables: ["brandName", "industry", "targetAudience", "voiceTone", "contentThemes", "competitors", "brandColors", "doNots", "analyticsReport", "previousPlan", "trendContext", "connectedPlatforms", "planPeriod", "clientGoals"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "TREND_SCOUT" as any,
      name: "main",
      description: "Main trend detection prompt",
      body: `You are a trend analyst for {{brandName}} in the {{industry}} industry.

Your job is to identify trending topics, viral moments, and content opportunities that are relevant to this brand. Consider:

1. Current social media trends on: {{connectedPlatforms}}
2. Industry-specific news and developments
3. Seasonal events and holidays
4. Relevant hashtags and memes
5. Competitor activity: {{competitors}}
6. Content themes: {{contentThemes}}

For each trend identified, assess:
- Relevance to the brand (0-1)
- Category: viral, seasonal, industry, meme, news, hashtag
- Sentiment: positive, neutral, negative
- Which platforms it's relevant on
- Content opportunities (what kind of posts could capitalize on this trend)
- Urgency: high (act today), medium (this week), low (this month)

Be specific and actionable. Focus on trends that would genuinely fit the brand, not just what's popular.

Respond with a single JSON object. No markdown, no backticks.`,
      variables: ["brandName", "industry", "contentThemes", "competitors", "connectedPlatforms"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "AD_COPY" as any,
      name: "main",
      description: "Main ad copy generation prompt",
      body: `You are an expert ad copywriter for {{brandName}}.

Create compelling ad copy that drives conversions while matching the brand voice.

BRAND: {{brandName}}
INDUSTRY: {{industry}}
TARGET AUDIENCE: {{targetAudience}}

Generate ad variations with headlines, body text, and CTAs.`,
      variables: ["brandName", "industry", "targetAudience"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "HASHTAG_OPTIMIZER" as any,
      name: "main",
      description: "Main hashtag optimization prompt",
      body: `You are a hashtag strategy expert for {{brandName}}.

Analyze and recommend optimal hashtags for maximum reach and engagement.

PLATFORM: {{platform}}
CONTENT TOPIC: {{contentTopic}}

Provide a mix of discovery, niche, and branded hashtags.`,
      variables: ["brandName", "platform", "contentTopic"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "CAPTION_REWRITER" as any,
      name: "main",
      description: "Main caption rewriting prompt",
      body: `You are a caption optimization expert for {{brandName}}.

Rewrite underperforming captions with improved hooks and engagement.

ORIGINAL CAPTION: {{originalCaption}}
PERFORMANCE DATA: {{performanceData}}

Create a new version that addresses the weaknesses.`,
      variables: ["brandName", "originalCaption", "performanceData"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "AUDIENCE_INTELLIGENCE" as any,
      name: "main",
      description: "Main audience analysis prompt",
      body: `You are an audience intelligence expert for {{brandName}}.

Analyze follower data and engagement patterns to build detailed personas.

Analyze demographics, interests, behaviors, and optimal posting times.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "COMPETITOR_INTELLIGENCE" as any,
      name: "main",
      description: "Main competitor analysis prompt",
      body: `You are a competitive intelligence expert for {{brandName}}.

Analyze competitor social media accounts to identify opportunities.

COMPETITORS: {{competitors}}

Track their posting frequency, content types, and engagement strategies.`,
      variables: ["brandName", "competitors"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "COMPLIANCE" as any,
      name: "main",
      description: "Main compliance checking prompt",
      body: `You are a compliance and safety reviewer for {{brandName}}.

Review content for regulatory compliance, brand safety, and policy violations.

Check for FTC disclosures, prohibited claims, and inappropriate content.

Provide clear approval/rejection with specific issues identified.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "CRISIS_RESPONSE" as any,
      name: "main",
      description: "Main crisis detection and response prompt",
      body: `You are a crisis management expert for {{brandName}}.

Monitor for crisis signals and draft appropriate holding statements.

Escalate critical issues immediately. Provide calm, professional responses
that protect brand reputation while addressing concerns.

Never dismiss complaints or get defensive.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "LOCALIZATION" as any,
      name: "main",
      description: "Main content localization prompt",
      body: `You are a cultural localization expert for {{brandName}}.

Adapt content for different regional markets beyond simple translation.

Consider cultural nuances, holidays, idioms, and local trends.
Maintain brand voice while making content feel native to each market.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "REPURPOSE" as any,
      name: "main",
      description: "Main content repurposing prompt",
      body: `You are a content repurposing specialist for {{brandName}}.

Transform one piece of content into multiple platform-optimized formats.

Maintain core message while adapting tone, length, and format for each platform.
Maximize content value across all channels.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "SOCIAL_SEO" as any,
      name: "main",
      description: "Main social SEO optimization prompt",
      body: `You are a social media SEO expert for {{brandName}}.

Optimize content for discoverability on social platforms.

Research trending keywords, optimize captions and bios, suggest hashtags
that improve search visibility while maintaining authenticity.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "SENTIMENT_INTELLIGENCE" as any,
      name: "main",
      description: "Main sentiment analysis prompt",
      body: `You are a sentiment analysis expert for {{brandName}}.

Analyze brand mentions and conversations to understand perception.

Detect sentiment shifts, emerging issues, and opportunities.
Provide actionable insights for reputation management.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "INFLUENCER_SCOUT" as any,
      name: "main",
      description: "Main influencer evaluation prompt",
      body: `You are an influencer marketing specialist for {{brandName}}.

Evaluate potential influencer partners based on authenticity, relevance,
audience quality, and brand alignment.

Always escalate to human - never auto-contact influencers.
Provide detailed scoring and red flag analysis.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "AB_TESTING" as any,
      name: "main",
      description: "Main A/B testing prompt",
      body: `You are an A/B testing expert for {{brandName}}.

Design rigorous experiments to optimize content performance.

Test one variable at a time with proper statistical methodology.
Provide experiment designs and result analysis with confidence scores.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "ONBOARDING_INTELLIGENCE" as any,
      name: "main",
      description: "Main onboarding planning prompt",
      body: `You are a client onboarding expert for {{brandName}}.

Create personalized onboarding experiences for new clients.

Assess their needs, goals, and resources to design optimal setup plans.
Recommend platform priorities and content strategies based on their profile.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "BRAND_VOICE_GUARDIAN" as any,
      name: "main",
      description: "Main brand voice checking prompt",
      body: `You are the brand voice guardian for {{brandName}}.

Analyze every piece of content against established brand guidelines.

Score tone alignment, vocabulary consistency, and personality match.
Catch voice drift over time and flag inconsistencies.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "CALENDAR_OPTIMIZER" as any,
      name: "main",
      description: "Main calendar optimization prompt",
      body: `You are a content calendar optimization expert for {{brandName}}.

Reorder and optimize content calendars for maximum impact.

Balance content types, avoid topic clustering, space promotional content,
and align with audience activity patterns from analytics.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "COMMUNITY_BUILDER" as any,
      name: "main",
      description: "Main community management prompt",
      body: `You are a community building expert for {{brandName}}.

Identify super fans and engaged community members.

Suggest community initiatives like challenges, AMAs, and exclusive content.
Track community health metrics and engagement patterns.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },

    {
      agentName: "REPORTING_NARRATOR" as any,
      name: "main",
      description: "Main report narration prompt",
      body: `You are a data storytelling expert for {{brandName}}.

Transform analytics data into compelling narrative reports.

Create cohesive stories that stakeholders can understand and act upon.
Highlight wins, address concerns, and provide actionable recommendations.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "REVIEW_RESPONSE" as any,
      name: "main",
      description: "Main review response prompt",
      body: `You are a review management expert for {{brandName}}.

Craft professional responses to customer reviews on Google, Yelp, etc.

Match tone to brand voice and business policies.
Escalate serious complaints while addressing concerns empathetically.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "ROI_ATTRIBUTION" as any,
      name: "main",
      description: "Main ROI attribution prompt",
      body: `You are a revenue attribution expert for {{brandName}}.

Connect social media activity to business outcomes and revenue.

Track customer journeys, attribute conversions, and calculate true ROI.
Provide insights on which content drives actual business results.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "UGC_CURATOR" as any,
      name: "main",
      description: "Main UGC curation prompt",
      body: `You are a user-generated content curator for {{brandName}}.

Review UGC submissions, approve quality content, and organize into campaigns.

Check submissions against brand guidelines and values.
Create suggested captions and organize approved content effectively.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "SOCIAL_LISTENING" as any,
      name: "main",
      description: "Main social listening prompt",
      body: `You are a social listening expert for {{brandName}}.

Monitor mentions, keywords, and conversations across social platforms.

Detect sentiment shifts, reputation risks, and engagement opportunities.
Alert on critical issues and provide trend insights.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "MEDIA_PITCH" as any,
      name: "main",
      description: "Main media pitching prompt",
      body: `You are a PR and media relations expert for {{brandName}}.

Identify earned media opportunities from social traction.

Draft personalized pitches to journalists when content gains momentum.
Bridge social media success with traditional PR coverage.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "CHURN_PREDICTION" as any,
      name: "main",
      description: "Main churn prediction prompt",
      body: `You are a client retention expert for {{brandName}}.

Monitor engagement patterns and predict churn risk before cancellation.

Analyze platform usage, content performance trends, and behavioral signals.
Trigger retention actions: win-back emails, strategy refreshes, alerts.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "PRICING_INTELLIGENCE" as any,
      name: "main",
      description: "Main pricing intelligence prompt",
      body: `You are a competitive pricing analyst for {{brandName}}.

Monitor competitor pricing on social platforms.

Track promotional patterns and suggest optimal timing for promotional content.
Recommend counter-positioning strategies against competitor sales.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "PREDICTIVE_CONTENT" as any,
      name: "main",
      description: "Main predictive content prompt",
      body: `You are a predictive analytics expert for {{brandName}}.

Score content drafts on predicted engagement, reach, and virality.

Recommend modifications to improve performance predictions.
Turn content creation from guesswork into data science.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "COMPETITIVE_AD_INTELLIGENCE" as any,
      name: "main",
      description: "Main competitive ad monitoring prompt",
      body: `You are a competitive advertising analyst for {{brandName}}.

Monitor competitors' paid ads across Meta, TikTok, LinkedIn Ad Libraries.

Track active ads, estimated spend, creative formats, and messaging angles.
Identify campaign launches and suggest counter-positioning strategies.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "CROSS_CHANNEL_ATTRIBUTION" as any,
      name: "main",
      description: "Main cross-channel attribution prompt",
      body: `You are a marketing attribution expert for {{brandName}}.

Map the customer journey across social touchpoints.

Track follower → visitor → subscriber → customer path.
Identify which platform/content drives each funnel stage.
Provide multi-touch attribution modeling.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
  ];

  for (const template of promptTemplates) {
    await prisma.promptTemplate.upsert({
      where: {
        agentName_name_version: {
          agentName: template.agentName,
          name: template.name,
          version: template.version,
        },
      },
      update: template,
      create: template,
    });
  }
  console.log("✓ Prompt templates seeded");

  // ============================================================
  // FEATURE FLAGS - Agents
  // ============================================================
  const agentFeatureFlags = [
    // Core agents (available to all plans)
    { key: "agent_content_creator", name: "Content Creator", description: "AI-powered content generation", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_engagement", name: "Engagement Agent", description: "Auto-respond to comments and DMs", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_publisher", name: "Publisher", description: "Publish content to social platforms", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_analytics", name: "Analytics Agent", description: "Performance analytics and reporting", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_strategy", name: "Strategy Agent", description: "Content strategy and planning", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_trend_scout", name: "Trend Scout", description: "Detect trending topics", isEnabled: false, planMinimum: "PRO" as any, category: "intelligence" },
    { key: "agent_compliance", name: "Compliance Agent", description: "Content safety and compliance", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_content_replenishment", name: "Content Replenishment", description: "Monitor content pipeline", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_calendar_optimizer", name: "Calendar Optimizer", description: "Optimize posting schedule", isEnabled: true, planMinimum: null as any, category: "core" },
    { key: "agent_hashtag_optimizer", name: "Hashtag Optimizer", description: "Optimize hashtag strategy", isEnabled: true, planMinimum: null as any, category: "core" },

    // Intelligence agents (Growth+)
    { key: "agent_competitor_intelligence", name: "Competitor Intelligence", description: "Monitor competitors", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },
    { key: "agent_social_listening", name: "Social Listening", description: "Monitor brand mentions", isEnabled: false, planMinimum: "PRO" as any, category: "intelligence" },
    { key: "agent_audience_intelligence", name: "Audience Intelligence", description: "Audience insights", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },
    { key: "agent_influencer_scout", name: "Influencer Scout", description: "Find influencers", isEnabled: false, planMinimum: "PRO" as any, category: "intelligence" },
    { key: "agent_social_seo", name: "Social SEO", description: "Social search optimization", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },
    { key: "agent_caption_rewriter", name: "Caption Rewriter", description: "Rewrite underperforming content", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },
    { key: "agent_brand_voice_guardian", name: "Brand Voice Guardian", description: "Maintain brand consistency", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },
    { key: "agent_reporting_narrator", name: "Reporting Narrator", description: "AI-powered reports", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },

    // Premium agents (Pro+)
    { key: "agent_creative_director", name: "Creative Director", description: "Generate visual content", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_predictive_content", name: "Predictive Content", description: "Predict content performance", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_roi_attribution", name: "ROI Attribution", description: "Track revenue attribution", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_cross_channel_attribution", name: "Cross-Channel Attribution", description: "Multi-touch attribution", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_ad_copy", name: "Ad Copy", description: "Generate paid ad copy", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_sentiment_intelligence", name: "Sentiment Intelligence", description: "Deep sentiment analysis", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_competitive_ad_intelligence", name: "Competitive Ad Intelligence", description: "Monitor competitor ads", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_pricing_intelligence", name: "Pricing Intelligence", description: "Competitive pricing analysis", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_community_builder", name: "Community Builder", description: "Build brand community", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_media_pitch", name: "Media Pitch", description: "PR and media outreach", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_ugc_curator", name: "UGC Curator", description: "User-generated content", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_review_response", name: "Review Response", description: "Respond to reviews", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_repurpose", name: "Repurpose", description: "Repurpose content across platforms", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_localization", name: "Localization", description: "Multi-language content", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_churn_prediction", name: "Churn Prediction", description: "Predict client churn", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_onboarding_intelligence", name: "Onboarding Intelligence", description: "Client onboarding", isEnabled: false, planMinimum: "PRO" as any, category: "premium" },
    { key: "agent_ab_testing", name: "A/B Testing", description: "Content A/B testing", isEnabled: false, planMinimum: "GROWTH" as any, category: "intelligence" },
  ];

  for (const flag of agentFeatureFlags) {
    const { category, ...flagData } = flag;
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flagData,
      create: flagData,
    });
  }
  console.log("✓ Agent feature flags seeded (" + agentFeatureFlags.length + " agents)");

  // ============================================================
  // FEATURE FLAGS - System Features (non-agents)
  // ============================================================
  const systemFeatureFlags = [
    {
      key: "auto_engagement",
      name: "Auto Engagement",
      description: "Automatically respond to comments and DMs using AI",
      isEnabled: false,
      planMinimum: null as any,
    },
    {
      key: "ab_testing",
      name: "A/B Testing",
      description: "Enable A/B testing for content variants",
      isEnabled: false,
      planMinimum: "GROWTH" as any,
    },
    {
      key: "trend_scout",
      name: "Trend Scout",
      description: "Automatically detect and suggest trending topics",
      isEnabled: false,
      planMinimum: "PRO" as any,
    },
    {
      key: "competitor_monitoring",
      name: "Competitor Monitoring",
      description: "Monitor competitor social media activity",
      isEnabled: false,
      planMinimum: "PRO",
    },
    {
      key: "influencer_discovery",
      name: "Influencer Discovery",
      description: "AI-powered influencer discovery and outreach",
      isEnabled: false,
      planMinimum: "ENTERPRISE",
    },
    {
      key: "multi_language",
      name: "Multi-Language Content",
      description: "Create and publish content in multiple languages",
      isEnabled: false,
      planMinimum: "ENTERPRISE",
    },
    {
      key: "white_label",
      name: "White Label",
      description: "White label the platform for agencies",
      isEnabled: false,
      planMinimum: "WHITE_LABEL",
    },
    {
      key: "custom_prompts",
      name: "Custom Prompts",
      description: "Allow custom prompt templates per organization",
      isEnabled: false,
      planMinimum: "PRO",
    },
    {
      key: "advanced_analytics",
      name: "Advanced Analytics",
      description: "AI-powered insights and predictive analytics",
      isEnabled: false,
      planMinimum: "GROWTH",
    },
    {
      key: "social_listening",
      name: "Social Listening",
      description: "Monitor brand mentions and sentiment",
      isEnabled: false,
      planMinimum: "PRO",
    },
  ];

  for (const flag of systemFeatureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flag,
      create: flag,
    });
  }
  console.log("✓ System feature flags seeded");

  // ============================================================
  // SAFETY CONFIGS
  // ============================================================
  const safetyConfigs = [
    {
      category: "blocked_words",
      values: [
        "spam",
        "scam",
        "fraud",
        "illegal",
        "pirated",
        "counterfeit",
      ],
      action: "block_publish",
      isEnabled: true,
    },
    {
      category: "crisis_keywords",
      values: [
        "lawsuit",
        "bankruptcy",
        "data breach",
        "security incident",
        "layoff",
        "recall",
      ],
      action: "escalate_critical",
      isEnabled: true,
    },
    {
      category: "competitor_names",
      values: [], // Populated by organizations
      action: "flag_for_review",
      isEnabled: true,
    },
    {
      category: "spam_patterns",
      values: [
        "click here",
        "buy now",
        "limited time",
        "act now",
        "free money",
      ],
      action: "flag_for_review",
      isEnabled: true,
    },
    {
      category: "sensitive_topics",
      values: [
        "politics",
        "religion",
        "race",
        "gender",
        "sexual orientation",
      ],
      action: "flag_for_review",
      isEnabled: true,
    },
  ];

  for (const config of safetyConfigs) {
    await prisma.safetyConfig.upsert({
      where: { category: config.category },
      update: config,
      create: config,
    });
  }
  console.log("✓ Safety configs seeded");

  // ============================================================
  // EMAIL TEMPLATES
  // ============================================================
  const emailTemplates = [
    {
      slug: "welcome_email",
      subject: "Welcome to SocialAI!",
      body: `<h1>Welcome to SocialAI!</h1>
<p>Hi {{name}},</p>
<p>We're excited to have you on board. SocialAI helps you automate your social media marketing with AI-powered content creation and engagement.</p>
<p><strong>Getting started:</strong></p>
<ol>
<li>Connect your social accounts</li>
<li>Set up your brand voice</li>
<li>Let AI start creating content for you</li>
</ol>
<p><a href="{{dashboardUrl}}">Go to Dashboard</a></p>
<p>Best,<br>The SocialAI Team</p>`,
      variables: ["name", "dashboardUrl"],
      isActive: true,
    },
    {
      slug: "weekly_report",
      subject: "Your Weekly Social Media Report",
      body: `<h1>Weekly Report</h1>
<p>Hi {{name}},</p>
<p>Here's your weekly social media performance summary:</p>
<ul>
<li><strong>Total Posts:</strong> {{totalPosts}}</li>
<li><strong>Total Engagements:</strong> {{totalEngagements}}</li>
<li><strong>Follower Growth:</strong> {{followerGrowth}}</li>
<li><strong>Top Performer:</strong> {{topPost}}</li>
</ul>
<p><a href="{{reportUrl}}">View Full Report</a></p>
<p>Best,<br>The SocialAI Team</p>`,
      variables: ["name", "totalPosts", "totalEngagements", "followerGrowth", "topPost", "reportUrl"],
      isActive: true,
    },
    {
      slug: "escalation_alert",
      subject: "⚠️ Action Required: {{escalationType}}",
      body: `<h1>Escalation Alert</h1>
<p>Hi {{name}},</p>
<p>An item requires your attention:</p>
<ul>
<li><strong>Type:</strong> {{escalationType}}</li>
<li><strong>Priority:</strong> {{priority}}</li>
<li><strong>Details:</strong> {{details}}</li>
</ul>
<p><a href="{{actionUrl}}">Take Action</a></p>
<p>Best,<br>The SocialAI Team</p>`,
      variables: ["name", "escalationType", "priority", "details", "actionUrl"],
      isActive: true,
    },
    {
      slug: "content_approved",
      subject: "Content Approved - Ready to Publish",
      body: `<h1>Content Approved</h1>
<p>Hi {{name}},</p>
<p>Your content has been approved and is scheduled for publishing:</p>
<ul>
<li><strong>Platform:</strong> {{platform}}</li>
<li><strong>Scheduled Time:</strong> {{scheduledTime}}</li>
</ul>
<p><a href="{{previewUrl}}">Preview Content</a></p>
<p>Best,<br>The SocialAI Team</p>`,
      variables: ["name", "platform", "scheduledTime", "previewUrl"],
      isActive: true,
    },
    {
      slug: "payment_failed",
      subject: "Payment Failed - Action Required",
      body: `<h1>Payment Failed</h1>
<p>Hi {{name}},</p>
<p>We were unable to process your payment. Please update your payment method to avoid service interruption.</p>
<p><a href="{{billingUrl}}">Update Payment</a></p>
<p>If you have any questions, please contact support.</p>
<p>Best,<br>The SocialAI Team</p>`,
      variables: ["name", "billingUrl"],
      isActive: true,
    },
  ];

  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { slug: template.slug },
      update: template,
      create: template,
    });
  }
  console.log("✓ Email templates seeded");

  // ============================================================
  // ESCALATION RULES (Global)
  // ============================================================
  const escalationRules = [
    {
      name: "Crisis Keywords",
      triggerType: "keyword",
      triggerValue: "lawsuit,breach,scandal",
      action: "escalate_critical",
      priority: "CRITICAL" as const,
      isEnabled: true,
    },
    {
      name: "Negative Sentiment Spike",
      triggerType: "sentiment",
      triggerValue: "-0.7",
      action: "escalate_high",
      priority: "HIGH" as const,
      isEnabled: true,
    },
    {
      name: "High Volume Negative",
      triggerType: "volume",
      triggerValue: "10",
      action: "flag_for_review",
      priority: "MEDIUM" as const,
      isEnabled: true,
    },
    {
      name: "Competitor Mention",
      triggerType: "competitor",
      triggerValue: "",
      action: "flag_for_review",
      priority: "LOW" as const,
      isEnabled: true,
    },
  ];

  for (const rule of escalationRules) {
    const existing = await prisma.escalationRule.findFirst({ where: { name: rule.name } });
    if (!existing) {
      await prisma.escalationRule.create({
        data: { ...rule, organizationId: null },
      });
    }
  }
  console.log("✓ Escalation rules seeded");

  // ============================================================
  // BILLING PLANS
  // ============================================================
  // Default agents by tier (used to populate plans)
  // ============================================================
  const DEFAULT_CORE_AGENTS = [
    "CONTENT_CREATOR", "ENGAGEMENT", "PUBLISHER", "ANALYTICS", "STRATEGY",
    "TREND_SCOUT", "COMPLIANCE", "CONTENT_REPLENISHMENT", "CALENDAR_OPTIMIZER", "HASHTAG_OPTIMIZER"
  ];
  const DEFAULT_INTELLIGENCE_AGENTS = [
    ...DEFAULT_CORE_AGENTS,
    "COMPETITOR_INTELLIGENCE", "SOCIAL_LISTENING", "AUDIENCE_INTELLIGENCE", "INFLUENCER_SCOUT",
    "SOCIAL_SEO", "CAPTION_REWRITER", "BRAND_VOICE_GUARDIAN", "REPORTING_NARRATOR", "AB_TESTING"
  ];
  const DEFAULT_FULL_AGENTS = [
    ...DEFAULT_INTELLIGENCE_AGENTS,
    "CREATIVE_DIRECTOR", "PREDICTIVE_CONTENT", "ROI_ATTRIBUTION", "CROSS_CHANNEL_ATTRIBUTION",
    "AD_COPY", "SENTIMENT_INTELLIGENCE", "COMPETITIVE_AD_INTELLIGENCE", "PRICING_INTELLIGENCE",
    "COMMUNITY_BUILDER", "MEDIA_PITCH", "UGC_CURATOR", "REVIEW_RESPONSE", "REPURPOSE",
    "LOCALIZATION", "CHURN_PREDICTION", "ONBOARDING_INTELLIGENCE"
  ];

  // ============================================================
  const billingPlans = [
    {
      name: "Starter",
      slug: "starter",
      description: "Perfect for small businesses getting started with AI social media",
      agentTier: "core",
      enabledAgents: DEFAULT_CORE_AGENTS,
      trialDays: 14,
      maxPlatforms: 2,
      maxPostsPerMonth: 40,
      maxBrands: 1,
      maxTeamMembers: 1,
      isUsageBased: false,
      isActive: true,
      isPublic: true,
      sortOrder: 1,
      prices: {
        usd: { month: 1999, year: 19990 },
        eur: { month: 1799, year: 17990 },
        gbp: { month: 1599, year: 15990 },
      },
    },
    {
      name: "Growth",
      slug: "growth",
      description: "For growing businesses that need more platforms and advanced AI",
      agentTier: "intelligence",
      enabledAgents: DEFAULT_INTELLIGENCE_AGENTS,
      trialDays: 14,
      maxPlatforms: 4,
      maxPostsPerMonth: 80,
      maxBrands: 1,
      maxTeamMembers: 3,
      isUsageBased: false,
      isActive: true,
      isPublic: true,
      sortOrder: 2,
      prices: {
        usd: { month: 4999, year: 49990 },
        eur: { month: 4499, year: 44990 },
        gbp: { month: 3999, year: 39990 },
      },
    },
    {
      name: "Pro",
      slug: "pro",
      description: "For agencies and businesses that need full AI capabilities",
      agentTier: "full",
      enabledAgents: DEFAULT_FULL_AGENTS,
      trialDays: 14,
      maxPlatforms: -1, // unlimited
      maxPostsPerMonth: -1, // unlimited
      maxBrands: 5,
      maxTeamMembers: 10,
      isUsageBased: false,
      isActive: true,
      isPublic: true,
      sortOrder: 3,
      prices: {
        usd: { month: 9999, year: 99990 },
        eur: { month: 8999, year: 89990 },
        gbp: { month: 7999, year: 79990 },
      },
    },
    {
      name: "Agency",
      slug: "agency",
      description: "Usage-based pricing for agencies managing multiple clients",
      agentTier: "full",
      trialDays: 14,
      maxPlatforms: -1,
      maxPostsPerMonth: -1,
      maxBrands: -1,
      maxTeamMembers: -1,
      isUsageBased: true,
      usageUnitName: "client",
      usageIncluded: 10,
      overagePerUnit: { usd: 85, eur: 77, gbp: 68 },
      isActive: true,
      isPublic: true,
      sortOrder: 4,
      prices: {
        usd: { month: 8500, year: 85000 },
        eur: { month: 7700, year: 77000 },
        gbp: { month: 6800, year: 68000 },
      },
    },
  ];

  for (const plan of billingPlans) {
    const { prices, ...planData } = plan;

    const planWithDefaults = {
      ...planData,
      features: {},
      enabledAgents: [] as string[],
    };

    const created = await prisma.billingPlan.upsert({
      where: { slug: plan.slug },
      update: planWithDefaults,
      create: planWithDefaults,
    });

    // Create prices for each currency/interval
    for (const [currency, currencyPrices] of Object.entries(prices)) {
      for (const [interval, amount] of Object.entries(currencyPrices as Record<string, number>)) {
        await prisma.stripePlanPrice.upsert({
          where: {
            billingPlanId_currency_interval: {
              billingPlanId: created.id,
              currency,
              interval,
            },
          },
          update: { unitAmount: amount },
          create: {
            billingPlanId: created.id,
            currency,
            interval,
            unitAmount: amount,
            stripeProductId: "",
            stripePriceId: "",
          },
        });
      }
    }
  }
  console.log("✓ Billing plans seeded");

  console.log("\n✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
