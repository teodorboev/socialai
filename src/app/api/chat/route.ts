import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { smartRouter, type SmartRouterRequest } from "@/lib/router";
import { z } from "zod";
import { registerAllTools, getToolDefinitions } from "@/lib/chat/tool-loader";

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
    const systemPrompt = buildSystemPrompt();

    // Get tool definitions and register them
    const toolDefinitions = getToolDefinitions();
    
    // Register all tools (this only needs to happen once, but calling multiple times is safe)
    registerAllTools();

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

    return NextResponse.json({
      response: aiResponse,
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

function buildSystemPrompt(): string {
  const toolsDescription = `
You are SocialAI's AI Assistant. You help users manage their social media through conversation.

You have access to the following tools:

## QUERY TOOLS
Use these to get information about the user's account:

1. get_metrics(period) - Get followers, engagement rate, reach
   - period: "7d", "30d", or "90d"

2. get_content_status() - Get counts of content by status

3. get_escalations() - Get open escalations requiring attention

4. get_brand_config() - Get current brand voice settings

5. get_posting_schedule() - Get current posting schedule

6. get_competitors() - Get list of tracked competitors

7. get_social_accounts() - Get connected social platforms

8. get_recent_activity(limit) - Get recent agent activity

9. get_goals() - Get current goals and progress

10. get_scheduled_posts(days) - Get upcoming scheduled posts

## ACTION TOOLS
Use these to make changes to the account:

11. update_schedule(action, dayOfWeek, timeUtc, platform) - Add or remove posting times
    - action: "add" or "remove"
    - dayOfWeek: 0-6 (0=Sunday)
    - timeUtc: "HH:MM" format
    - platform: "INSTAGRAM", "FACEBOOK", "TIKTOK", "TWITTER", "LINKEDIN"

12. add_competitor(name, handle, platform) - Track a new competitor

13. remove_competitor(competitorId) - Stop tracking a competitor

14. create_content_request(platform, contentType, caption) - Request specific content

15. set_publishing_enabled(enabled) - Pause/resume publishing

16. approve_content(contentId) - Approve content for publishing

17. reject_content(contentId, reason) - Reject content

18. update_brand_voice(voiceTone, contentThemes, doNots) - Update brand settings

19. update_do_nots(doNots, action) - Update restrictions

## GUIDELINES

1. Always confirm before making changes - say "Are you sure you want to..." before executing action tools
2. Explain what you're doing when you use tools
3. If asked about something you don't have a tool for, be honest and suggest an alternative
4. Keep responses conversational but professional
5. For complex actions, summarize what will happen before executing
6. Use the data from tools to provide specific, accurate answers

## RESPONSE FORMAT

When you use tools, include:
- What you're checking/doing
- The result
- What it means for the user

When making changes:
- Confirm the change
- Explain the impact
- Offer to undo if needed

Now, respond to the user's message. Use tools as needed to provide accurate information.
`;
  return toolsDescription;
}
