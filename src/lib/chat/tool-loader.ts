/**
 * Tool Loader
 * 
 * Registers all available tools with the SmartRouter.
 * This enables the LLM to execute tools during conversations.
 */

import { smartRouter, registerTool } from "@/lib/router";
import * as chatTools from "@/lib/chat/tools";

/**
 * Register all chat tools with the SmartRouter
 */
export function registerAllTools() {
  // Query tools - read-only operations
  registerTool("get_metrics", async (input) => {
    const { orgId, period } = input as { orgId: string; period?: string };
    return chatTools.getMetrics(orgId, period);
  });

  registerTool("get_content_status", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getContentStatus(orgId);
  });

  registerTool("get_escalations", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getEscalations(orgId);
  });

  registerTool("get_brand_config", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getBrandConfig(orgId);
  });

  registerTool("get_posting_schedule", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getPostingSchedule(orgId);
  });

  registerTool("get_competitors", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getCompetitors(orgId);
  });

  registerTool("get_social_accounts", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getSocialAccounts(orgId);
  });

  registerTool("get_recent_activity", async (input) => {
    const { orgId, limit } = input as { orgId: string; limit?: number };
    return chatTools.getRecentActivity(orgId, limit);
  });

  registerTool("get_goals", async (input) => {
    const { orgId } = input as { orgId: string };
    return chatTools.getGoals(orgId);
  });

  registerTool("get_scheduled_posts", async (input) => {
    const { orgId, days } = input as { orgId: string; days?: number };
    return chatTools.getScheduledPosts(orgId, days);
  });

  // Action tools - write operations
  registerTool("update_schedule", async (input) => {
    const { orgId, action, dayOfWeek, timeUtc, platform } = input as {
      orgId: string;
      action: "add" | "remove";
      dayOfWeek: number;
      timeUtc: string;
      platform?: string;
    };
    return chatTools.updateSchedule(orgId, action, dayOfWeek, timeUtc, platform);
  });

  registerTool("add_competitor", async (input) => {
    const { orgId, name, handle, platform } = input as {
      orgId: string;
      name: string;
      handle: string;
      platform: string;
    };
    return chatTools.addCompetitor(orgId, name, handle, platform);
  });

  registerTool("remove_competitor", async (input) => {
    const { orgId, competitorId } = input as { orgId: string; competitorId: string };
    return chatTools.removeCompetitor(orgId, competitorId);
  });

  registerTool("create_content_request", async (input) => {
    const { orgId, platform, contentType, caption } = input as {
      orgId: string;
      platform: string;
      contentType: string;
      caption: string;
    };
    return chatTools.createContentRequest(orgId, platform, contentType, caption);
  });

  registerTool("set_publishing_enabled", async (input) => {
    const { orgId, enabled } = input as { orgId: string; enabled: boolean };
    return chatTools.setPublishingEnabled(orgId, enabled);
  });

  registerTool("approve_content", async (input) => {
    const { contentId, orgId } = input as { contentId: string; orgId: string };
    return chatTools.approveContent(contentId, orgId);
  });

  registerTool("reject_content", async (input) => {
    const { contentId, orgId, reason } = input as {
      contentId: string;
      orgId: string;
      reason: string;
    };
    return chatTools.rejectContent(contentId, orgId, reason);
  });

  registerTool("update_brand_voice", async (input) => {
    const { orgId, updates } = input as {
      orgId: string;
      updates: {
        voiceTone?: any;
        contentThemes?: string[];
        doNots?: string[];
      };
    };
    return chatTools.updateBrandVoice(orgId, updates);
  });

  registerTool("update_do_nots", async (input) => {
    const { orgId, doNots, action } = input as {
      orgId: string;
      doNots: string[];
      action: "add" | "remove" | "replace";
    };
    return chatTools.updateDoNots(orgId, doNots, action);
  });

  console.log("[ToolLoader] Registered all chat tools with SmartRouter");
}

/**
 * Get tool definitions for the LLM
 * These are the JSON schemas that describe each tool
 */
export function getToolDefinitions() {
  return [
    {
      name: "get_metrics",
      description: "Get current followers, engagement rate, reach for the organization",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          period: { type: "string", enum: ["7d", "30d", "90d"], description: "Time period" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_content_status",
      description: "Get counts of content by status (draft, pending, scheduled, published)",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_escalations",
      description: "Get open escalations requiring human attention",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_brand_config",
      description: "Get current brand voice configuration",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_posting_schedule",
      description: "Get current posting schedule",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_competitors",
      description: "Get list of tracked competitors",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_social_accounts",
      description: "Get connected social media accounts",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_recent_activity",
      description: "Get recent agent activity",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          limit: { type: "number", description: "Number of items to return" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_goals",
      description: "Get current goals and progress",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "get_scheduled_posts",
      description: "Get upcoming scheduled posts",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          days: { type: "number", description: "Number of days to look ahead" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "update_schedule",
      description: "Change posting schedule (add or remove time slots)",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          action: { type: "string", enum: ["add", "remove"] },
          dayOfWeek: { type: "number", minimum: 0, maximum: 6 },
          timeUtc: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
          platform: { type: "string" },
        },
        required: ["orgId", "action", "dayOfWeek", "timeUtc"],
      },
    },
    {
      name: "add_competitor",
      description: "Start tracking a new competitor",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          name: { type: "string", description: "Competitor name" },
          handle: { type: "string", description: "Social media handle" },
          platform: { type: "string", description: "Platform name" },
        },
        required: ["orgId", "name", "handle", "platform"],
      },
    },
    {
      name: "remove_competitor",
      description: "Stop tracking a competitor",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          competitorId: { type: "string", description: "Competitor ID" },
        },
        required: ["orgId", "competitorId"],
      },
    },
    {
      name: "create_content_request",
      description: "Request specific content to be created",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          platform: { type: "string", description: "Platform name" },
          contentType: { type: "string", description: "Content type" },
          caption: { type: "string", description: "Caption or idea" },
        },
        required: ["orgId", "platform", "contentType", "caption"],
      },
    },
    {
      name: "set_publishing_enabled",
      description: "Pause or resume content publishing",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          enabled: { type: "boolean", description: "True to enable, false to pause" },
        },
        required: ["orgId", "enabled"],
      },
    },
    {
      name: "approve_content",
      description: "Approve content for publishing",
      inputSchema: {
        type: "object",
        properties: {
          contentId: { type: "string", description: "Content ID" },
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["contentId", "orgId"],
      },
    },
    {
      name: "reject_content",
      description: "Reject content with a reason",
      inputSchema: {
        type: "object",
        properties: {
          contentId: { type: "string", description: "Content ID" },
          orgId: { type: "string", description: "Organization ID" },
          reason: { type: "string", description: "Reason for rejection" },
        },
        required: ["contentId", "orgId", "reason"],
      },
    },
    {
      name: "update_brand_voice",
      description: "Update brand voice configuration",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          updates: {
            type: "object",
            properties: {
              voiceTone: { type: "object" },
              contentThemes: { type: "array", items: { type: "string" } },
              doNots: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["orgId", "updates"],
      },
    },
    {
      name: "update_do_nots",
      description: "Update the do-nots list",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
          doNots: { type: "array", items: { type: "string" } },
          action: { type: "string", enum: ["add", "remove", "replace"] },
        },
        required: ["orgId", "doNots", "action"],
      },
    },
  ];
}
