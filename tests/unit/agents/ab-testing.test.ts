/**
 * AbTestingAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { ABTestingAgent } from "@/agents/ab-testing";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ experimentId: "exp_123", variants: ["A", "B"], winner: "A" }),
      usage: { inputTokens: 500, outputTokens: 300, cachedTokens: 0, totalTokens: 800 },
      cost: { inputCost: 0.0015, outputCost: 0.0045, cacheSavings: 0, totalCost: 0.006 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 1500,
    }),
  },
}));

describe("ABTestingAgent", () => {
  it("should initialize", () => {
    expect(new ABTestingAgent()).toBeDefined();
  });

  it("should create experiment", async () => {
    const agent = new ABTestingAgent();
    const input = { organizationId: "org_123", contentIdA: "c1", contentIdB: "c2" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
