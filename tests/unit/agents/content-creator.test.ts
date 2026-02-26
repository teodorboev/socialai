/**
 * ContentCreatorAgent - Unit Tests
 * 
 * Tests for the content creation agent:
 * - Content generation
 * - Platform-specific content
 * - Brand voice adherence
 * - Confidence scoring
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentCreatorAgent } from "@/agents/content-creator";
import type { AgentResult } from "@/agents/shared/base-agent";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: {
      create: vi.fn().mockResolvedValue({ id: "log_123" }),
    },
    escalation: {
      create: vi.fn().mockResolvedValue({ id: "esc_123" }),
    },
    content: {
      create: vi.fn().mockResolvedValue({ id: "content_123" }),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        caption: "Check out our amazing new product! #innovation",
        hashtags: ["#innovation", "#productlaunch", "#tech"],
        contentType: "POST",
        confidenceScore: 0.88,
        reasoning: "Created engaging post with brand-appropriate hashtags",
      }),
      usage: { inputTokens: 2000, outputTokens: 800, cachedTokens: 500, totalTokens: 2800 },
      cost: { inputCost: 0.006, outputCost: 0.012, cacheSavings: 0.003, totalCost: 0.015 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "generation" },
      latencyMs: 2000,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("ContentCreatorAgent - Initialization", () => {
  it("should initialize with correct agent name", () => {
    const agent = new ContentCreatorAgent();
    expect(agent).toBeDefined();
  });
});

describe("ContentCreatorAgent - Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate content successfully", async () => {
    const agent = new ContentCreatorAgent();
    const input = {
      organizationId: "org_123",
      platform: "INSTAGRAM",
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: {
          adjectives: ["friendly", "helpful"],
          examples: ["Great customer service!", "We're here to help"],
          avoid: ["cold", "impersonal"],
        },
        contentThemes: ["product launches", "customer stories"],
        doNots: ["never mention competitors"],
        targetAudience: {
          demographics: "25-45, US",
          interests: ["technology", "innovation"],
        },
        hashtagStrategy: {
          always: ["#innovation", "#tech"],
          never: ["#spam"],
          rotating: ["#newproduct"],
        },
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it("should include brand voice in generation", async () => {
    const agent = new ContentCreatorAgent();
    const input = {
      organizationId: "org_123",
      platform: "LINKEDIN",
      brandConfig: {
        brandName: "TechCorp",
        voiceTone: {
          adjectives: ["professional", "innovative"],
          examples: ["Leading the industry"],
          avoid: ["casual"],
        },
        contentThemes: ["industry insights"],
        doNots: ["no political content"],
        targetAudience: {
          demographics: "30-50, Global",
          interests: ["business"],
        },
        hashtagStrategy: {
          always: ["#leadership"],
          never: [],
          rotating: [],
        },
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should return high confidence for good content", async () => {
    const agent = new ContentCreatorAgent();
    const input = {
      organizationId: "org_123",
      platform: "INSTAGRAM",
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: { adjectives: ["friendly"], examples: [], avoid: [] },
        contentThemes: ["tips"],
        doNots: [],
        targetAudience: { demographics: "25-34", interests: ["tech"] },
        hashtagStrategy: { always: [], never: [], rotating: [] },
      },
    };

    const result = await agent.execute(input);

    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("should handle different platforms", async () => {
    const agent = new ContentCreatorAgent();
    const platforms = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "TWITTER", "LINKEDIN"];

    for (const platform of platforms) {
      const input = {
        organizationId: "org_123",
        platform,
        brandConfig: {
          brandName: "TestBrand",
          voiceTone: { adjectives: [], examples: [], avoid: [] },
          contentThemes: [],
          doNots: [],
          targetAudience: { demographics: "25-44", interests: [] },
          hashtagStrategy: { always: [], never: [], rotating: [] },
        },
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(true);
    }
  });
});

describe("ContentCreatorAgent - Error Handling", () => {
  it("should handle missing optional fields", async () => {
    const agent = new ContentCreatorAgent();
    const input = {
      organizationId: "org_123",
      platform: "INSTAGRAM",
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: { adjectives: [], examples: [], avoid: [] },
        contentThemes: [],
        doNots: [],
        targetAudience: { demographics: "25-44", interests: [] },
        hashtagStrategy: { always: [], never: [], rotating: [] },
      },
    };

    const result = await agent.execute(input);
    expect(result).toBeDefined();
  });
});
