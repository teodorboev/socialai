/**
 * AnalyticsAgent - Unit Tests
 * 
 * Tests for the analytics agent:
 * - Metrics collection
 * - Performance analysis
 * - Report generation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsAgent } from "@/agents/analytics";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: { create: vi.fn().mockResolvedValue({ id: "log_123" }) },
    escalation: { create: vi.fn().mockResolvedValue({ id: "esc_123" }) },
    analyticsSnapshot: {
      findMany: vi.fn().mockResolvedValue([
        { followers: 1000, impressions: 5000, engagementRate: 0.05, snapshotDate: new Date() },
        { followers: 1100, impressions: 5500, engagementRate: 0.06, snapshotDate: new Date() },
      ]),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        totalPosts: 30,
        avgEngagementRate: 0.055,
        followerGrowth: 10,
        topPerformingContent: [
          { caption: "Post 1", engagementRate: 0.12 },
        ],
        recommendations: ["Post more video content"],
      }),
      usage: { inputTokens: 1500, outputTokens: 800, cachedTokens: 0, totalTokens: 2300 },
      cost: { inputCost: 0.0045, outputCost: 0.012, cacheSavings: 0, totalCost: 0.0165 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 2500,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("AnalyticsAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new AnalyticsAgent();
    expect(agent).toBeDefined();
  });
});

describe("AnalyticsAgent - Report Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate weekly report", async () => {
    const agent = new AnalyticsAgent();
    const input = {
      organizationId: "org_123",
      brandName: "TestBrand",
      periodDays: 7,
      snapshots: [
        {
          platform: "INSTAGRAM",
          followers: 1000,
          followersChange: 10,
          impressions: 5000,
          reach: 4000,
          engagementRate: 0.05,
          clicks: 100,
          shares: 50,
          saves: 30,
          snapshotDate: new Date(),
        },
      ],
      contentPerformance: [
        {
          contentId: "content_1",
          platform: "INSTAGRAM",
          contentType: "POST",
          caption: "Test post",
          impressions: 1000,
          engagement: 50,
          engagementRate: 0.05,
          clicks: 20,
          shares: 10,
          saves: 5,
          publishedAt: new Date(),
        },
      ],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should generate monthly report", async () => {
    const agent = new AnalyticsAgent();
    const input = {
      organizationId: "org_123",
      brandName: "TestBrand",
      periodDays: 30,
      snapshots: [
        {
          platform: "INSTAGRAM",
          followers: 1100,
          followersChange: 100,
          impressions: 50000,
          reach: 40000,
          engagementRate: 0.055,
          clicks: 1000,
          shares: 500,
          saves: 300,
          snapshotDate: new Date(),
        },
      ],
      contentPerformance: [],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should include previous recommendations context", async () => {
    const agent = new AnalyticsAgent();
    const input = {
      organizationId: "org_123",
      brandName: "TestBrand",
      periodDays: 7,
      snapshots: [
        {
          platform: "INSTAGRAM",
          followers: 1000,
          followersChange: 0,
          impressions: 5000,
          reach: 4000,
          engagementRate: 0.05,
          clicks: 100,
          shares: 50,
          saves: 30,
          snapshotDate: new Date(),
        },
      ],
      contentPerformance: [],
      previousRecommendations: ["Post more video content", "Use more hashtags"],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

describe("AnalyticsAgent - Multi-Platform", () => {
  it("should handle multiple platforms", async () => {
    const agent = new AnalyticsAgent();
    const input = {
      organizationId: "org_123",
      brandName: "TestBrand",
      periodDays: 7,
      snapshots: [
        {
          platform: "INSTAGRAM",
          followers: 1000,
          followersChange: 10,
          impressions: 5000,
          reach: 4000,
          engagementRate: 0.05,
          clicks: 100,
          shares: 50,
          saves: 30,
          snapshotDate: new Date(),
        },
        {
          platform: "FACEBOOK",
          followers: 2000,
          followersChange: 20,
          impressions: 10000,
          reach: 8000,
          engagementRate: 0.03,
          clicks: 200,
          shares: 100,
          saves: 0,
          snapshotDate: new Date(),
        },
      ],
      contentPerformance: [],
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });
});
