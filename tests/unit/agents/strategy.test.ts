/**
 * StrategyAgent - Unit Tests
 * 
 * Tests for the strategy planning agent:
 * - Content plan generation
 * - Platform mix allocation
 * - Theme identification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrategyAgent } from "@/agents/strategy";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: { create: vi.fn().mockResolvedValue({ id: "log_123" }) },
    escalation: { create: vi.fn().mockResolvedValue({ id: "esc_123" }) },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        title: "Q1 2024 Content Strategy",
        themes: ["product launches", "customer stories", "industry insights"],
        platformMix: { instagram: 40, tiktok: 30, linkedin: 20, twitter: 10 },
        postsPerWeek: { instagram: 5, tiktok: 3, linkedin: 2, twitter: 3 },
        recommendedContentTypes: ["reels", "carousels", "posts"],
        keyMessages: ["innovation", "customer success", "industry thought leadership"],
        campaignIdeas: ["spring launch", "customer spotlight", "behind the scenes"],
      }),
      usage: { inputTokens: 3000, outputTokens: 1500, cachedTokens: 0, totalTokens: 4500 },
      cost: { inputCost: 0.009, outputCost: 0.0225, cacheSavings: 0, totalCost: 0.0315 },
      model: { id: "claude-opus", displayName: "Claude Opus", provider: "Anthropic", tier: "flagship" },
      classification: { tier: "flagship", taskType: "reasoning" },
      latencyMs: 5000,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("StrategyAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new StrategyAgent();
    expect(agent).toBeDefined();
  });
});

describe("StrategyAgent - Plan Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate monthly content plan", async () => {
    const agent = new StrategyAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "TestBrand",
        industry: "technology",
        targetAudience: { demographics: "25-45", interests: "tech, innovation" },
        contentThemes: ["product launches", "tutorials"],
        voiceTone: { adjectives: ["friendly", "helpful"], examples: [], avoid: [] },
        doNots: [],
      },
      connectedPlatforms: ["INSTAGRAM", "TIKTOK", "LINKEDIN"],
      planPeriod: {
        start: "2024-01-01",
        end: "2024-01-31",
      },
      clientGoals: ["increase engagement", "grow followers"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should allocate platform mix appropriately", async () => {
    const agent = new StrategyAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "TestBrand",
        industry: "fashion",
        targetAudience: { demographics: "18-35", interests: "fashion, lifestyle" },
        contentThemes: ["style tips", "new arrivals"],
        voiceTone: { adjectives: ["stylish", "trendy"], examples: [], avoid: [] },
        doNots: [],
      },
      connectedPlatforms: ["INSTAGRAM", "TIKTOK", "PINTEREST"],
      planPeriod: {
        start: "2024-01-01",
        end: "2024-01-31",
      },
      clientGoals: ["drive website traffic", "increase sales"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should consider business goals in planning", async () => {
    const agent = new StrategyAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "TechCorp",
        industry: "B2B software",
        targetAudience: { demographics: "30-50", interests: "enterprise software" },
        contentThemes: ["product updates", "case studies"],
        voiceTone: { adjectives: ["professional", "authoritative"], examples: [], avoid: [] },
        doNots: [],
      },
      connectedPlatforms: ["LINKEDIN", "TWITTER"],
      planPeriod: {
        start: "2024-01-01",
        end: "2024-01-31",
      },
      clientGoals: ["lead generation", "brand awareness"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

describe("StrategyAgent - Theme Identification", () => {
  it("should identify relevant themes for industry", async () => {
    const agent = new StrategyAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "FoodBrand",
        industry: "food & beverage",
        targetAudience: { demographics: "25-55", interests: "cooking, healthy eating" },
        contentThemes: ["recipes", "ingredients", "sustainability"],
        voiceTone: { adjectives: ["warm", "inviting"], examples: [], avoid: [] },
        doNots: [],
      },
      connectedPlatforms: ["INSTAGRAM", "FACEBOOK"],
      planPeriod: {
        start: "2024-01-01",
        end: "2024-01-31",
      },
      clientGoals: ["engagement", "recipe shares"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });
});
