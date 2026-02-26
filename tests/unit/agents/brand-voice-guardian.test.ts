/**
 * BrandVoiceGuardianAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { BrandVoiceGuardianAgent } from "@/agents/brand-voice-guardian";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ score: 0.9, violations: [], suggestions: ["Good tone"] }),
      usage: { inputTokens: 500, outputTokens: 300, cachedTokens: 0, totalTokens: 800 },
      cost: { inputCost: 0.0015, outputCost: 0.0045, cacheSavings: 0, totalCost: 0.006 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 1200,
    }),
  },
}));

describe("BrandVoiceGuardianAgent", () => {
  it("should initialize", () => {
    expect(new BrandVoiceGuardianAgent()).toBeDefined();
  });

  it("should check brand voice", async () => {
    const agent = new BrandVoiceGuardianAgent();
    const input = { organizationId: "org_123", content: "Hello world" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
