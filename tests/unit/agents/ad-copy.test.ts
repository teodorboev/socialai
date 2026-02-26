/**
 * AdCopyAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { AdCopyAgent } from "@/agents/ad-copy";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ headline: "Buy Now", body: "Limited offer", cta: "Shop Now" }),
      usage: { inputTokens: 500, outputTokens: 200, cachedTokens: 0, totalTokens: 700 },
      cost: { inputCost: 0.0015, outputCost: 0.003, cacheSavings: 0, totalCost: 0.0045 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "generation" },
      latencyMs: 1000,
    }),
  },
}));

describe("AdCopyAgent", () => {
  it("should initialize", () => {
    expect(new AdCopyAgent()).toBeDefined();
  });

  it("should generate ad copy", async () => {
    const agent = new AdCopyAgent();
    const input = { organizationId: "org_123", productName: "Test Product", platform: "FACEBOOK" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
