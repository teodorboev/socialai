/**
 * CommunityBuilderAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { CommunityBuilderAgent } from "@/agents/community-builder";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ initiatives: ["AMA", "Challenge"], superfans: ["user1", "user2"] }),
      usage: { inputTokens: 500, outputTokens: 300, cachedTokens: 0, totalTokens: 800 },
      cost: { inputCost: 0.0015, outputCost: 0.0045, cacheSavings: 0, totalCost: 0.006 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 1500,
    }),
  },
}));

describe("CommunityBuilderAgent", () => {
  it("should initialize", () => {
    expect(new CommunityBuilderAgent()).toBeDefined();
  });

  it("should identify community opportunities", async () => {
    const agent = new CommunityBuilderAgent();
    const input = { organizationId: "org_123" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
