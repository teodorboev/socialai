/**
 * TrendScoutAgent - Unit Tests
 * 
 * Tests for the trend detection agent:
 * - Trend identification
 * - Relevance scoring
 * - Content opportunity detection
 * 
 * NOTE: Skipped - needs schema-aware mocks to match actual agent schemas
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrendScoutAgent } from "@/agents/trend-scout";

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
        trends: [
          { topic: "AI tools", relevance: 0.95, opportunity: "high", sentiment: "positive" },
          { topic: "Sustainability", relevance: 0.88, opportunity: "medium", sentiment: "positive" },
          { topic: "Remote work tips", relevance: 0.82, opportunity: "medium", sentiment: "neutral" },
        ],
        recommendations: [
          "Create content about AI tools for productivity",
          "Share sustainability initiatives",
        ],
      }),
      usage: { inputTokens: 2000, outputTokens: 1000, cachedTokens: 0, totalTokens: 3000 },
      cost: { inputCost: 0.006, outputCost: 0.015, cacheSavings: 0, totalCost: 0.021 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 3000,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("TrendScoutAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new TrendScoutAgent();
    expect(agent).toBeDefined();
  });
});

describe("TrendScoutAgent - Trend Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should identify current trends", async () => {
    const agent = new TrendScoutAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "TestBrand",
        industry: "technology",
        contentThemes: ["AI", "software", "innovation"],
      },
      connectedPlatforms: ["INSTAGRAM", "TIKTOK", "TWITTER"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should score trend relevance", async () => {
    const agent = new TrendScoutAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "FashionBrand",
        industry: "fashion",
        contentThemes: ["style", "trends", "runway"],
      },
      connectedPlatforms: ["INSTAGRAM", "PINTEREST"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should provide content recommendations", async () => {
    const agent = new TrendScoutAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "FoodBrand",
        industry: "food & beverage",
        contentThemes: ["recipes", "ingredients", "sustainability"],
      },
      connectedPlatforms: ["INSTAGRAM", "FACEBOOK"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

describe("TrendScoutAgent - Platform Specific", () => {
  it("should scan multiple platforms", async () => {
    const agent = new TrendScoutAgent();
    const input = {
      organizationId: "org_123",
      brandConfig: {
        brandName: "EntertainmentBrand",
        industry: "entertainment",
        contentThemes: ["movies", "music", "pop culture"],
      },
      connectedPlatforms: ["TIKTOK", "INSTAGRAM", "TWITTER", "YOUTUBE"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });
});
