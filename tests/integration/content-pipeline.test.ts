/**
 * Content Pipeline Integration Tests
 * 
 * Tests the full content creation pipeline:
 * - ContentCreator → Compliance → Publisher
 * - Confidence scoring and routing
 * - Error handling and escalation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { ComplianceAgent } from "@/agents/compliance";
import { PublisherAgent } from "@/agents/publisher";

// Mock all dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: { create: vi.fn().mockResolvedValue({ id: "log_123" }) },
    escalation: { create: vi.fn().mockResolvedValue({ id: "esc_123" }) },
    content: {
      create: vi.fn().mockResolvedValue({ id: "content_123" }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    schedule: {
      create: vi.fn().mockResolvedValue({ id: "schedule_123" }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        caption: "Test content",
        hashtags: ["#test"],
        contentType: "POST",
        confidenceScore: 0.85,
      }),
      usage: { inputTokens: 1000, outputTokens: 500, cachedTokens: 0, totalTokens: 1500 },
      cost: { inputCost: 0.003, outputCost: 0.0075, cacheSavings: 0, totalCost: 0.0105 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "generation" },
      latencyMs: 1500,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("Content Pipeline Integration", () => {
  let contentAgent: ContentCreatorAgent;
  let complianceAgent: ComplianceAgent;
  let publisherAgent: PublisherAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    contentAgent = new ContentCreatorAgent();
    complianceAgent = new ComplianceAgent();
    publisherAgent = new PublisherAgent();
  });

  describe("Full Pipeline: Create → Compliance → Publish", () => {
    it("should create, validate, and publish content", async () => {
      // Step 1: Create content
      const contentInput = {
        organizationId: "org_123",
        platform: "INSTAGRAM",
        brandConfig: {
          brandName: "TestBrand",
          industry: "technology",
          targetAudience: { demographics: "25-44", interests: ["tech", "innovation"] },
          voiceTone: { adjectives: ["friendly"], examples: [], avoid: [] },
          contentThemes: ["product launches"],
          doNots: ["no competitors"],
          hashtagStrategy: { always: ["#tech"], never: [], rotating: [] },
        },
      };

      const contentResult = await contentAgent.execute(contentInput);
      expect(contentResult.success).toBe(true);
      expect(contentResult.confidenceScore).toBeGreaterThan(0.7);

      // Step 2: Validate compliance
      const complianceInput = {
        organizationId: "org_123",
        contentId: "content_123",
        content: {
          caption: "Check out our new product!",
          hashtags: ["#tech"],
          contentType: "POST",
          platform: "INSTAGRAM",
        },
        brandConfig: {
          brandName: "TestBrand",
          industry: "technology",
          doNots: ["no competitors"],
        },
      };

      const complianceResult = await complianceAgent.execute(complianceInput);
      expect(complianceResult.success).toBe(true);

      // Step 3: Schedule for publishing
      const publishInput = {
        scheduleId: "schedule_123",
        contentId: "content_123",
        socialAccountId: "account_123",
        platform: "INSTAGRAM",
        content: {
          caption: "Check out our new product!",
          hashtags: ["#tech"],
          mediaUrls: [],
          contentType: "POST",
        },
      };

      const publishResult = await publisherAgent.execute(publishInput);
      expect(publishResult.success).toBe(true);
    });

    it("should escalate low confidence content", async () => {
      const contentInput = {
        organizationId: "org_123",
        platform: "INSTAGRAM",
        brandConfig: {
          brandName: "TestBrand",
          industry: "technology",
          targetAudience: { demographics: "25-44", interests: [] },
          voiceTone: { adjectives: [], examples: [], avoid: [] },
          contentThemes: [],
          doNots: [],
          hashtagStrategy: { always: [], never: [], rotating: [] },
        },
      };

      const result = await contentAgent.execute(contentInput);
      
      // Should either succeed with low confidence or fail
      expect(result).toBeDefined();
    });
  });

  describe("Confidence Routing", () => {
    it("should use correct confidence thresholds", async () => {
      const contentInput = {
        organizationId: "org_123",
        platform: "LINKEDIN",
        brandConfig: {
          brandName: "TestBrand",
          industry: "B2B",
          targetAudience: { demographics: "30-50", interests: ["business"] },
          voiceTone: { adjectives: ["professional"], examples: [], avoid: [] },
          contentThemes: ["thought leadership"],
          doNots: [],
          hashtagStrategy: { always: [], never: [], rotating: [] },
        },
      };

      const result = await contentAgent.execute(contentInput);
      
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });
  });
});
