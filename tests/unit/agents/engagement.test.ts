/**
 * EngagementAgent - Unit Tests
 * 
 * Tests for the engagement agent:
 * - Comment response generation
 * - DM handling
 * - Sentiment analysis
 * - Escalation triggers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EngagementAgent } from "@/agents/engagement";
import { Platform, EngagementType } from "@prisma/client";

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
        response: "Thanks for your feedback! We're always looking to improve.",
        sentiment: "POSITIVE",
        confidenceScore: 0.92,
        shouldRespond: true,
        reasoning: "Positive feedback that deserves a friendly response",
      }),
      usage: { inputTokens: 500, outputTokens: 200, cachedTokens: 0, totalTokens: 700 },
      cost: { inputCost: 0.0015, outputCost: 0.003, cacheSavings: 0, totalCost: 0.0045 },
      model: { id: "claude-haiku", displayName: "Claude Haiku", provider: "Anthropic", tier: "budget" },
      classification: { tier: "budget", taskType: "classification" },
      latencyMs: 800,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("EngagementAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new EngagementAgent();
    expect(agent).toBeDefined();
  });
});

describe("EngagementAgent - Comment Response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should respond to positive comments", async () => {
    const agent = new EngagementAgent();
    const input = {
      organizationId: "org_123",
      platform: Platform.INSTAGRAM,
      engagement: {
        type: EngagementType.COMMENT,
        authorName: "John Doe",
        authorUsername: "johndoe",
        body: "Love your products! Just ordered the premium pack.",
      },
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: {
          adjectives: ["friendly", "helpful"],
          examples: ["Thanks for your support!"],
          avoid: ["cold"],
        },
        faqKnowledge: [
          { question: "shipping", answer: "Free shipping over $50", category: "shipping" },
          { question: "returns", answer: "30-day return policy", category: "returns" },
        ],
        doNots: ["never promise refunds publicly"],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should handle negative comments", async () => {
    const agent = new EngagementAgent();
    const input = {
      organizationId: "org_123",
      platform: Platform.INSTAGRAM,
      engagement: {
        type: EngagementType.COMMENT,
        authorName: "Jane Smith",
        authorUsername: "janesmith",
        body: "The product arrived damaged. Very disappointed.",
      },
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: { adjectives: ["empathetic"], examples: [], avoid: [] },
        faqKnowledge: [],
        doNots: [],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });
});

describe("EngagementAgent - DM Handling", () => {
  it("should handle direct messages", async () => {
    const agent = new EngagementAgent();
    const input = {
      organizationId: "org_123",
      platform: Platform.INSTAGRAM,
      engagement: {
        type: EngagementType.DIRECT_MESSAGE,
        authorName: "Customer123",
        authorUsername: "customer123",
        body: "Hi, do you ship internationally?",
      },
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: { adjectives: ["helpful"], examples: [], avoid: [] },
        faqKnowledge: [
          { question: "shipping", answer: "Yes, we ship to 50+ countries", category: "shipping" },
        ],
        doNots: [],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should escalate urgent DMs", async () => {
    const agent = new EngagementAgent();
    const input = {
      organizationId: "org_123",
      platform: Platform.INSTAGRAM,
      engagement: {
        type: EngagementType.DIRECT_MESSAGE,
        authorName: "AngryCustomer",
        authorUsername: "angrycustomer",
        body: "This is unacceptable! I'm calling my lawyer!",
      },
      brandConfig: {
        brandName: "TestBrand",
        voiceTone: { adjectives: [], examples: [], avoid: [] },
        faqKnowledge: [],
        doNots: [],
      },
    };

    const result = await agent.execute(input);

    // Urgent messages should escalate
    expect(result.shouldEscalate || result.confidenceScore < 0.7).toBe(true);
  });
});

describe("EngagementAgent - Sentiment Detection", () => {
  it("should detect positive sentiment", async () => {
    const positiveWords = ["love", "great", "amazing", "thank you", "awesome"];
    
    for (const word of positiveWords) {
      const agent = new EngagementAgent();
      const input = {
        organizationId: "org_123",
        platform: Platform.INSTAGRAM,
        engagement: {
          type: EngagementType.COMMENT,
          authorName: "User",
          authorUsername: "user123",
          body: `I ${word} this product!`,
        },
        brandConfig: {
          brandName: "TestBrand",
          voiceTone: { adjectives: [], examples: [], avoid: [] },
          faqKnowledge: [],
          doNots: [],
        },
      };

      const result = await agent.execute(input);
      expect(result.success).toBe(true);
    }
  });

  it("should handle negative sentiment", async () => {
    const negativeWords = ["terrible", "worst", "hate", "disappointed"];
    
    for (const word of negativeWords) {
      const agent = new EngagementAgent();
      const input = {
        organizationId: "org_123",
        platform: Platform.INSTAGRAM,
        engagement: {
          type: EngagementType.COMMENT,
          authorName: "User",
          authorUsername: "user123",
          body: `This is ${word}!`,
        },
        brandConfig: {
          brandName: "TestBrand",
          voiceTone: { adjectives: [], examples: [], avoid: [] },
          faqKnowledge: [],
          doNots: [],
        },
      };

      const result = await agent.execute(input);
      expect(result).toBeDefined();
    }
  });
});
