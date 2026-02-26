/**
 * ComplianceAgent - Unit Tests
 * 
 * Tests for the compliance agent:
 * - Content safety checking
 * - Platform policy compliance
 * - Brand guideline enforcement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComplianceAgent } from "@/agents/compliance";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: { create: vi.fn().mockResolvedValue({ id: "log_123" }) },
    escalation: { create: vi.fn().mockResolvedValue({ id: "esc_123" }) },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        isCompliant: true,
        issues: [],
        warnings: [],
        score: 0.95,
        recommendations: ["Content looks good"],
      }),
      usage: { inputTokens: 500, outputTokens: 300, cachedTokens: 0, totalTokens: 800 },
      cost: { inputCost: 0.0015, outputCost: 0.0045, cacheSavings: 0, totalCost: 0.006 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "moderation" },
      latencyMs: 1000,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("ComplianceAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new ComplianceAgent();
    expect(agent).toBeDefined();
  });
});

describe("ComplianceAgent - Content Checking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve compliant content", async () => {
    const agent = new ComplianceAgent();
    const input = {
      organizationId: "org_123",
      contentId: "content_123",
      content: {
        caption: "Check out our amazing new product! It's revolutionizing the industry.",
        hashtags: ["#innovation", "#tech", "#product"],
        contentType: "POST",
        platform: "INSTAGRAM",
      },
      brandConfig: {
        brandName: "TestBrand",
        industry: "technology",
        doNots: ["no competitors", "no negative language"],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should check platform policies", async () => {
    const agent = new ComplianceAgent();
    const input = {
      organizationId: "org_123",
      contentId: "content_456",
      content: {
        caption: "Great product!",
        hashtags: [],
        contentType: "POST",
        platform: "INSTAGRAM",
      },
      brandConfig: {
        brandName: "TestBrand",
        industry: "general",
        doNots: [],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should check multiple platforms", async () => {
    const agent = new ComplianceAgent();
    const platforms = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER"];

    for (const platform of platforms) {
      const input = {
        organizationId: "org_123",
        contentId: `content_${platform}`,
        content: {
          caption: "Great product!",
          hashtags: [],
          contentType: "POST",
          platform,
        },
        brandConfig: {
          brandName: "TestBrand",
          industry: "general",
          doNots: [],
        },
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(true);
    }
  });
});

describe("ComplianceAgent - Safety", () => {
  it("should evaluate content safety", async () => {
    const agent = new ComplianceAgent();
    const input = {
      organizationId: "org_123",
      contentId: "content_safety",
      content: {
        caption: "This is amazing!!!",
        hashtags: [],
        contentType: "POST",
        platform: "INSTAGRAM",
      },
      brandConfig: {
        brandName: "TestBrand",
        industry: "general",
        doNots: [],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
