/**
 * CompetitorIntelligenceAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { CompetitorIntelligenceAgent } from "@/agents/competitor-intelligence";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ competitors: ["CompA", "CompB"], gaps: ["video content"] }),
      usage: { inputTokens: 600, outputTokens: 400, cachedTokens: 0, totalTokens: 1000 },
      cost: { inputCost: 0.0018, outputCost: 0.006, cacheSavings: 0, totalCost: 0.0078 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "flagship" },
      classification: { tier: "flagship", taskType: "analysis" },
      latencyMs: 2000,
    }),
  },
}));

describe("CompetitorIntelligenceAgent", () => {
  it("should initialize", () => {
    expect(new CompetitorIntelligenceAgent()).toBeDefined();
  });

  it("should analyze competitors", async () => {
    const agent = new CompetitorIntelligenceAgent();
    const input = { organizationId: "org_123", industry: "tech" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
