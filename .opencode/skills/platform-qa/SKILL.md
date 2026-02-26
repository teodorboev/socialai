---
name: platform-qa
description: "Comprehensive platform quality assurance skill. Test everything, optimize everything, document everything. Unit tests, integration tests, E2E tests, dead code removal, performance optimization, and full functionality tracing for every agent and flow. Run this skill AFTER building any feature to ensure quality."
---

# SKILL: Platform QA — Test, Optimize, Document, Trace

> Run this skill AFTER implementing any feature or agent.
> **Prerequisite**: Read `base-agent`, `orchestrator`, and `smart-router` skills first.

---

## Purpose

This skill does four things:

1. **TEST** — Unit tests, integration tests, E2E tests for every agent, pipeline, and user flow
2. **OPTIMIZE** — Remove dead code, reduce bundle size, fix N+1 queries, optimize hot paths
3. **DOCUMENT** — Generate living documentation that explains how every flow works step-by-step
4. **TRACE** — Map every user action to every function call, database write, and LLM invocation it triggers

When someone asks "how does onboarding work?" or "what happens when a post is published?" — this skill produces the definitive answer, traced through every line of code.

---

## File Location

```
tests/
├── unit/                              → Unit tests per module
│   ├── agents/                        → One test file per agent
│   │   ├── content-creator.test.ts
│   │   ├── engagement.test.ts
│   │   ├── compliance.test.ts
│   │   └── ... (one per agent)
│   ├── router/                        → SmartRouter tests
│   │   ├── classifier.test.ts
│   │   ├── resolver.test.ts
│   │   ├── providers.test.ts
│   │   └── fallback.test.ts
│   ├── billing/                       → Billing tests
│   │   ├── entitlements.test.ts
│   │   ├── stripe.test.ts
│   │   └── webhooks.test.ts
│   ├── memory/                        → Shared memory tests
│   │   ├── store.test.ts
│   │   ├── recall.test.ts
│   │   └── consolidation.test.ts
│   ├── orchestrator/                  → Orchestrator tests
│   │   ├── pipeline.test.ts
│   │   ├── circuit-breaker.test.ts
│   │   └── activity-logger.test.ts
│   └── lib/                           → Utility tests
│       ├── currency.test.ts
│       ├── platform-specs.test.ts
│       └── ...
├── integration/                       → Cross-module integration tests
│   ├── pipelines/
│   │   ├── content-creation.test.ts
│   │   ├── engagement.test.ts
│   │   ├── intelligence.test.ts
│   │   ├── reporting.test.ts
│   │   └── onboarding.test.ts
│   ├── billing-orchestrator.test.ts
│   ├── smart-router-agents.test.ts
│   ├── memory-agents.test.ts
│   └── webhook-flows.test.ts
├── e2e/                               → End-to-end tests
│   ├── onboarding.e2e.ts
│   ├── mission-control.e2e.ts
│   ├── content-lifecycle.e2e.ts
│   ├── billing-lifecycle.e2e.ts
│   └── crisis-mode.e2e.ts
├── traces/                            → Generated flow documentation
│   ├── flows.json                     → Machine-readable flow definitions
│   └── generated/                     → Generated markdown docs
├── fixtures/                          → Test data factories
│   ├── organizations.ts
│   ├── content.ts
│   ├── subscriptions.ts
│   └── llm-responses.ts
├── mocks/                             → Mocking infrastructure
│   ├── smart-router.mock.ts
│   ├── stripe.mock.ts
│   ├── supabase.mock.ts
│   ├── inngest.mock.ts
│   └── social-apis.mock.ts
└── helpers/
    ├── db.ts                          → Test database setup/teardown
    ├── factories.ts                   → Data factory helpers
    └── assertions.ts                  → Custom test assertions

scripts/
├── qa-full.sh                         → Run everything
├── qa-test.sh                         → Run all tests
├── qa-optimize.sh                     → Run all optimizations
├── qa-trace.sh                        → Generate all flow traces
├── qa-deadcode.sh                     → Find and remove dead code
└── qa-coverage.sh                     → Generate coverage report

docs/
├── flows/                             → Flow documentation (auto-generated + manual)
│   ├── README.md                      → Index of all flows
│   ├── onboarding.md
│   ├── content-lifecycle.md
│   ├── engagement.md
│   ├── billing.md
│   ├── crisis.md
│   └── agents/                        → Per-agent documentation
│       ├── content-creator.md
│       ├── engagement.md
│       └── ... (one per agent)
└── architecture/
    ├── data-flow.md
    ├── agent-map.md
    └── cost-model.md
```

---

## PART 1: TESTING

### Test Configuration

```typescript
// vitest.config.ts

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/helpers/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/types/**",
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
```

### Test Setup

```typescript
// tests/helpers/setup.ts

import { beforeAll, afterAll, beforeEach } from "vitest";
import { mockSmartRouter } from "../mocks/smart-router.mock";
import { mockStripe } from "../mocks/stripe.mock";
import { mockInngest } from "../mocks/inngest.mock";
import { setupTestDb, teardownTestDb, resetTestDb } from "./db";

beforeAll(async () => {
  await setupTestDb();
  mockSmartRouter();
  mockStripe();
  mockInngest();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await resetTestDb();
});
```

### Mock Infrastructure

```typescript
// tests/mocks/smart-router.mock.ts

import { vi } from "vitest";

// Mock SmartRouter so agent tests don't make real LLM calls
export function mockSmartRouter() {
  vi.mock("@/lib/router", () => ({
    smartRouter: {
      complete: vi.fn().mockImplementation(async (request) => {
        // Return appropriate mock based on agent/taskType
        const mockResponses = getMockResponseForAgent(request.agentName, request.taskType);
        return {
          content: mockResponses.content,
          toolCalls: mockResponses.toolCalls,
          inputTokens: 500,
          outputTokens: 200,
          tier: request.forceTier ?? "mid",
          taskType: request.taskType ?? "generation",
          providerName: "anthropic",
          modelId: "claude-sonnet-4-5-mock",
          modelDisplayName: "Mock Sonnet",
          costCents: 2,
          latencyMs: 150,
          wasFallback: false,
        };
      }),
    },
  }));
}

// Per-agent mock responses — each agent gets realistic mock output
function getMockResponseForAgent(agentName: string, taskType?: string): MockLLMResponse {
  const mocks: Record<string, () => MockLLMResponse> = {
    CONTENT_CREATOR: () => ({
      content: JSON.stringify({
        posts: [{
          id: "mock-post-1",
          platform: "instagram",
          contentType: "CAROUSEL",
          topic: "skincare tips",
          caption: "5 ingredients your skin is begging for 🌿\n\nSwipe to discover...",
          hashtags: ["#skincare", "#naturalskincare", "#skincaretips"],
          hookType: "list_number",
          confidenceScore: 0.85,
        }],
      }),
    }),
    COMPLIANCE: () => ({
      content: JSON.stringify({
        passed: true,
        checks: [
          { category: "prohibited_claims", status: "pass" },
          { category: "profanity", status: "pass" },
          { category: "competitor_mentions", status: "pass" },
        ],
        overallConfidence: 0.95,
      }),
    }),
    ENGAGEMENT: () => {
      if (taskType === "classification") {
        return {
          content: JSON.stringify({
            comments: [
              { id: "c1", sentiment: "positive", category: "compliment", priority: "low" },
              { id: "c2", sentiment: "negative", category: "complaint", priority: "high" },
            ],
          }),
        };
      }
      return {
        content: JSON.stringify({
          responses: [
            { commentId: "c1", response: "Thank you so much! 💛", confidence: 0.92 },
            { commentId: "c2", response: "We're sorry to hear that. Can you DM us so we can help?", confidence: 0.88, shouldEscalate: true },
          ],
        }),
      };
    },
    BRAND_VOICE_GUARDIAN: () => ({
      content: JSON.stringify({
        overallScore: 82,
        dimensionScores: { toneAlignment: 85, vocabularyConsistency: 78, personalityMatch: 83 },
        issues: [],
      }),
    }),
    PREDICTIVE_CONTENT: () => ({
      content: JSON.stringify({
        predictedEngagement: 4.2,
        performancePercentile: 72,
        publishRecommendation: "publish",
        confidenceInterval: { low: 3.1, high: 5.8 },
      }),
    }),
    STRATEGY: () => ({
      content: JSON.stringify({
        contentNeeded: [
          { platform: "instagram", contentType: "CAROUSEL", topic: "ingredient spotlight", priority: 1 },
          { platform: "instagram", contentType: "REEL", topic: "skincare routine", priority: 2 },
          { platform: "linkedin", contentType: "POST", topic: "industry trends", priority: 3 },
        ],
      }),
    }),
    // Add mocks for every agent...
    DEFAULT: () => ({
      content: JSON.stringify({ status: "completed", data: {} }),
    }),
  };

  return (mocks[agentName] ?? mocks.DEFAULT)();
}
```

```typescript
// tests/mocks/stripe.mock.ts

import { vi } from "vitest";

export function mockStripe() {
  vi.mock("stripe", () => {
    return {
      default: vi.fn().mockImplementation(() => ({
        customers: {
          create: vi.fn().mockResolvedValue({ id: "cus_mock_123", email: "test@example.com" }),
        },
        subscriptions: {
          create: vi.fn().mockResolvedValue({
            id: "sub_mock_123",
            status: "trialing",
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
            items: { data: [{ id: "si_mock_123", price: { id: "price_mock_123" } }] },
          }),
          update: vi.fn().mockResolvedValue({ id: "sub_mock_123", status: "active" }),
          cancel: vi.fn().mockResolvedValue({ id: "sub_mock_123", status: "canceled" }),
          retrieve: vi.fn().mockResolvedValue({
            id: "sub_mock_123",
            items: { data: [{ id: "si_mock_123" }] },
          }),
        },
        checkout: {
          sessions: {
            create: vi.fn().mockResolvedValue({ id: "cs_mock_123", url: "https://checkout.stripe.com/mock" }),
          },
        },
        billingPortal: {
          sessions: {
            create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/mock" }),
          },
        },
        prices: {
          create: vi.fn().mockResolvedValue({ id: "price_new_mock" }),
          retrieve: vi.fn().mockResolvedValue({ id: "price_mock_123", unit_amount: 19900 }),
          update: vi.fn().mockResolvedValue({ id: "price_mock_123" }),
        },
        products: {
          create: vi.fn().mockResolvedValue({ id: "prod_mock_123" }),
          update: vi.fn().mockResolvedValue({ id: "prod_mock_123" }),
        },
        webhooks: {
          constructEvent: vi.fn().mockImplementation((body, sig, secret) => JSON.parse(body)),
        },
      })),
    };
  });
}
```

```typescript
// tests/mocks/inngest.mock.ts

import { vi } from "vitest";

export const mockInngestEvents: Array<{ name: string; data: any }> = [];

export function mockInngest() {
  vi.mock("@/lib/inngest", () => ({
    inngest: {
      send: vi.fn().mockImplementation(async (event) => {
        mockInngestEvents.push(event);
        return { ids: ["mock-event-id"] };
      }),
      createFunction: vi.fn().mockImplementation((config, trigger, handler) => ({
        ...config,
        trigger,
        handler,
      })),
    },
  }));
}

export function getEmittedEvents(): typeof mockInngestEvents {
  return mockInngestEvents;
}

export function clearEmittedEvents() {
  mockInngestEvents.length = 0;
}
```

### Data Factories

```typescript
// tests/fixtures/factories.ts

import { faker } from "@faker-js/faker";
import { prisma } from "@/lib/prisma";

export const factory = {

  async organization(overrides: Partial<any> = {}) {
    return prisma.organization.create({
      data: {
        name: faker.company.name(),
        slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
        ...overrides,
      },
    });
  },

  async orgWithSubscription(planSlug = "growth") {
    const org = await this.organization();
    const plan = await prisma.billingPlan.findFirst({ where: { slug: planSlug } });
    const subscription = await prisma.subscription.create({
      data: {
        organizationId: org.id,
        billingPlanId: plan!.id,
        stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
        stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
        stripePriceId: `price_${faker.string.alphanumeric(14)}`,
        status: "active",
        currency: "usd",
        interval: "month",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });
    return { org, subscription, plan };
  },

  async orgWithFullSetup() {
    const { org, subscription, plan } = await this.orgWithSubscription("pro");
    const config = await prisma.organizationConfig.create({
      data: {
        organizationId: org.id,
        automationLevel: "light_touch",
        postingSchedule: { instagram: { times: ["09:00", "18:00"], days: [1, 2, 3, 4, 5] } },
        contentMix: { educational: 40, product: 30, behindScenes: 20, trending: 10 },
        brandVoice: { personality: ["warm", "educational"], tone: { formality: 0.4 } },
        competitors: ["Competitor A", "Competitor B"],
        doNots: ["never mention competitors directly"],
        goals: ["drive_sales"],
        targetAudience: { demographics: "women 25-45", interests: ["skincare", "sustainability"] },
        connectedPlatforms: ["instagram", "linkedin"],
      },
    });
    return { org, subscription, plan, config };
  },

  async content(organizationId: string, overrides: Partial<any> = {}) {
    return prisma.content.create({
      data: {
        organizationId,
        platform: "instagram",
        contentType: "CAROUSEL",
        topic: "skincare tips",
        caption: "5 ingredients your skin needs 🌿",
        hashtags: ["#skincare"],
        status: "draft",
        confidenceScore: 0.85,
        ...overrides,
      },
    });
  },

  async publishedContent(organizationId: string, daysAgo = 7) {
    return this.content(organizationId, {
      status: "published",
      publishedAt: new Date(Date.now() - daysAgo * 86400 * 1000),
    });
  },

  async attentionItem(organizationId: string, overrides: Partial<any> = {}) {
    return prisma.attentionItem.create({
      data: {
        organizationId,
        type: "content_review",
        title: "3 posts ready for review",
        priority: "normal",
        status: "pending",
        data: {},
        ...overrides,
      },
    });
  },

  async billingPlans() {
    // Seed all plans for testing
    const plans = [
      { name: "Starter", slug: "starter", agentTier: "core", maxPlatforms: 2, maxPostsPerMonth: 40, maxBrands: 1, maxTeamMembers: 1, trialDays: 14, features: {}, sortOrder: 1 },
      { name: "Growth", slug: "growth", agentTier: "intelligence", maxPlatforms: 4, maxPostsPerMonth: 80, maxBrands: 1, maxTeamMembers: 3, trialDays: 14, features: { creative_director: true }, sortOrder: 2 },
      { name: "Pro", slug: "pro", agentTier: "full", maxPlatforms: -1, maxPostsPerMonth: -1, maxBrands: 1, maxTeamMembers: 10, trialDays: 14, features: { creative_director: true, roi_attribution: true }, sortOrder: 3 },
    ];
    for (const plan of plans) {
      await prisma.billingPlan.create({ data: plan });
    }
  },

  async llmProviders() {
    // Seed providers and models for SmartRouter testing
    const anthropic = await prisma.lLMProvider.create({
      data: { name: "anthropic", displayName: "Anthropic", apiKeyEnvVar: "ANTHROPIC_API_KEY" },
    });
    await prisma.lLMModel.create({
      data: {
        providerId: anthropic.id, modelId: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5",
        tier: "budget", inputPricePer1M: 100, outputPricePer1M: 500,
        capabilities: ["classification", "extraction"], maxInputTokens: 200000, maxOutputTokens: 8192,
        supportsToolUse: true, supportsJson: true, priorityInTier: 1,
      },
    });
    await prisma.lLMModel.create({
      data: {
        providerId: anthropic.id, modelId: "claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5",
        tier: "mid", inputPricePer1M: 300, outputPricePer1M: 1500,
        capabilities: ["generation", "reasoning", "analysis"], maxInputTokens: 200000, maxOutputTokens: 8192,
        supportsToolUse: true, supportsJson: true, supportsImages: true, priorityInTier: 1,
      },
    });
  },
};
```

---

### Unit Test Examples

```typescript
// tests/unit/agents/content-creator.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { factory } from "../../fixtures/factories";

describe("ContentCreatorAgent", () => {
  let agent: ContentCreatorAgent;
  let org: any;

  beforeEach(async () => {
    agent = new ContentCreatorAgent();
    const setup = await factory.orgWithFullSetup();
    org = setup.org;
  });

  describe("run()", () => {
    it("should generate posts based on strategy input", async () => {
      const result = await agent.run(org.id, {
        contentNeeded: [{ platform: "instagram", contentType: "CAROUSEL", topic: "ingredient spotlight" }],
      });

      expect(result.status).toBe("completed");
      expect(result.data.posts).toHaveLength(1);
      expect(result.data.posts[0]).toMatchObject({
        platform: "instagram",
        contentType: "CAROUSEL",
      });
    });

    it("should respect brand voice do-nots", async () => {
      const result = await agent.run(org.id, {
        contentNeeded: [{ platform: "instagram", contentType: "POST", topic: "competitors" }],
      });

      // Caption should NOT mention competitors directly (from do-nots)
      for (const post of result.data.posts) {
        expect(post.caption.toLowerCase()).not.toContain("competitor a");
        expect(post.caption.toLowerCase()).not.toContain("competitor b");
      }
    });

    it("should include memory context in generation", async () => {
      // Store a memory first
      await memory.store({
        organizationId: org.id,
        content: "Posts about vitamin C get 3x more engagement",
        memoryType: "content_performance",
        agentSource: "SELF_EVALUATION",
        importance: 0.8,
      });

      const result = await agent.run(org.id, {
        contentNeeded: [{ platform: "instagram", contentType: "POST", topic: "ingredients" }],
      });

      // SmartRouter should have been called with memory context in the prompt
      expect(smartRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("RELEVANT HISTORY"),
            }),
          ]),
        })
      );
    });

    it("should route to mid-tier model via SmartRouter", async () => {
      await agent.run(org.id, {
        contentNeeded: [{ platform: "instagram", contentType: "POST", topic: "tips" }],
      });

      expect(smartRouter.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: "CONTENT_CREATOR",
          taskType: "generation",
        })
      );
    });

    it("should store output in shared memory", async () => {
      await agent.run(org.id, {
        contentNeeded: [{ platform: "instagram", contentType: "POST", topic: "tips" }],
      });

      const memories = await prisma.memory.findMany({
        where: { organizationId: org.id, memoryType: "content_created" },
      });
      expect(memories.length).toBeGreaterThan(0);
    });

    it("should respect monthly post limits from billing plan", async () => {
      // Create 40 published posts (starter plan limit)
      for (let i = 0; i < 40; i++) {
        await factory.publishedContent(org.id, 0);
      }

      // Downgrade to starter plan
      await prisma.subscription.update({
        where: { organizationId: org.id },
        data: { billingPlanId: (await prisma.billingPlan.findFirst({ where: { slug: "starter" } }))!.id },
      });

      const canPublish = await canPublishCheck(org.id);
      expect(canPublish.allowed).toBe(false);
      expect(canPublish.reason).toBe("monthly_post_limit_reached");
    });
  });
});
```

```typescript
// tests/unit/router/classifier.test.ts

import { describe, it, expect } from "vitest";
import { classifyRequest } from "@/lib/router/classifier";

describe("SmartRouter Classifier", () => {
  it("should classify COMPLIANCE as budget tier", () => {
    const result = classifyRequest({ agentName: "COMPLIANCE" });
    expect(result.tier).toBe("budget");
    expect(result.taskType).toBe("classification");
  });

  it("should classify CONTENT_CREATOR as mid tier", () => {
    const result = classifyRequest({ agentName: "CONTENT_CREATOR" });
    expect(result.tier).toBe("mid");
    expect(result.taskType).toBe("generation");
  });

  it("should classify STRATEGY as flagship tier", () => {
    const result = classifyRequest({ agentName: "STRATEGY" });
    expect(result.tier).toBe("flagship");
    expect(result.taskType).toBe("reasoning");
  });

  it("should allow taskType override", () => {
    // Engagement agent classifying = budget
    const classify = classifyRequest({ agentName: "ENGAGEMENT", taskType: "classification" });
    expect(classify.tier).toBe("budget");

    // Same agent generating responses = mid
    const generate = classifyRequest({ agentName: "ENGAGEMENT", taskType: "generation" });
    expect(generate.tier).toBe("mid");
  });

  it("should have higher confidence when taskType is explicitly declared", () => {
    const implicit = classifyRequest({ agentName: "ENGAGEMENT" });
    const explicit = classifyRequest({ agentName: "ENGAGEMENT", taskType: "classification" });
    expect(explicit.confidence).toBeGreaterThan(implicit.confidence);
  });
});
```

```typescript
// tests/unit/billing/entitlements.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { getEntitlements, canRunAgent } from "@/lib/billing/entitlements";
import { factory } from "../../fixtures/factories";

describe("Billing Entitlements", () => {
  beforeEach(async () => {
    await factory.billingPlans();
  });

  describe("Starter plan", () => {
    it("should only allow core agents", async () => {
      const { org } = await factory.orgWithSubscription("starter");
      const entitlements = await getEntitlements(org.id);

      expect(entitlements.enabledAgents).toContain("CONTENT_CREATOR");
      expect(entitlements.enabledAgents).toContain("PUBLISHER");
      expect(entitlements.enabledAgents).not.toContain("ROI_ATTRIBUTION");
      expect(entitlements.enabledAgents).not.toContain("PREDICTIVE_CONTENT");
    });

    it("should enforce platform limit of 2", async () => {
      const { org } = await factory.orgWithSubscription("starter");
      const entitlements = await getEntitlements(org.id);
      expect(entitlements.maxPlatforms).toBe(2);
    });

    it("should enforce post limit of 40", async () => {
      const { org } = await factory.orgWithSubscription("starter");
      const entitlements = await getEntitlements(org.id);
      expect(entitlements.maxPostsPerMonth).toBe(40);
    });
  });

  describe("Pro plan", () => {
    it("should allow all agents", async () => {
      const { org } = await factory.orgWithSubscription("pro");
      const entitlements = await getEntitlements(org.id);

      expect(entitlements.enabledAgents).toContain("ROI_ATTRIBUTION");
      expect(entitlements.enabledAgents).toContain("PREDICTIVE_CONTENT");
      expect(entitlements.enabledAgents).toContain("COMPETITIVE_AD_INTELLIGENCE");
    });

    it("should have unlimited posts", async () => {
      const { org } = await factory.orgWithSubscription("pro");
      const entitlements = await getEntitlements(org.id);
      expect(entitlements.maxPostsPerMonth).toBe(-1);
    });
  });

  describe("canRunAgent", () => {
    it("should return false for agents not in plan", async () => {
      const { org } = await factory.orgWithSubscription("starter");
      expect(await canRunAgent(org.id, "ROI_ATTRIBUTION")).toBe(false);
    });

    it("should return false for canceled subscriptions", async () => {
      const { org } = await factory.orgWithSubscription("pro");
      await prisma.subscription.update({
        where: { organizationId: org.id },
        data: { status: "canceled" },
      });
      expect(await canRunAgent(org.id, "CONTENT_CREATOR")).toBe(false);
    });

    it("should return true for trialing subscriptions", async () => {
      const { org } = await factory.orgWithSubscription("pro");
      await prisma.subscription.update({
        where: { organizationId: org.id },
        data: { status: "trialing" },
      });
      expect(await canRunAgent(org.id, "CONTENT_CREATOR")).toBe(true);
    });
  });
});
```

---

### Integration Tests

```typescript
// tests/integration/pipelines/content-creation.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { runPipeline } from "@/lib/orchestrator/brain";
import { factory } from "../../fixtures/factories";

describe("Content Creation Pipeline (Integration)", () => {
  let org: any;

  beforeEach(async () => {
    await factory.billingPlans();
    await factory.llmProviders();
    const setup = await factory.orgWithFullSetup();
    org = setup.org;
  });

  it("should execute full pipeline: strategy → trends → create → hashtags → seo → voice → predict → compliance → visual → publish", async () => {
    const result = await runPipeline(org.id, mockStep, "content-creation");

    expect(result.status).toBe("completed");

    // Verify each agent was called in order
    const routerCalls = vi.mocked(smartRouter.complete).mock.calls;
    const agentOrder = routerCalls.map(c => c[0].agentName);
    expect(agentOrder).toContain("STRATEGY");
    expect(agentOrder).toContain("CONTENT_CREATOR");
    expect(agentOrder).toContain("COMPLIANCE");
    expect(agentOrder.indexOf("STRATEGY")).toBeLessThan(agentOrder.indexOf("CONTENT_CREATOR"));
    expect(agentOrder.indexOf("CONTENT_CREATOR")).toBeLessThan(agentOrder.indexOf("COMPLIANCE"));
  });

  it("should create attention items for content review (light_touch mode)", async () => {
    await runPipeline(org.id, mockStep, "content-creation");

    const attentionItems = await prisma.attentionItem.findMany({
      where: { organizationId: org.id, type: "content_review" },
    });
    expect(attentionItems.length).toBeGreaterThan(0);
  });

  it("should log activity for mission control", async () => {
    await runPipeline(org.id, mockStep, "content-creation");

    const activities = await prisma.activityLog.findMany({
      where: { organizationId: org.id },
    });
    expect(activities.length).toBeGreaterThan(0);
    expect(activities.some(a => a.message.includes("Generated"))).toBe(true);
  });

  it("should skip agents not in billing plan", async () => {
    // Downgrade to starter (no PREDICTIVE_CONTENT)
    const starterPlan = await prisma.billingPlan.findFirst({ where: { slug: "starter" } });
    await prisma.subscription.update({
      where: { organizationId: org.id },
      data: { billingPlanId: starterPlan!.id },
    });

    await runPipeline(org.id, mockStep, "content-creation");

    const routerCalls = vi.mocked(smartRouter.complete).mock.calls;
    const agentNames = routerCalls.map(c => c[0].agentName);
    expect(agentNames).not.toContain("PREDICTIVE_CONTENT");
  });

  it("should abort pipeline if compliance fails", async () => {
    // Mock compliance to fail
    vi.mocked(smartRouter.complete).mockImplementationOnce(async (req) => {
      if (req.agentName === "COMPLIANCE") {
        return {
          content: JSON.stringify({
            passed: false,
            checks: [{ category: "prohibited_claims", status: "fail", detail: "Unsubstantiated health claim" }],
          }),
          inputTokens: 100, outputTokens: 50, tier: "budget", taskType: "classification",
          providerName: "anthropic", modelId: "mock", modelDisplayName: "Mock", costCents: 1, latencyMs: 50, wasFallback: false,
        };
      }
      return defaultMockResponse(req);
    });

    await runPipeline(org.id, mockStep, "content-creation");

    // Should create escalation attention item
    const escalations = await prisma.attentionItem.findMany({
      where: { organizationId: org.id, type: "agent_escalation" },
    });
    expect(escalations.length).toBeGreaterThan(0);
  });
});
```

```typescript
// tests/integration/billing-orchestrator.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { handlePaymentFailed, handleSubscriptionCanceled } from "@/app/api/webhooks/stripe/route";
import { factory } from "../fixtures/factories";
import { getEmittedEvents, clearEmittedEvents } from "../mocks/inngest.mock";

describe("Billing → Orchestrator Integration", () => {
  beforeEach(async () => {
    await factory.billingPlans();
    clearEmittedEvents();
  });

  it("should emit payment-failed event and trigger dunning", async () => {
    const { org } = await factory.orgWithSubscription("growth");

    await handlePaymentFailed({
      customer: (await prisma.subscription.findUnique({ where: { organizationId: org.id } }))!.stripeCustomerId,
    } as any);

    const events = getEmittedEvents();
    expect(events).toContainEqual(
      expect.objectContaining({ name: "billing/payment-failed" })
    );

    const sub = await prisma.subscription.findUnique({ where: { organizationId: org.id } });
    expect(sub!.failedPaymentCount).toBe(1);
    expect(sub!.dunningStep).toBe(1);
  });

  it("should pause pipeline execution for canceled subscriptions", async () => {
    const { org } = await factory.orgWithSubscription("growth");

    // Cancel subscription
    await prisma.subscription.update({
      where: { organizationId: org.id },
      data: { status: "canceled" },
    });

    // Try to run pipeline
    const result = await runPipeline(org.id, mockStep, "content-creation");

    // Should not execute any agents
    expect(vi.mocked(smartRouter.complete)).not.toHaveBeenCalled();
  });
});
```

---

### E2E Tests

```typescript
// tests/e2e/onboarding.e2e.ts

import { describe, it, expect } from "vitest";

describe("Onboarding Flow (E2E)", () => {
  it("should complete full onboarding: signup → connect → conversation → plan review → checkout → first content", async () => {
    // 1. Create user via Supabase Auth
    const user = await supabase.auth.signUp({ email: "test@pureglow.com", password: "test12345" });
    expect(user.data.user).toBeTruthy();

    // 2. Navigate to /onboard
    const onboardingPage = await fetch("/onboard", { headers: { Authorization: `Bearer ${user.data.session.access_token}` } });
    expect(onboardingPage.status).toBe(200);

    // 3. Simulate conversation: business description
    await postOnboardingMessage(user, "We make organic skincare products for sensitive skin");
    const conversation = await getOnboardingState(user);
    expect(conversation.extractedData.business.description).toContain("organic skincare");

    // 4. Simulate: audience
    await postOnboardingMessage(user, "Women 25-45 who care about clean ingredients");
    const updated = await getOnboardingState(user);
    expect(updated.extractedData.audience.demographics).toContain("25-45");

    // 5. Simulate: competitors
    await postOnboardingMessage(user, "Drunk Elephant and Herbivore Botanicals");
    const withCompetitors = await getOnboardingState(user);
    expect(withCompetitors.extractedData.competitors).toHaveLength(2);

    // 6. Simulate: goal selection
    await postOnboardingMessage(user, "drive_website_sales");
    // 7. Simulate: automation level
    await postOnboardingMessage(user, "light_touch");

    // 8. Check analysis completed
    const analysisState = await getOnboardingState(user);
    expect(analysisState.phase).toBe("review");

    // 9. Approve plan
    await postOnboardingMessage(user, "approve_plan");

    // 10. Verify org is fully configured
    const org = await prisma.organization.findFirst({ where: { createdBy: user.data.user.id } });
    const config = await prisma.organizationConfig.findUnique({ where: { organizationId: org!.id } });
    expect(config).toBeTruthy();
    expect(config!.automationLevel).toBe("light_touch");
    expect(config!.goals).toContain("drive_sales");

    // 11. Verify onboarding pipeline was triggered
    const events = getEmittedEvents();
    expect(events.some(e => e.name === "account/connected")).toBe(true);
  });
});
```

---

## PART 2: FLOW TRACING & DOCUMENTATION

### Flow Definition Format

```typescript
// tests/traces/flows.json

interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  trigger: string;                    // What starts this flow
  category: "user_action" | "scheduled" | "event_driven";
  steps: FlowStep[];
}

interface FlowStep {
  order: number;
  component: string;                  // "Orchestrator", "ContentCreator", "SmartRouter", etc.
  action: string;                     // What happens
  file: string;                       // Source file
  function: string;                   // Function name
  inputs: string;                     // What data comes in
  outputs: string;                    // What data goes out
  database?: string;                  // DB operations (read/write table)
  llmCall?: {                         // If this step makes an LLM call
    taskType: string;
    tier: string;
    estimatedTokens: string;
  };
  branchCondition?: string;           // If this step branches
  branches?: { condition: string; goTo: number }[];
  humanRequired?: boolean;            // Does this need human input
  missionControlEffect?: string;      // What changes on Mission Control
}
```

### Flow Trace Generator

```typescript
// scripts/qa-trace.sh calls this:
// tests/traces/generate-flows.ts

import { PIPELINES } from "@/lib/orchestrator/pipelines";
import { AGENT_TASK_MAP } from "@/lib/router/classifier";
import fs from "fs";
import path from "path";

const flows: FlowDefinition[] = [

  // ═══════════════════════════════════════════════════════
  // ONBOARDING FLOW
  // ═══════════════════════════════════════════════════════
  {
    id: "onboarding",
    name: "New Client Onboarding",
    description: "Complete flow from signup to first AI-generated content",
    trigger: "User signs up and navigates to /onboard",
    category: "user_action",
    steps: [
      {
        order: 1,
        component: "Supabase Auth",
        action: "User creates account (email + password or OAuth)",
        file: "app/(auth)/signup/page.tsx",
        function: "handleSignup()",
        inputs: "email, password",
        outputs: "userId, session token",
        database: "WRITE auth.users",
      },
      {
        order: 2,
        component: "Onboarding Page",
        action: "Create organization and redirect to /onboard",
        file: "app/(onboarding)/onboard/page.tsx",
        function: "initOnboarding()",
        inputs: "userId",
        outputs: "organizationId, onboardingConversationId",
        database: "WRITE Organization, OnboardingConversation",
      },
      {
        order: 3,
        component: "Onboarding Conversation Engine",
        action: "Phase 1: CONNECT — Show social account connect buttons",
        file: "lib/onboarding/conversation-engine.ts",
        function: "getNextQuestion(phase='connect')",
        inputs: "onboardingConversationId",
        outputs: "AI message with OAuth buttons",
        missionControlEffect: "N/A — still in onboarding",
      },
      {
        order: 4,
        component: "OAuth Handler",
        action: "User connects Instagram (or other platform)",
        file: "app/api/auth/[provider]/callback/route.ts",
        function: "handleOAuthCallback()",
        inputs: "OAuth code from Instagram",
        outputs: "socialAccountId, accessToken (encrypted)",
        database: "WRITE SocialAccount",
      },
      {
        order: 5,
        component: "Orchestrator",
        action: "Fires 'account/connected' event → triggers onboarding pipeline",
        file: "inngest/functions/orchestrator-events.ts",
        function: "onAccountConnected()",
        inputs: "organizationId",
        outputs: "Pipeline run started",
      },
      {
        order: 6,
        component: "Onboarding Intelligence Agent",
        action: "Analyze last 90 days of content from connected accounts",
        file: "agents/onboarding-intelligence.ts",
        function: "run()",
        inputs: "socialAccountId, last 90 days of posts",
        outputs: "Detected brand voice, audience demographics, best content types, optimal times",
        llmCall: { taskType: "analysis", tier: "flagship", estimatedTokens: "4K in / 3K out" },
        database: "READ SocialAccount posts; WRITE analysis results to OnboardingConversation.extractedData",
      },
      {
        order: 7,
        component: "Onboarding Conversation Engine",
        action: "Phase 2: UNDERSTAND — AI asks about business, audience, competitors, goals, do-nots, automation level",
        file: "lib/onboarding/conversation-engine.ts",
        function: "processMessage()",
        inputs: "User's natural language responses",
        outputs: "Extracted structured data: business, audience, competitors, goals, doNots, automationLevel",
        llmCall: { taskType: "extraction", tier: "mid", estimatedTokens: "2K in / 1K out (per message)" },
        database: "WRITE OnboardingConversation.messages + extractedData",
      },
      {
        order: 8,
        component: "Audience Intelligence Agent",
        action: "Build audience personas from connected account data + conversation input",
        file: "agents/audience-intelligence.ts",
        function: "run()",
        inputs: "Follower data, engagement patterns, stated target audience",
        outputs: "Audience personas, demographics, interests, active times",
        llmCall: { taskType: "analysis", tier: "flagship", estimatedTokens: "3K in / 2K out" },
      },
      {
        order: 9,
        component: "Competitor Intelligence Agent",
        action: "Scan competitors mentioned in conversation",
        file: "agents/competitor-intelligence.ts",
        function: "run()",
        inputs: "Competitor names from conversation",
        outputs: "Competitor profiles: platforms, content strategy, posting frequency, engagement rates",
        llmCall: { taskType: "analysis", tier: "flagship", estimatedTokens: "3K in / 2K out" },
      },
      {
        order: 10,
        component: "Strategy Agent",
        action: "Generate proposed strategy: posting schedule, content mix, platform focus",
        file: "agents/strategy.ts",
        function: "run()",
        inputs: "All extracted data + audience analysis + competitor analysis",
        outputs: "Complete strategy plan: platforms, schedule, content mix, voice profile",
        llmCall: { taskType: "reasoning", tier: "flagship", estimatedTokens: "5K in / 3K out" },
      },
      {
        order: 11,
        component: "Onboarding Review Page",
        action: "Phase 4: REVIEW — Present proposed plan to user",
        file: "app/(onboarding)/onboard/review/page.tsx",
        function: "renderPlanReview()",
        inputs: "Strategy plan output",
        outputs: "Visual plan card with Approve / Tweak options",
        humanRequired: true,
      },
      {
        order: 12,
        component: "Plan Approval Handler",
        action: "User approves plan → create org config → redirect to Stripe Checkout",
        file: "app/(onboarding)/onboard/review/page.tsx",
        function: "handleApprove()",
        inputs: "Approved plan, selected billing plan",
        outputs: "OrganizationConfig created, Stripe Checkout Session URL",
        database: "WRITE OrganizationConfig, BrandVoiceProfile, Goal",
      },
      {
        order: 13,
        component: "Stripe Checkout",
        action: "User enters payment method, starts trial",
        file: "External: Stripe Checkout",
        function: "checkout.session.completed webhook",
        inputs: "Payment method",
        outputs: "Subscription created (status: trialing)",
        database: "WRITE Subscription",
      },
      {
        order: 14,
        component: "Orchestrator",
        action: "Fires 'billing/subscription-activated' → starts content-creation pipeline",
        file: "inngest/functions/billing-events.ts",
        function: "onSubscriptionActivated()",
        inputs: "organizationId, planSlug",
        outputs: "First content-creation pipeline triggered",
        missionControlEffect: "User redirected to Mission Control. Activity feed shows: 'Your AI is generating its first batch of content...'",
      },
      {
        order: 15,
        component: "Content Creation Pipeline",
        action: "Full pipeline runs: Strategy → Trends → Create → Hashtags → SEO → Voice → Predict → Compliance → Visual → Publisher",
        file: "lib/orchestrator/brain.ts",
        function: "runPipeline('content-creation')",
        inputs: "organizationId",
        outputs: "3-5 posts generated, queued for review (or auto-scheduled if autonomous mode)",
        missionControlEffect: "'Needs Attention' shows: '3 posts ready for review — publishing tomorrow 9am'",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════
  // CONTENT LIFECYCLE
  // ═══════════════════════════════════════════════════════
  {
    id: "content-lifecycle",
    name: "Content Creation → Publish → Evaluate",
    description: "Full lifecycle of a single piece of content from idea to performance evaluation",
    trigger: "Orchestrator content-creation pipeline (every 4 hours)",
    category: "scheduled",
    steps: [
      // ... 20+ steps covering the full content journey
      // Strategy → Create → Optimize → Check → Generate Visual → Queue → Approve → Publish → Track → Evaluate → Learn
    ],
  },

  // ... Define flows for every major path:
  // - engagement-flow
  // - crisis-flow
  // - billing-lifecycle
  // - talk-to-ai-flow
  // - weekly-reporting
  // - monthly-strategy
  // - content-approval
  // - failed-payment-dunning
  // - plan-change
  // - trial-ending
];

// Generate markdown documentation from flow definitions
function generateFlowDocs() {
  for (const flow of flows) {
    let md = `# ${flow.name}\n\n`;
    md += `> ${flow.description}\n\n`;
    md += `**Trigger:** ${flow.trigger}\n`;
    md += `**Category:** ${flow.category}\n\n`;
    md += `---\n\n`;

    for (const step of flow.steps) {
      md += `### Step ${step.order}: ${step.component}\n\n`;
      md += `**Action:** ${step.action}\n\n`;
      md += `- **File:** \`${step.file}\`\n`;
      md += `- **Function:** \`${step.function}\`\n`;
      md += `- **Input:** ${step.inputs}\n`;
      md += `- **Output:** ${step.outputs}\n`;
      if (step.database) md += `- **Database:** ${step.database}\n`;
      if (step.llmCall) md += `- **LLM Call:** ${step.llmCall.taskType} (${step.llmCall.tier} tier, ~${step.llmCall.estimatedTokens})\n`;
      if (step.humanRequired) md += `- **⏸️ Human input required**\n`;
      if (step.missionControlEffect) md += `- **Mission Control:** ${step.missionControlEffect}\n`;
      md += `\n`;
    }

    fs.writeFileSync(path.join("docs/flows", `${flow.id}.md`), md);
  }

  // Generate index
  let index = `# Platform Flows\n\nGenerated: ${new Date().toISOString()}\n\n`;
  for (const flow of flows) {
    index += `- [${flow.name}](./${flow.id}.md) — ${flow.description}\n`;
  }
  fs.writeFileSync("docs/flows/README.md", index);
}

generateFlowDocs();
```

---

## PART 3: OPTIMIZATION

### Dead Code Detection

```bash
#!/bin/bash
# scripts/qa-deadcode.sh

echo "=== Dead Code Detection ==="

# 1. Find unused exports
npx ts-prune --project tsconfig.json | grep -v "used in module" > reports/dead-exports.txt
echo "Unused exports: $(wc -l < reports/dead-exports.txt)"

# 2. Find unused dependencies
npx depcheck --ignores="@types/*,vitest,prettier" > reports/unused-deps.txt
echo "Unused dependencies found (see reports/unused-deps.txt)"

# 3. Find duplicate code
npx jscpd --min-lines 10 --min-tokens 50 --reporters "json" --output reports/ src/ lib/ agents/
echo "Duplicate code report: reports/jscpd-report.json"

# 4. Find unreachable code
npx knip --reporter json > reports/knip-report.json
echo "Unreachable code report: reports/knip-report.json"

echo ""
echo "Review reports/ directory and remove dead code."
```

### Database Query Optimization

```typescript
// scripts/qa-optimize.sh triggers this analysis:

// 1. Find N+1 queries — any loop that makes individual DB calls
// RULE: If you query inside a loop, refactor to batch query

// BAD:
for (const org of orgs) {
  const config = await prisma.organizationConfig.findUnique({ where: { organizationId: org.id } });
}

// GOOD:
const configs = await prisma.organizationConfig.findMany({
  where: { organizationId: { in: orgs.map(o => o.id) } },
});
const configMap = new Map(configs.map(c => [c.organizationId, c]));

// 2. Add missing indexes — check every WHERE clause has a corresponding index
// RULE: If a query filters on a column, that column needs an index

// 3. Use select() to only fetch needed columns
// BAD:
const orgs = await prisma.organization.findMany();
// GOOD:
const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
```

### Bundle Size Optimization

```typescript
// Check for oversized imports:
// BAD: import lodash from "lodash" (imports entire library)
// GOOD: import groupBy from "lodash/groupBy"

// BAD: import * as dateFns from "date-fns"
// GOOD: import { subDays, addDays, startOfMonth } from "date-fns"

// Use dynamic imports for heavy agent code:
// Agents are loaded on-demand, not all at app startup
const agent = await import(`@/agents/${agentName.toLowerCase()}`);
```

---

## PART 4: QA RUNNER SCRIPTS

```bash
#!/bin/bash
# scripts/qa-full.sh — Run everything

set -e

echo "╔══════════════════════════════════════════╗"
echo "║  PLATFORM QA — Full Suite                ║"
echo "╚══════════════════════════════════════════╝"

echo ""
echo "── 1. Type Checking ──────────────────────"
npx tsc --noEmit
echo "✅ Types OK"

echo ""
echo "── 2. Linting ────────────────────────────"
npx eslint . --max-warnings 0
echo "✅ Lint OK"

echo ""
echo "── 3. Unit Tests ─────────────────────────"
npx vitest run tests/unit/ --reporter=verbose
echo "✅ Unit tests passed"

echo ""
echo "── 4. Integration Tests ──────────────────"
npx vitest run tests/integration/ --reporter=verbose
echo "✅ Integration tests passed"

echo ""
echo "── 5. Coverage Report ────────────────────"
npx vitest run --coverage
echo "✅ Coverage report generated"

echo ""
echo "── 6. Dead Code Detection ────────────────"
bash scripts/qa-deadcode.sh
echo "✅ Dead code report generated"

echo ""
echo "── 7. Bundle Analysis ────────────────────"
npx next build 2>&1 | tail -20
echo "✅ Build succeeded"

echo ""
echo "── 8. Flow Documentation ─────────────────"
npx tsx tests/traces/generate-flows.ts
echo "✅ Flow docs generated in docs/flows/"

echo ""
echo "── 9. Prisma Validation ──────────────────"
npx prisma validate
npx prisma generate
echo "✅ Schema valid"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ ALL QA CHECKS PASSED                ║"
echo "╚══════════════════════════════════════════╝"
```

```bash
#!/bin/bash
# scripts/qa-test.sh — Tests only

npx vitest run --reporter=verbose
```

```bash
#!/bin/bash
# scripts/qa-trace.sh — Generate flow documentation only

npx tsx tests/traces/generate-flows.ts
echo "Flow docs generated in docs/flows/"
echo ""
echo "Available flows:"
ls -1 docs/flows/*.md
```

---

## Per-Agent Test Checklist

Every agent test file MUST cover these scenarios:

```
□ Happy path — agent receives valid input, produces expected output
□ Empty input — agent handles no data gracefully (no new comments, no new trends)
□ Memory integration — agent recalls relevant memories before executing
□ Memory storage — agent stores results in shared memory after executing
□ SmartRouter routing — agent's LLM calls route to correct tier
□ Billing gate — agent is skipped when not in org's plan
□ Error handling — agent handles LLM failures gracefully
□ Confidence scoring — output includes valid confidence score 0-1
□ Escalation — agent correctly escalates when confidence is below threshold
□ Pipeline context — agent uses previous agent results from pipeline context
□ Activity logging — agent's results produce human-readable activity log messages
□ Schema validation — output matches the agent's defined output schema
□ Do-not rules — agent respects org's do-not restrictions
□ Platform specificity — agent handles platform-specific differences
□ Idempotency — running the same input twice produces no duplicate side effects
```

---

## Coverage Targets

```
MINIMUM COVERAGE:
├── lib/router/          → 95% (SmartRouter is critical infrastructure)
├── lib/billing/         → 90% (billing errors = revenue loss)
├── lib/orchestrator/    → 90% (pipeline logic must be reliable)
├── lib/memory/          → 85% (memory store/recall/consolidation)
├── agents/              → 80% (each agent's core logic)
├── app/api/webhooks/    → 90% (webhook handlers must be bulletproof)
├── app/(mission-control)/ → 70% (UI components)
├── app/(admin)/         → 70% (admin UI)
└── Overall              → 80%
```

---

## Rules

1. **No PR merges without passing tests.** CI runs `qa-test.sh` on every PR. Red = blocked.
2. **Every new agent gets a test file.** Use the Per-Agent Test Checklist. No exceptions.
3. **Every new pipeline step gets integration tests.** Test the step in context, not just isolation.
4. **Flow traces are living documentation.** Update `flows.json` whenever a flow changes. Run `qa-trace.sh` to regenerate docs.
5. **Dead code is removed immediately.** Run `qa-deadcode.sh` weekly. If code has no callers, delete it.
6. **N+1 queries are banned.** Any loop with a database call inside is refactored to batch.
7. **Mock LLM calls in tests, never make real calls.** SmartRouter mock returns realistic per-agent responses. Tests are fast and free.
8. **Test billing webhooks thoroughly.** Simulate every Stripe event type: created, updated, payment_succeeded, payment_failed, canceled, trial_will_end. One missed webhook = lost revenue.
9. **Coverage report is reviewed weekly.** Any module dropping below target gets priority attention.
10. **When someone asks "how does X work?" — point them to `docs/flows/`.** If the doc doesn't answer the question, the doc is incomplete. Fix the doc.
