/**
 * AudienceIntelligenceAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { AudienceIntelligenceAgent } from "@/agents/audience-intelligence";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ demographics: { age: "25-34" }, interests: ["tech", "gaming"] }),
      usage: { inputTokens: 800, outputTokens: 400, cachedTokens: 0, totalTokens: 1200 },
      cost: { inputCost: 0.0024, outputCost: 0.006, cacheSavings: 0, totalCost: 0.0084 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "flagship" },
      classification: { tier: "flagship", taskType: "analysis" },
      latencyMs: 2000,
    }),
  },
}));

describe("AudienceIntelligenceAgent", () => {
  it("should initialize", () => {
    expect(new AudienceIntelligenceAgent()).toBeDefined();
  });

  it("should analyze audience", async () => {
    const agent = new AudienceIntelligenceAgent();
    const input = { organizationId: "org_123", platform: "INSTAGRAM" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
