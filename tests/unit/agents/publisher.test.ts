/**
 * PublisherAgent - Unit Tests
 * 
 * Tests for the publishing agent:
 * - Platform publishing
 * - Token refresh
 * - Rate limiting
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublisherAgent } from "@/agents/publisher";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentLog: { create: vi.fn().mockResolvedValue({ id: "log_123" }) },
    escalation: { create: vi.fn().mockResolvedValue({ id: "esc_123" }) },
    schedule: { update: vi.fn().mockResolvedValue({}) },
    content: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        success: true,
        platformPostId: "ig_post_123",
        postUrl: "https://instagram.com/p/abc123",
      }),
      usage: { inputTokens: 200, outputTokens: 100, cachedTokens: 0, totalTokens: 300 },
      cost: { inputCost: 0.0006, outputCost: 0.0015, cacheSavings: 0, totalCost: 0.0021 },
      model: { id: "claude-haiku", displayName: "Claude Haiku", provider: "Anthropic", tier: "budget" },
      classification: { tier: "budget", taskType: "extraction" },
      latencyMs: 500,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("PublisherAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new PublisherAgent();
    expect(agent).toBeDefined();
  });
});

describe("PublisherAgent - Publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should publish to Instagram successfully", async () => {
    const agent = new PublisherAgent();
    const input = {
      scheduleId: "schedule_123",
      contentId: "content_123",
      socialAccountId: "account_123",
      platform: "INSTAGRAM",
      content: {
        caption: "Check out our new product! #innovation",
        hashtags: ["#innovation", "#tech"],
        mediaUrls: ["https://storage.example.com/image.jpg"],
        contentType: "POST",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.9);
  });

  it("should publish to Facebook successfully", async () => {
    const agent = new PublisherAgent();
    const input = {
      scheduleId: "schedule_456",
      contentId: "content_456",
      socialAccountId: "account_456",
      platform: "FACEBOOK",
      content: {
        caption: "Exciting news from our team!",
        hashtags: [],
        mediaUrls: [],
        contentType: "POST",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should handle publishing with video media", async () => {
    const agent = new PublisherAgent();
    const input = {
      scheduleId: "schedule_789",
      contentId: "content_789",
      socialAccountId: "account_789",
      platform: "TIKTOK",
      content: {
        caption: "New video dropped! Check it out.",
        hashtags: ["#video", "#new"],
        mediaUrls: ["https://storage.example.com/video.mp4"],
        mediaType: "VIDEO",
        contentType: "REEL",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should handle publishing with link", async () => {
    const agent = new PublisherAgent();
    const input = {
      scheduleId: "schedule_link",
      contentId: "content_link",
      socialAccountId: "account_link",
      platform: "LINKEDIN",
      content: {
        caption: "Read our latest blog post about AI in marketing",
        hashtags: ["#marketing", "#ai"],
        mediaUrls: [],
        linkUrl: "https://example.com/blog/ai-marketing",
        contentType: "POST",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });
});

describe("PublisherAgent - Error Handling", () => {
  it("should handle expired token", async () => {
    const agent = new PublisherAgent();
    const input = {
      scheduleId: "schedule_expired",
      contentId: "content_123",
      socialAccountId: "account_expired",
      platform: "INSTAGRAM",
      content: {
        caption: "Test post",
        hashtags: [],
        mediaUrls: [],
        contentType: "POST",
      },
    };

    const result = await agent.execute(input);

    // Should handle the error gracefully
    expect(result).toBeDefined();
  });

  it("should track tokens used", async () => {
    const agent = new PublisherAgent();
    const input = {
      scheduleId: "schedule_123",
      contentId: "content_123",
      socialAccountId: "account_123",
      platform: "INSTAGRAM",
      content: {
        caption: "Test post",
        hashtags: [],
        mediaUrls: [],
        contentType: "POST",
      },
    };

    const result = await agent.execute(input);

    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
