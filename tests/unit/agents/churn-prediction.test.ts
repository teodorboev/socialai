/**
 * ChurnPredictionAgent - Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { ChurnPredictionAgent } from "@/agents/churn-prediction";

vi.mock("@/lib/prisma", () => ({
  prisma: { agentLog: { create: vi.fn() }, escalation: { create: vi.fn() } },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ riskScore: 0.3, factors: ["low engagement"], actions: ["send email"] }),
      usage: { inputTokens: 600, outputTokens: 400, cachedTokens: 0, totalTokens: 1000 },
      cost: { inputCost: 0.0018, outputCost: 0.006, cacheSavings: 0, totalCost: 0.0078 },
      model: { id: "claude-sonnet", provider: "Anthropic", tier: "flagship" },
      classification: { tier: "flagship", taskType: "analysis" },
      latencyMs: 1800,
    }),
  },
}));

describe("ChurnPredictionAgent", () => {
  it("should initialize", () => {
    expect(new ChurnPredictionAgent()).toBeDefined();
  });

  it("should predict churn risk", async () => {
    const agent = new ChurnPredictionAgent();
    const input = { organizationId: "org_123", clientId: "client_123" } as any;
    const result = await agent.execute(input);
    expect(result.success).toBe(true);
  });
});
