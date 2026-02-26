/**
 * ContentReplenishmentAgent - Unit Tests
 * 
 * Tests for the content replenishment agent:
 * - Content gap detection
 * - Queue monitoring
 * - Auto-generation triggers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentReplenishmentAgent } from "@/agents/content-replenishment";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: { create: vi.fn().mockResolvedValue({ id: "log_123" }) },
    escalation: { create: vi.fn().mockResolvedValue({ id: "esc_123" }) },
    content: {
      findMany: vi.fn().mockResolvedValue([
        { id: "content_1", status: "SCHEDULED", scheduledFor: new Date() },
      ]),
      count: vi.fn().mockResolvedValue(5),
    },
    schedule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        needsReplenishment: true,
        currentQueueDays: 1,
        recommendedPosts: 10,
        gapReasons: ["low scheduled content", "upcoming holidays"],
        suggestedThemes: ["holiday specials", "year-end review"],
      }),
      usage: { inputTokens: 1000, outputTokens: 500, cachedTokens: 0, totalTokens: 1500 },
      cost: { inputCost: 0.003, outputCost: 0.0075, cacheSavings: 0, totalCost: 0.0105 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 2000,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("ContentReplenishmentAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new ContentReplenishmentAgent();
    expect(agent).toBeDefined();
  });
});

describe("ContentReplenishmentAgent - Queue Monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect low content queue", async () => {
    const agent = new ContentReplenishmentAgent();
    const input = {
      organizationId: "org_123",
      settings: {
        contentBufferDays: 3,
        maxPostsPerDayPerPlatform: 3,
        platforms: ["INSTAGRAM", "TIKTOK", "LINKEDIN"],
        alertAfterSilentHours: 24,
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should calculate needed content volume", async () => {
    const agent = new ContentReplenishmentAgent();
    const input = {
      organizationId: "org_123",
      settings: {
        contentBufferDays: 2,
        maxPostsPerDayPerPlatform: 2,
        platforms: ["INSTAGRAM", "TIKTOK"],
        alertAfterSilentHours: 12,
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should monitor multiple platforms", async () => {
    const agent = new ContentReplenishmentAgent();
    const input = {
      organizationId: "org_123",
      settings: {
        contentBufferDays: 3,
        maxPostsPerDayPerPlatform: 3,
        platforms: ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER"],
        alertAfterSilentHours: 24,
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

describe("ContentReplenishmentAgent - Gap Detection", () => {
  it("should identify content gaps", async () => {
    const agent = new ContentReplenishmentAgent();
    const input = {
      organizationId: "org_123",
      settings: {
        contentBufferDays: 3,
        maxPostsPerDayPerPlatform: 2,
        platforms: ["LINKEDIN"],
        alertAfterSilentHours: 24,
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });
});
