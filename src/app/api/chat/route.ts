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

    // Build system prompt with available tools
    const systemPrompt = buildSystemPrompt(orgId);

    // Get tool definitions - don't modify them, orgId is injected via registerToolWrapper
    let toolDefinitions = getToolDefinitions();
    
    // The wrapper already injects orgId, so remove orgId from required
    toolDefinitions = toolDefinitions.map((tool: any) => ({
      ...tool,
      inputSchema: {
        ...tool.inputSchema,
        required: tool.inputSchema?.required?.filter((r: string) => r !== "orgId") || [],
      },
    }));

    // Register tools with auto-injected orgId
    registerToolWrapper(orgId);

    // Build messages including history
    const messages = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Call smart-router with tools
    const routerRequest: SmartRouterRequest = {
      agentName: "CHAT_ASSISTANT",
      messages,
      systemPrompt,
      maxTokens: 2000,
      organizationId: orgId,
      tools: toolDefinitions,
      maxToolIterations: 5,
    };

    const response = await smartRouter.complete(routerRequest);

    // Parse the response - the AI should indicate if it used any tools
    const aiResponse = response.content;

    // Humanize tool names for display
    const toolCalls = response.toolCalls?.map((tc: any) => ({
      name: tc.name,
      input: tc.input,
      humanName: humanizeToolName(tc.name),
    })) || [];

    return NextResponse.json({
      response: aiResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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

function buildSystemPrompt(orgId: string): string {
  const toolExample = 'Use tool by responding with JSON: {"type":"tool_use","name":"get_social_accounts","input":{"orgId":"' + orgId + '"}}';
  
  return `
You are SocialAI's AI Assistant. You help users manage their social media through conversation.

The orgId for all operations is: ${orgId}

## TOOL CALLING INSTRUCTIONS - VERY IMPORTANT
You must use the provided tools to get data. When you need information, respond with a JSON tool_use message.

Example format:
${toolExample}

DO NOT write Python code. DO NOT use print(). Use the JSON tool_use format!

## TOOLS AVAILABLE
- get_metrics (period: "7d", "30d", "90d")  
- get_content_status
- get_escalations
- get_brand_config
- get_posting_schedule
- get_competitors
- get_social_accounts
- get_recent_activity
- get_goals
- get_scheduled_posts

## RESPONSE FORMAT
After calling a tool, summarize the results for the user in plain English with emojis:
- "📊 You have 3 connected accounts: Instagram, Facebook, and LinkedIn"
- "📈 Your metrics show 12,450 followers with 3.2% engagement"

DO NOT show raw JSON to users. Format numbers nicely (12.5K, not 12500).
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
