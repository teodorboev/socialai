import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { smartRouter, type SmartRouterRequest, registerTool } from "@/lib/router";
import { z } from "zod";
import { getToolDefinitions, registerAllTools } from "@/lib/chat/tool-loader";
import * as chatTools from "@/lib/chat/tools";

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
});

/**
 * POST /api/chat
 * 
 * Handles chat messages from the Talk to AI interface.
 * Uses smart-router to route to appropriate LLM with tools.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const orgId = orgMember.organization_id;

    // Parse request body
    const body = await request.json();
    const { message, conversationHistory } = ChatRequestSchema.parse(body);

    // Auto-detect and execute tools based on message content - no LLM tool calling needed
    const toolResult = await detectAndExecuteTool(orgId, message);
    
    // Build enhanced system prompt with tool results included
    let contextInfo = "";
    if (toolResult) {
      contextInfo = `\n\nHere are the results from my internal checks:\n${formatToolResultForLLM(toolResult)}\n\nUse this real data to answer the user's question.`;
    }

    const systemPrompt = buildSystemPrompt(orgId, contextInfo);

    // Build messages including history
    const userMessage = contextInfo 
      ? `${message}\n\n${contextInfo}` 
      : message;
    
    const messages = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    // Call smart-router WITHOUT tools - we handle tool execution internally
    const routerRequest: SmartRouterRequest = {
      agentName: "CHAT_ASSISTANT",
      messages,
      systemPrompt,
      maxTokens: 2000,
      organizationId: orgId,
    };

    const response = await smartRouter.complete(routerRequest);

    return NextResponse.json({
      response: response.content,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
      },
      cost: {
        total: response.cost.totalCost / 100, // Convert cents to dollars
      },
      model: response.model.displayName,
    });
  } catch (error) {
    console.error("Chat error:", error);
    
    // Return a friendly error
    return NextResponse.json(
      { 
        error: "Failed to process message",
        response: "I'm sorry, I encountered an error processing your request. Please try again.",
      },
      { status: 500 }
    );
  }
}

// Auto-detect what user is asking for and execute the appropriate tool
async function detectAndExecuteTool(orgId: string, message: string): Promise<{ tool: string; data: any } | null> {
  const lower = message.toLowerCase();
  
  // Connected accounts
  if (lower.includes("connected account") || lower.includes("social account") || lower.includes("what platforms") || lower.includes("which accounts")) {
    const data = await chatTools.getSocialAccounts(orgId);
    return { tool: "get_social_accounts", data };
  }
  
  // Metrics / analytics
  if (lower.includes("metric") || lower.includes("analytics") || lower.includes("follower") || lower.includes("engagement") || lower.includes("reach")) {
    const period = lower.includes("30 day") || lower.includes("30d") || lower.includes("month") ? "30d" : 
                  lower.includes("90 day") || lower.includes("90d") ? "90d" : "7d";
    const data = await chatTools.getMetrics(orgId, period);
    return { tool: "get_metrics", data };
  }
  
  // Content status
  if (lower.includes("content") && (lower.includes("status") || lower.includes("count") || lower.includes("how many"))) {
    const data = await chatTools.getContentStatus(orgId);
    return { tool: "get_content_status", data };
  }
  
  // Scheduled posts
  if (lower.includes("scheduled") || lower.includes("upcoming") || lower.includes("planned")) {
    const days = lower.includes("week") ? 7 : lower.includes("month") ? 30 : 14;
    const data = await chatTools.getScheduledPosts(orgId, days);
    return { tool: "get_scheduled_posts", data };
  }
  
  // Posting schedule
  if (lower.includes("posting schedule") || lower.includes("when do you post") || lower.includes("schedule")) {
    const data = await chatTools.getPostingSchedule(orgId);
    return { tool: "get_posting_schedule", data };
  }
  
  // Escalations
  if (lower.includes("escalat") || lower.includes("issue") || lower.includes("problem") || lower.includes("attention")) {
    const data = await chatTools.getEscalations(orgId);
    return { tool: "get_escalations", data };
  }
  
  // Brand config
  if (lower.includes("brand") && (lower.includes("setting") || lower.includes("voice") || lower.includes("config"))) {
    const data = await chatTools.getBrandConfig(orgId);
    return { tool: "get_brand_config", data };
  }
  
  // Goals
  if (lower.includes("goal")) {
    const data = await chatTools.getGoals(orgId);
    return { tool: "get_goals", data };
  }
  
  // Competitors
  if (lower.includes("competitor")) {
    const data = await chatTools.getCompetitors(orgId);
    return { tool: "get_competitors", data };
  }
  
  // Recent activity
  if (lower.includes("activity") || lower.includes("recent")) {
    const data = await chatTools.getRecentActivity(orgId, 10);
    return { tool: "get_recent_activity", data };
  }
  
  return null;
}

// Format tool results for LLM context
function formatToolResultForLLM(result: { tool: string; data: any }): string {
  const { tool, data } = result;
  
  if (tool === "get_social_accounts") {
    if (!data || data.length === 0) return "No social accounts connected yet.";
    return `Connected accounts: ${data.map((a: any) => `${a.platform}${a.platformUsername ? ` (@${a.platformUsername})` : ''}`).join(', ')}`;
  }
  
  if (tool === "get_metrics") {
    return `Metrics: ${data.followers?.toLocaleString() || 0} followers, ${data.engagementRate?.toFixed(1) || 0}% engagement, ${data.reach?.toLocaleString() || 0} reach`;
  }
  
  if (tool === "get_content_status") {
    return `Content: ${data.published || 0} published, ${data.scheduled || 0} scheduled, ${data.pendingReview || 0} pending review, ${data.draft || 0} drafts`;
  }
  
  if (tool === "get_scheduled_posts") {
    if (!data || data.length === 0) return "No posts scheduled.";
    return `Scheduled posts: ${data.length} posts coming up`;
  }
  
  if (tool === "get_posting_schedule") {
    if (!data || data.length === 0) return "No posting schedule configured.";
    return `Schedule: ${JSON.stringify(data)}`;
  }
  
  if (tool === "get_escalations") {
    if (!data || data.length === 0) return "No escalations - all good!";
    return `Escalations: ${data.length} items need attention`;
  }
  
  if (tool === "get_brand_config") {
    return `Brand: ${JSON.stringify(data).slice(0, 200)}`;
  }
  
  if (tool === "get_goals") {
    if (!data || data.length === 0) return "No goals set yet.";
    return `Goals: ${data.join(', ')}`;
  }
  
  if (tool === "get_competitors") {
    if (!data || data.length === 0) return "No competitors tracked.";
    return `Competitors: ${data.map((c: any) => c.name).join(', ')}`;
  }
  
  if (tool === "get_recent_activity") {
    if (!data || data.length === 0) return "No recent activity.";
    return `Recent activity: ${data.length} actions`;
  }
  
  return JSON.stringify(data).slice(0, 500);
}

function buildSystemPrompt(orgId: string, contextInfo: string = ""): string {
  return `
You are SocialAI's friendly AI assistant. Help users with their social media.

${contextInfo}

Be conversational, helpful, and concise. Use emojis to make responses friendly.
Format numbers nicely: use commas (12,450) or K (12.5K) instead of raw numbers.
Never show raw JSON to users - always summarize in plain English.
`;
}

function registerToolWrapper(orgId: string) {
  // Register each tool with orgId auto-injected
  registerTool("get_metrics", async (input: any) => {
    return chatTools.getMetrics(orgId, input.period);
  });
  registerTool("get_content_status", async (input: any) => {
    return chatTools.getContentStatus(orgId);
  });
  registerTool("get_escalations", async (input: any) => {
    return chatTools.getEscalations(orgId);
  });
  registerTool("get_brand_config", async (input: any) => {
    return chatTools.getBrandConfig(orgId);
  });
  registerTool("get_posting_schedule", async (input: any) => {
    return chatTools.getPostingSchedule(orgId);
  });
  registerTool("get_competitors", async (input: any) => {
    return chatTools.getCompetitors(orgId);
  });
  registerTool("get_social_accounts", async (input: any) => {
    return chatTools.getSocialAccounts(orgId);
  });
  registerTool("get_recent_activity", async (input: any) => {
    return chatTools.getRecentActivity(orgId, input.limit);
  });
  registerTool("get_goals", async (input: any) => {
    return chatTools.getGoals(orgId);
  });
  registerTool("get_scheduled_posts", async (input: any) => {
    return chatTools.getScheduledPosts(orgId, input.days);
  });
}

function humanizeToolName(toolName: string): string {
  const names: Record<string, string> = {
    get_metrics: "Checking your metrics...",
    get_content_status: "Looking at your content...",
    get_escalations: "Checking escalations...",
    get_brand_config: "Reading your brand settings...",
    get_posting_schedule: "Checking your posting schedule...",
    get_competitors: "Checking competitors...",
    get_social_accounts: "Checking connected accounts...",
    get_recent_activity: "Checking recent activity...",
    get_goals: "Reading your goals...",
    get_scheduled_posts: "Looking at scheduled posts...",
    update_schedule: "Updating your schedule...",
    add_competitor: "Adding competitor...",
    remove_competitor: "Removing competitor...",
    create_content_request: "Creating content...",
    set_publishing_enabled: "Updating publishing settings...",
    approve_content: "Approving content...",
    reject_content: "Rejecting content...",
    update_brand_voice: "Updating brand voice...",
    update_do_nots: "Updating restrictions...",
  };
  return names[toolName] || "Working...";
}
