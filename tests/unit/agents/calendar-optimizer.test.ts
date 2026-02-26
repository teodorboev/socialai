/**
 * CalendarOptimizerAgent - Unit Tests
 * 
 * Tests for the calendar optimization agent:
 * - Schedule optimization
 * - Timing recommendations
 * - Content mix balancing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalendarOptimizerAgent } from "@/agents/calendar-optimizer";

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
        optimizedSchedule: [
          { dayOfWeek: "Monday", time: "10:00", platform: "INSTAGRAM", contentType: "POST" },
          { dayOfWeek: "Wednesday", time: "14:00", platform: "TIKTOK", contentType: "REEL" },
          { dayOfWeek: "Friday", time: "12:00", platform: "LINKEDIN", contentType: "ARTICLE" },
        ],
        rationale: "Balanced mix with optimal engagement times",
      }),
      usage: { inputTokens: 1500, outputTokens: 800, cachedTokens: 0, totalTokens: 2300 },
      cost: { inputCost: 0.0045, outputCost: 0.012, cacheSavings: 0, totalCost: 0.0165 },
      model: { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "Anthropic", tier: "mid" },
      classification: { tier: "mid", taskType: "analysis" },
      latencyMs: 2500,
      wasFallback: false,
      fallbacksAttempted: 0,
    }),
  },
}));

describe("CalendarOptimizerAgent - Initialization", () => {
  it("should initialize correctly", () => {
    const agent = new CalendarOptimizerAgent();
    expect(agent).toBeDefined();
  });
});

describe("CalendarOptimizerAgent - Schedule Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should optimize posting schedule", async () => {
    const agent = new CalendarOptimizerAgent();
    const input = {
      organizationId: "org_123",
      currentSchedule: [
        { platform: "INSTAGRAM", postsPerWeek: 3, postingTimes: ["09:00", "15:00", "20:00"], contentTypes: ["POST", "REEL"] },
        { platform: "TIKTOK", postsPerWeek: 2, postingTimes: ["12:00", "18:00"], contentTypes: ["VIDEO"] },
      ],
      engagementData: {
        period: { start: "2024-01-01", end: "2024-01-31" },
        byPlatform: [
          {
            platform: "INSTAGRAM",
            bestTimes: [{ dayOfWeek: 3, timeUtc: "14:00", avgEngagement: 0.06, sampleSize: 50 }],
            worstTimes: [{ dayOfWeek: 0, timeUtc: "06:00", avgEngagement: 0.01 }],
            contentTypePerformance: [
              { type: "REEL", avgEngagement: 0.08 },
              { type: "POST", avgEngagement: 0.04 },
            ],
          },
        ],
        overallMetrics: { avgEngagementRate: 0.05, totalPosts: 50 },
      },
      audienceData: {
        peakHours: [9, 12, 15, 18, 20],
        peakDays: [1, 2, 3, 4, 5],
        timezone: "America/New_York",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it("should balance content types", async () => {
    const agent = new CalendarOptimizerAgent();
    const input = {
      organizationId: "org_123",
      currentSchedule: [
        { platform: "INSTAGRAM", postsPerWeek: 7, postingTimes: ["09:00"], contentTypes: ["POST"] },
      ],
      engagementData: {
        period: { start: "2024-01-01", end: "2024-01-31" },
        byPlatform: [
          {
            platform: "INSTAGRAM",
            bestTimes: [{ dayOfWeek: 2, timeUtc: "12:00", avgEngagement: 0.07, sampleSize: 30 }],
            worstTimes: [],
            contentTypePerformance: [
              { type: "CAROUSEL", avgEngagement: 0.09 },
              { type: "POST", avgEngagement: 0.04 },
            ],
          },
        ],
      },
      audienceData: {
        peakHours: [10, 14, 18],
        peakDays: [2, 4, 6],
        timezone: "UTC",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
  });

  it("should consider audience activity", async () => {
    const agent = new CalendarOptimizerAgent();
    const input = {
      organizationId: "org_123",
      currentSchedule: [],
      engagementData: {
        period: { start: "2024-01-01", end: "2024-01-31" },
        byPlatform: [
          {
            platform: "LINKEDIN",
            bestTimes: [
              { dayOfWeek: 2, timeUtc: "08:00", avgEngagement: 0.05, sampleSize: 20 },
              { dayOfWeek: 3, timeUtc: "10:00", avgEngagement: 0.06, sampleSize: 25 },
            ],
            worstTimes: [],
            contentTypePerformance: [],
          },
        ],
      },
      audienceData: {
        peakHours: [8, 10, 12],
        peakDays: [2, 3, 4],
        timezone: "America/Los_Angeles",
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
