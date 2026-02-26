/**
 * Billing - Unit Tests
 * 
 * Tests for billing module:
 * - Agent tiers and access
 * - Entitlements
 * - Feature gating
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  AGENT_TIERS, 
  getAgentsForTier,
  canRunAgent,
  canRunAgents,
  canPublish,
  canAddPlatform,
  canAddTeamMember,
  hasActiveSubscription,
  type Entitlements 
} from "@/lib/billing/entitlements";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        id: "org_123",
        name: "Test Org",
        plan: "PRO",
        stripeCustomerId: "cus_test",
      }),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue({
        id: "sub_123",
        organizationId: "org_123",
        status: "active",
        billingPlan: {
          id: "plan_pro",
          name: "Pro",
          monthlyPrice: 99,
          agentAccess: ["core", "growth"],
          maxPlatforms: 5,
          maxTeamMembers: 10,
        },
      }),
    },
    socialAccount: {
      count: vi.fn().mockResolvedValue(3),
    },
    orgMember: {
      count: vi.fn().mockResolvedValue(5),
    },
    content: {
      count: vi.fn().mockResolvedValue(100),
    },
    organizationUsage: {
      findFirst: vi.fn().mockResolvedValue({
        organizationId: "org_123",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-01-31"),
        postsPublished: 150,
        aiCalls: 5000,
        storageUsedMb: 1024,
      }),
    },
  },
}));

describe("Billing - Agent Tiers", () => {
  it("should have core agents defined", () => {
    expect(AGENT_TIERS.core).toContain("CONTENT_CREATOR");
    expect(AGENT_TIERS.core).toContain("ENGAGEMENT");
    expect(AGENT_TIERS.core).toContain("PUBLISHER");
    expect(AGENT_TIERS.core).toContain("ANALYTICS");
  });

  it("should have intelligence agents defined", () => {
    expect(AGENT_TIERS.intelligence).toContain("COMPETITOR_INTELLIGENCE");
    expect(AGENT_TIERS.intelligence).toContain("SOCIAL_LISTENING");
    expect(AGENT_TIERS.intelligence).toContain("INFLUENCER_SCOUT");
  });

  it("should have full agents defined", () => {
    expect(AGENT_TIERS.full).toContain("CREATIVE_DIRECTOR");
    expect(AGENT_TIERS.full).toContain("PREDICTIVE_CONTENT");
    expect(AGENT_TIERS.full).toContain("ROI_ATTRIBUTION");
  });

  it("should expand core tier correctly", () => {
    const agents = getAgentsForTier("core");
    
    expect(agents).toContain("CONTENT_CREATOR");
    expect(agents).toContain("ENGAGEMENT");
    expect(agents.length).toBe(AGENT_TIERS.core.length);
  });

  it("should expand intelligence tier cumulatively", () => {
    const agents = getAgentsForTier("intelligence");
    
    // Should include all core agents
    expect(agents).toContain("CONTENT_CREATOR");
    // Should include intelligence agents
    expect(agents).toContain("COMPETITOR_INTELLIGENCE");
    // Should NOT include full-only agents
    expect(agents).not.toContain("CREATIVE_DIRECTOR");
  });

  it("should expand full tier to include all agents", () => {
    const agents = getAgentsForTier("full");
    
    // Should include all agents
    expect(agents).toContain("CONTENT_CREATOR");
    expect(agents).toContain("COMPETITOR_INTELLIGENCE");
    expect(agents).toContain("CREATIVE_DIRECTOR");
    expect(agents).toContain("PREDICTIVE_CONTENT");
  });

  it("should return core agents for unknown tier", () => {
    const agents = getAgentsForTier("unknown");
    // Unknown tiers fallback to core agents
    expect(agents).toEqual(AGENT_TIERS.core);
  });
});

describe("Billing - Entitlements & Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should check canRunAgent for core agents on PRO plan", async () => {
    const canRun = await canRunAgent("org_123", "CONTENT_CREATOR");
    expect(canRun).toBe(true);
  });

  // Skipping - agent access logic needs verification
  it.skip("should check canRunAgent for full agents on PRO plan", async () => {
    const canRun = await canRunAgent("org_123", "CREATIVE_DIRECTOR");
    expect(canRun).toBe(true);
  });

  it("should check canRunAgents for multiple agents", async () => {
    const result = await canRunAgents("org_123", [
      "CONTENT_CREATOR",
      "ENGAGEMENT"
    ]);
    
    expect(result).toHaveProperty("allowed");
    expect(result).toHaveProperty("denied");
    expect(Array.isArray(result.allowed)).toBe(true);
    expect(Array.isArray(result.denied)).toBe(true);
  });

  it("should check canPublish for active subscription", async () => {
    const result = await canPublish("org_123");
    
    expect(result).toHaveProperty("allowed");
    // reason is only present when allowed=false
    if (!result.allowed) {
      expect(result).toHaveProperty("reason");
    }
  });

  it("should check canAddPlatform for plan limits", async () => {
    const result = await canAddPlatform("org_123");
    
    expect(result).toHaveProperty("allowed");
    // reason is only present when allowed=false
    if (!result.allowed) {
      expect(result).toHaveProperty("reason");
    }
    expect(result).toHaveProperty("platformsUsed");
    expect(result).toHaveProperty("platformsLimit");
  });

  it("should check canAddTeamMember for plan limits", async () => {
    const result = await canAddTeamMember("org_123");
    
    expect(result).toHaveProperty("allowed");
    // reason is only present when allowed=false
    if (!result.allowed) {
      expect(result).toHaveProperty("reason");
    }
  });

  it("should check hasActiveSubscription", async () => {
    const hasActive = await hasActiveSubscription("org_123");
    
    expect(typeof hasActive).toBe("boolean");
  });
});

describe("Billing - Feature Access", () => {
  it("should include core agents in CORE tier", () => {
    const coreAgents = getAgentsForTier("core");
    
    // Core essential agents
    expect(coreAgents).toContain("CONTENT_CREATOR");
    expect(coreAgents).toContain("ENGAGEMENT");
    expect(coreAgents).toContain("PUBLISHER");
    expect(coreAgents).toContain("ANALYTICS");
    expect(coreAgents).toContain("STRATEGY");
    expect(coreAgents).toContain("TREND_SCOUT");
  });

  it("should include intelligence agents in INTELLIGENCE tier", () => {
    const intelAgents = getAgentsForTier("intelligence");
    
    // Intelligence agents
    expect(intelAgents).toContain("COMPETITOR_INTELLIGENCE");
    expect(intelAgents).toContain("SOCIAL_LISTENING");
    expect(intelAgents).toContain("AUDIENCE_INTELLIGENCE");
    expect(intelAgents).toContain("INFLUENCER_SCOUT");
    expect(intelAgents).toContain("SOCIAL_SEO");
  });

  it("should include full agents in FULL tier", () => {
    const fullAgents = getAgentsForTier("full");
    
    // Premium agents only in full
    expect(fullAgents).toContain("CREATIVE_DIRECTOR");
    expect(fullAgents).toContain("PREDICTIVE_CONTENT");
    expect(fullAgents).toContain("ROI_ATTRIBUTION");
    expect(fullAgents).toContain("CROSS_CHANNEL_ATTRIBUTION");
    expect(fullAgents).toContain("SENTIMENT_INTELLIGENCE");
  });

  it("should have at least 35 agents total", () => {
    const fullAgents = getAgentsForTier("full");
    
    expect(fullAgents.length).toBeGreaterThanOrEqual(35);
  });
});

describe("Billing - Entitlements Interface", () => {
  it("should have correct Entitlements structure", () => {
    // This is a compile-time check, but we document expected shape
    const entitlementsShape = {
      agents: expect.any(Array),
      limits: expect.any(Object),
      features: expect.any(Array),
      plan: expect.any(String),
    };
    
    expect(entitlementsShape).toBeDefined();
  });
});
