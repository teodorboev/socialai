import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

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
{{voiceTone}}

TARGET AUDIENCE:
{{targetAudience}}

PLATFORM: {{platform}}

INSTRUCTIONS:
Create engaging content that matches the brand voice.`,
      variables: ["brandName", "voiceTone", "targetAudience", "platform"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "ENGAGEMENT" as any,
      name: "main",
      description: "Main engagement/response prompt",
      body: `You are the social media community manager for {{brandName}}.

Respond authentically to comments and messages.`,
      variables: ["brandName"],
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
      body: `You are a social media strategy expert for {{brandName}}.

Create a comprehensive content strategy.`,
      variables: ["brandName"],
      version: 1,
      isActive: true,
    },
    {
      agentName: "TREND_SCOUT" as any,
      name: "main",
      description: "Main trend detection prompt",
      body: `You are a trend scout for {{brandName}}.

Identify relevant trends for the brand.`,
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
  // FEATURE FLAGS
  // ============================================================
  const featureFlags = [
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

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flag,
      create: flag,
    });
  }
  console.log("✓ Feature flags seeded");

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
    await prisma.escalationRule.upsert({
      where: { id: (await prisma.escalationRule.findFirst({ where: { name: rule.name } }))?.id || "" },
      update: rule,
      create: { ...rule, organizationId: null },
    });
  }
  console.log("✓ Escalation rules seeded");

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
