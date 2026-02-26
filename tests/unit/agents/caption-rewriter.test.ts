/**
 * CaptionRewriterAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { CaptionRewriterAgent } from "@/agents/caption-rewriter";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ caption: "Rewritten caption", hashtags: ["#new"] }),
      usage: { inputTokens: 500, outputTokens: 200, cachedTokens: 0, totalTokens: 700 },
      cost: { inputCost: 0.0015, outputCost: 0.003, cacheSavings: 0, totalCost: 0.0045 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "generation" },
      latencyMs: 1000,
    }),
  },
}));

describe("CaptionRewriterAgent", () => {
  it("should initialize", () => {
    expect(new CaptionRewriterAgent()).toBeDefined();
  });

  it("should rewrite caption", async () => {
    const agent = new CaptionRewriterAgent();
    // Using any to bypass complex type matching for test purposes
    const input = {
      organizationId: "org_123",
      originalCaption: "Old caption",
      platform: "INSTAGRAM",
      contentType: "POST",
      issues: ["low engagement"],
      targetMetrics: { primaryGoal: "engagement" },
      brandVoice: { tone: ["friendly"], doNots: [] },
    } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
