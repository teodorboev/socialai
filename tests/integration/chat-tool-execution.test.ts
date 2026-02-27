/**
 * Tool Execution Tests
 * 
 * Tests tool registration and basic functionality.
 * Full SmartRouter integration tests require more comprehensive mocking.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

describe("Tool Loader", () => {
  it("should register all chat tools", async () => {
    const { registerAllTools, getToolDefinitions } = await import("@/lib/chat/tool-loader");
    
    registerAllTools();
    const tools = getToolDefinitions();
    
    // Verify all expected tools are registered
    expect(tools.length).toBeGreaterThanOrEqual(19);
    
    // Check query tools
    expect(tools.some(t => t.name === "get_metrics")).toBe(true);
    expect(tools.some(t => t.name === "get_content_status")).toBe(true);
    expect(tools.some(t => t.name === "get_escalations")).toBe(true);
    expect(tools.some(t => t.name === "get_brand_config")).toBe(true);
    expect(tools.some(t => t.name === "get_posting_schedule")).toBe(true);
    expect(tools.some(t => t.name === "get_competitors")).toBe(true);
    expect(tools.some(t => t.name === "get_social_accounts")).toBe(true);
    expect(tools.some(t => t.name === "get_recent_activity")).toBe(true);
    expect(tools.some(t => t.name === "get_goals")).toBe(true);
    expect(tools.some(t => t.name === "get_scheduled_posts")).toBe(true);
    
    // Check action tools
    expect(tools.some(t => t.name === "update_schedule")).toBe(true);
    expect(tools.some(t => t.name === "add_competitor")).toBe(true);
    expect(tools.some(t => t.name === "remove_competitor")).toBe(true);
    expect(tools.some(t => t.name === "create_content_request")).toBe(true);
    expect(tools.some(t => t.name === "set_publishing_enabled")).toBe(true);
    expect(tools.some(t => t.name === "approve_content")).toBe(true);
    expect(tools.some(t => t.name === "reject_content")).toBe(true);
    expect(tools.some(t => t.name === "update_brand_voice")).toBe(true);
    expect(tools.some(t => t.name === "update_do_nots")).toBe(true);
  });

  it("should have valid JSON schemas for all tools", async () => {
    const { getToolDefinitions } = await import("@/lib/chat/tool-loader");
    
    const tools = getToolDefinitions();
    
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it("should have required fields in tool schemas", async () => {
    const { getToolDefinitions } = await import("@/lib/chat/tool-loader");
    
    const tools = getToolDefinitions();
    
    // get_metrics requires orgId
    const metricsTool = tools.find(t => t.name === "get_metrics");
    expect(metricsTool?.inputSchema.required).toContain("orgId");
    
    // update_schedule requires action, dayOfWeek, timeUtc
    const scheduleTool = tools.find(t => t.name === "update_schedule");
    expect(scheduleTool?.inputSchema.required).toContain("orgId");
    expect(scheduleTool?.inputSchema.required).toContain("action");
    expect(scheduleTool?.inputSchema.required).toContain("dayOfWeek");
    expect(scheduleTool?.inputSchema.required).toContain("timeUtc");
    
    // approve_content requires contentId, orgId
    const approveTool = tools.find(t => t.name === "approve_content");
    expect(approveTool?.inputSchema.required).toContain("contentId");
    expect(approveTool?.inputSchema.required).toContain("orgId");
  });
});

describe("Tool Registry", () => {
  it("should allow registering custom tools", async () => {
    const { registerTool, unregisterTool } = await import("@/lib/router");
    
    const mockFn = vi.fn().mockResolvedValue({ test: "result" });
    
    // Should not throw
    registerTool("test_tool", mockFn);
    expect(true).toBe(true);
    
    // Cleanup
    unregisterTool("test_tool");
  });

  it("should allow unregistering tools", async () => {
    const { registerTool, unregisterTool } = await import("@/lib/router");
    
    const mockFn = vi.fn();
    registerTool("test_tool2", mockFn);
    unregisterTool("test_tool2");
    
    // Should not throw
    expect(true).toBe(true);
  });
});

describe("Chat Tools Functionality", () => {
  beforeAll(async () => {
    // Mock Prisma for tool tests
    vi.mock("@/lib/prisma", () => ({
      prisma: {
        analyticsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            { followers: 12500, followersChange: 234, engagementRate: 4.2, reach: 45000, impressions: 89000, snapshotDate: new Date() },
          ]),
        },
        content: {
          count: vi.fn().mockResolvedValue(5),
          findMany: vi.fn().mockResolvedValue([]),
        },
        escalation: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([]),
        },
        brandConfig: {
          findUnique: vi.fn().mockResolvedValue({ brandName: "Test Brand" }),
        },
        postingSchedule: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        competitor: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        socialAccount: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        agentLog: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        goal: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        schedule: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        orgSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
        },
      },
    }));
  });

  it("should get metrics for organization", async () => {
    const { getMetrics } = await import("@/lib/chat/tools");
    
    const result = await getMetrics("org_123", "7d");
    
    expect(result).toBeDefined();
    // The mock returns snapshot data - verify structure
    expect(result.followers).toBeDefined();
    expect(result.period).toBe(7);
  });

  it("should get content status counts", async () => {
    const { getContentStatus } = await import("@/lib/chat/tools");
    
    const result = await getContentStatus("org_123");
    
    expect(result).toBeDefined();
    // Mock returns 5 for content.count regardless of status
    // So we just verify the structure
    expect(result.pendingReview).toBeDefined();
    expect(result.scheduled).toBeDefined();
  });

  it("should get escalations", async () => {
    const { getEscalations } = await import("@/lib/chat/tools");
    
    const result = await getEscalations("org_123");
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get brand config", async () => {
    const { getBrandConfig } = await import("@/lib/chat/tools");
    
    const result = await getBrandConfig("org_123");
    
    expect(result).toBeDefined();
    expect(result.configured).toBe(true);
    expect(result.brandName).toBe("Test Brand");
  });
});

describe("Chat API Route Configuration", () => {
  it("should have POST handler exported", async () => {
    // Verify the chat route has proper input validation
    // We can't easily import the route module, but we can verify the file exists
    const fs = await import("fs");
    const routePath = "./src/app/api/chat/route.ts";
    
    // Verify the route file exists
    expect(fs.existsSync(routePath)).toBe(true);
    
    // Read and verify it has POST export
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("export async function POST");
  });
});