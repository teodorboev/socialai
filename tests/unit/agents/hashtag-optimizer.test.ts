/**
 * HashtagOptimizerAgent - Unit Tests
 * 
 * Tests for hashtag optimization:
 * - Performance analysis
 * - Hashtag recommendations
 * - Strategy optimization
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HashtagOptimizerAgent } from "@/agents/hashtag-optimizer";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        recommended: ["#innovation", "#tech", "#startup"],
        trending: ["#AI", "#future"],
        banned: ["#spam"],
        strategy: "Mix of niche and broad hashtags",
      }),
      usage: { inputTokens: 500, outputTokens: 300, cachedTokens: 0, totalTokens: 800 },
      cost: { inputCost: 0.0015, outputCost: 0.0045, cacheSavings: 0, totalCost: 0.006 },
      model: { id: "claude-haiku", provider: "Anthropic", tier: "budget" },
      classification: { tier: "budget", taskType: "classification" },
      latencyMs: 800,
    }),
  },
}));

describe("HashtagOptimizerAgent", () => {
  it("should initialize", () => {
    const agent = new HashtagOptimizerAgent();
    expect(agent).toBeDefined();
  });

  it("should optimize hashtags", async () => {
    const agent = new HashtagOptimizerAgent();
    const input = {
      organizationId: "org_123",
      brandName: "TestBrand",
      content: "Check out our new product launch!",
      platform: "INSTAGRAM",
      industry: "technology",
      targetAudience: { interests: ["technology", "innovation"] },
    };
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
