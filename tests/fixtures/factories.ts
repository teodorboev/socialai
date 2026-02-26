/**
 * Test Data Factories
 * 
 * Provides factory functions for creating test data.
 * Reuses existing seed logic from prisma/seed.ts and prisma/seed-smart-router.ts
 */

import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";

// Import and reuse seed functions
async function getPrisma(): Promise<PrismaClient> {
  // Dynamic import to avoid circular dependency
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

/**
 * Organization factories
 */
export const organizationFactory = {
  async create(overrides: Partial<any> = {}) {
    const prisma = await getPrisma();
    return prisma.organization.create({
      data: {
        name: faker.company.name(),
        slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
        ...overrides,
      },
    });
  },

  async withSubscription(planSlug = "growth", overrides: Partial<any> = {}) {
    const prisma = await getPrisma();
    const org = await this.create(overrides);
    
    const plan = await prisma.billingPlan.findFirst({ 
      where: { slug: planSlug } 
    });
    
    if (!plan) {
      throw new Error(`Billing plan '${planSlug}' not found. Run seed first.`);
    }

    const subscription = await prisma.subscription.create({
      data: {
        organizationId: org.id,
        billingPlanId: plan.id,
        stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
        stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
        stripePriceId: `price_${faker.string.alphanumeric(14)}`,
        status: "active",
        currency: "usd",
        interval: "month",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
        ...overrides.subscription,
      },
    });

    return { org, subscription, plan };
  },

  async withFullSetup(planSlug = "pro") {
    const prisma = await getPrisma();
    const { org, subscription, plan } = await this.withSubscription(planSlug);

    // Create organization config
    const config = await prisma.orgSettings.create({
      data: {
        organizationId: org.id,
        autoPublishThreshold: 0.85,
        flagForReviewThreshold: 0.70,
        requireReviewThreshold: 0.50,
        defaultAiModel: "claude-sonnet-4-20250514",
        aiTemperature: 0.7,
        aiMaxTokens: 4096,
        autoEngagementEnabled: false,
        engagementConfidenceMin: 0.85,
        engagementResponseDelaySec: 300,
        maxPostsPerDayPerPlatform: 3,
        contentBufferDays: 2,
        timezone: "UTC",
        weeklyReportEnabled: true,
        weeklyReportDay: 1,
      },
    });

    // Create brand config
    const brandConfig = await prisma.brandConfig.create({
      data: {
        organizationId: org.id,
        brandName: org.name,
        industry: "ecommerce",
        voiceTone: {
          adjectives: ["friendly", "professional", "authentic"],
          examples: ["We believe in quality over quantity"],
          avoid: ["aggressive sales language"],
        },
        contentThemes: ["product_education", "customer_stories"],
        doNots: ["never mention competitors directly"],
      },
    });

    // Create social account
    const socialAccount = await prisma.socialAccount.create({
      data: {
        organizationId: org.id,
        platform: "INSTAGRAM",
        platformUserId: faker.string.numeric(10),
        platformUsername: faker.internet.username(),
        accessToken: faker.string.alphanumeric(50),
        isActive: true,
      },
    });

    return { org, subscription, plan, config, brandConfig, socialAccount };
  },
};

/**
 * Content factories
 */
export const contentFactory = {
  async create(organizationId: string, overrides: Partial<any> = {}) {
    const prisma = await getPrisma();
    return prisma.content.create({
      data: {
        organizationId,
        platform: "INSTAGRAM",
        contentType: "POST",
        caption: faker.lorem.paragraph(),
        hashtags: ["#test", "#socialai"],
        status: "DRAFT",
        confidenceScore: 0.85,
        ...overrides,
      },
    });
  },

  async published(organizationId: string, daysAgo = 7, overrides: Partial<any> = {}) {
    const publishedAt = new Date(Date.now() - daysAgo * 86400 * 1000);
    return this.create(organizationId, {
      status: "published",
      publishedAt,
      ...overrides,
    });
  },

  async scheduled(organizationId: string, scheduledFor = new Date(), overrides: Partial<any> = {}) {
    const content = await this.create(organizationId, {
      status: "scheduled",
      ...overrides,
    });

    const prisma = await getPrisma();
    await prisma.schedule.create({
      data: {
        organizationId,
        contentId: content.id,
        socialAccountId: overrides.socialAccountId || (await prisma.socialAccount.findFirst({ where: { organizationId } }))?.id,
        scheduledFor,
        status: "pending",
      },
    });

    return content;
  },
};

/**
 * System factories
 */
export const systemFactory = {
  async attentionItem(organizationId: string, overrides: Partial<any> = {}) {
    const prisma = await getPrisma();
    return prisma.escalation.create({
      data: {
        organizationId,
        agentName: "CONTENT_CREATOR",
        reason: overrides.reason || "Low confidence score",
        priority: overrides.priority || "MEDIUM",
        status: overrides.status || "OPEN",
        context: overrides.context || {},
        ...overrides,
      },
    });
  },

  async activityLog(organizationId: string, overrides: Partial<any> = {}) {
    const prisma = await getPrisma();
    return prisma.agentLog.create({
      data: {
        organizationId,
        agentName: overrides.agentName || "CONTENT_CREATOR",
        action: overrides.action || "generate_content",
        status: overrides.status || "SUCCESS",
        ...overrides,
      },
    });
  },

  async memory(organizationId: string, overrides: Partial<any> = {}) {
    // Note: Memory table might not exist yet in your schema
    // This is a placeholder for when you implement the memory system
    const prisma = await getPrisma();
    // Adjust based on your actual memory table schema
    return { id: faker.string.uuid(), organizationId, ...overrides } as any;
  },
};

/**
 * Seed wrappers - reuse existing seed logic
 */
export const seedFactory = {
  async billingPlans() {
    // Check if plans already exist
    const prisma = await getPrisma();
    const existing = await prisma.billingPlan.count();
    if (existing > 0) return;

    // Import and run seed logic
    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/seed.ts", { stdio: "pipe" });
  },

  async llmProviders() {
    const prisma = await getPrisma();
    const existing = await prisma.lLMProvider.count();
    if (existing > 0) return;

    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/seed-smart-router.ts", { stdio: "pipe" });
  },

  async all() {
    await this.billingPlans();
    await this.llmProviders();
  },
};

/**
 * Combined factory export
 */
export const factory = {
  organization: organizationFactory,
  content: contentFactory,
  system: systemFactory,
  seed: seedFactory,
};
