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

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/router", () => ({
  smartRouter: {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        optimizedSchedule: [
          { 
            platform: "INSTAGRAM", 
            dayOfWeek: 1, 
            timeUtc: "10:00", 
            timeLocal: "05:00",
            contentTypes: ["POST", "CAROUSEL"], 
            frequency: { postsPerWeek: 5, storiesPerWeek: 3, reelsPerWeek: 2 },
            rationale: "Best engagement on Monday mornings",
            confidence: 0.85
          },
          { 
            platform: "TIKTOK", 
            dayOfWeek: 3, 
            timeUtc: "14:00", 
            timeLocal: "09:00",
            contentTypes: ["VIDEO"], 
            frequency: { postsPerWeek: 3 },
            rationale: "Peak audience activity mid-week",
            confidence: 0.78
          },
          { 
            platform: "LINKEDIN", 
            dayOfWeek: 5, 
            timeUtc: "12:00", 
            timeLocal: "07:00",
            contentTypes: ["ARTICLE"], 
            frequency: { postsPerWeek: 2 },
            rationale: "Professional audience active on Fridays",
            confidence: 0.82
          },
        ],
        rationale: {
          summary: "Balanced mix with optimal engagement times",
          dataPoints: [
            { metric: "Engagement Rate", insight: "Higher on weekdays", impact: "Positive" }
          ],
          changes: [
            { what: "Posting frequency", from: "3/week", to: "5/week", reason: "More opportunities" }
          ]
        },
        expectedImprovement: {
          overall: { engagementIncrease: 15, reachIncrease: 20, followerGrowth: 10 },
          byPlatform: [{ platform: "INSTAGRAM", engagementIncrease: 18, bestTime: "10:00" }],
          timeline: "2-4 weeks"
        },
        conflictsResolved: [],
        confidenceScore: 0.82,
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

// Mock the prompt loader to avoid needing other dependencies
vi.mock("@/lib/ai/prompts/loader", () => ({
  loadPrompt: vi.fn().mockRejectedValue(new Error("Prompt not found")),
}));

// Mock memory modules to avoid OpenAI credential issues
vi.mock("@/lib/memory/embeddings", () => ({
  createEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
  generateEmbeddings: vi.fn().mockResolvedValue([
    new Array(1536).fill(0).map(() => Math.random()),
  ]),
  getEmbeddingConfig: vi.fn().mockReturnValue({ provider: "openai", model: "text-embedding-3-small" }),
  estimateTokens: vi.fn().mockReturnValue(100),
  truncateToTokens: vi.fn().mockImplementation((text: string) => text),
}));

vi.mock("@/lib/memory/store", () => ({
  MemoryStore: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  })),
  storeMemory: vi.fn().mockResolvedValue(undefined),
  storeMemories: vi.fn().mockResolvedValue(undefined),
  DEFAULT_IMPORTANCE: {},
  EXPIRATION_DAYS: {},
}));

vi.mock("@/lib/memory/recall", () => ({
  recallMemories: vi.fn().mockResolvedValue([]),
  recall: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/memory/recent", () => ({
  getRecentMemories: vi.fn().mockResolvedValue([]),
  getRecentByTypes: vi.fn().mockResolvedValue([]),
  recent: vi.fn().mockResolvedValue([]),
  recentByTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/memory", () => ({
  memory: {
    store: vi.fn().mockResolvedValue(undefined),
    storeMany: vi.fn().mockResolvedValue(undefined),
    recall: vi.fn().mockResolvedValue([]),
    recent: vi.fn().mockResolvedValue([]),
    recentByTypes: vi.fn().mockResolvedValue([]),
  },
  MAX_MEMORY_CONTEXT_TOKENS: 2000,
  formatMemoriesForPrompt: vi.fn().mockReturnValue(""),
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
        timezone: "America/New_York",
        activeHours: [
          { dayOfWeek: 1, hourStart: 9, hourEnd: 12, activity: "HIGH" as const },
          { dayOfWeek: 1, hourStart: 12, hourEnd: 15, activity: "MEDIUM" as const },
          { dayOfWeek: 1, hourStart: 15, hourEnd: 18, activity: "HIGH" as const },
          { dayOfWeek: 1, hourStart: 18, hourEnd: 20, activity: "HIGH" as const },
          { dayOfWeek: 2, hourStart: 9, hourEnd: 12, activity: "HIGH" as const },
          { dayOfWeek: 2, hourStart: 12, hourEnd: 15, activity: "MEDIUM" as const },
          { dayOfWeek: 3, hourStart: 9, hourEnd: 12, activity: "HIGH" as const },
          { dayOfWeek: 3, hourStart: 15, hourEnd: 18, activity: "HIGH" as const },
          { dayOfWeek: 4, hourStart: 9, hourEnd: 12, activity: "HIGH" as const },
          { dayOfWeek: 4, hourStart: 12, hourEnd: 15, activity: "MEDIUM" as const },
          { dayOfWeek: 5, hourStart: 9, hourEnd: 12, activity: "HIGH" as const },
        ],
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
        timezone: "UTC",
        activeHours: [
          { dayOfWeek: 2, hourStart: 10, hourEnd: 14, activity: "HIGH" as const },
          { dayOfWeek: 2, hourStart: 14, hourEnd: 18, activity: "MEDIUM" as const },
          { dayOfWeek: 4, hourStart: 10, hourEnd: 14, activity: "HIGH" as const },
          { dayOfWeek: 4, hourStart: 14, hourEnd: 18, activity: "MEDIUM" as const },
          { dayOfWeek: 6, hourStart: 10, hourEnd: 14, activity: "HIGH" as const },
        ],
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
        timezone: "America/Los_Angeles",
        activeHours: [
          { dayOfWeek: 2, hourStart: 8, hourEnd: 10, activity: "HIGH" as const },
          { dayOfWeek: 2, hourStart: 10, hourEnd: 12, activity: "HIGH" as const },
          { dayOfWeek: 3, hourStart: 8, hourEnd: 10, activity: "HIGH" as const },
          { dayOfWeek: 3, hourStart: 10, hourEnd: 12, activity: "HIGH" as const },
          { dayOfWeek: 4, hourStart: 8, hourEnd: 10, activity: "HIGH" as const },
          { dayOfWeek: 4, hourStart: 10, hourEnd: 12, activity: "HIGH" as const },
        ],
      },
    };

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
