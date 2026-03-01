"use client";

import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, ArrowLeft, Settings, Zap, Calendar, BarChart3, MessageCircle, TrendingUp, Users, Clock, Target, Palette, Shield, Plus } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  timestamp: Date;
  toolCalls?: { name: string; humanName: string }[];
}

const QUICK_ACTIONS = [
  {
    category: "Analytics",
    actions: [
      { label: "My metrics", prompt: "Show me my analytics for the last 30 days", icon: BarChart3 },
      { label: "Performance", prompt: "What's performing best right now?", icon: TrendingUp },
    ]
  },
  {
    category: "Content",
    actions: [
      { label: "Create post", prompt: "Create a new post for Instagram", icon: Plus },
      { label: "Scheduled", prompt: "What posts are scheduled?", icon: Calendar },
    ]
  },
  {
    category: "Settings",
    actions: [
      { label: "Schedule", prompt: "Show me my posting schedule", icon: Clock },
      { label: "Brand voice", prompt: "Show my brand voice settings", icon: Palette },
    ]
  },
  {
    category: "Account",
    actions: [
      { label: "Escalations", prompt: "Show any escalations", icon: Shield },
      { label: "Accounts", prompt: "Show my connected accounts", icon: Users },
    ]
  },
];

const SUGGESTED_PROMPTS = [
  "Post more Reels, they seem to be working",
  "What's working best right now?",
  "Stop posting on weekends",
  "We're launching a new product next month",
  "Add Glow Recipe as a competitor",
];

// Tool definitions for the AI
const AVAILABLE_TOOLS = [
  { name: "update_posting_schedule", description: "Change posting times/frequency" },
  { name: "update_content_mix", description: "Change content type ratios" },
  { name: "update_brand_voice", description: "Adjust tone, vocabulary, style" },
  { name: "add_competitor", description: "Start tracking a new competitor" },
  { name: "create_content_request", description: "Request specific content" },
  { name: "create_campaign", description: "Build a content campaign for an event/launch" },
  { name: "get_analytics", description: "Pull performance data" },
  { name: "get_competitor_report", description: "Get competitor intelligence" },
  { name: "update_automation_level", description: "Change human involvement level" },
  { name: "update_do_nots", description: "Add/remove content restrictions" },
  { name: "explain_decision", description: "Explain why the AI made a specific choice" },
  { name: "get_recommendations", description: "Get AI's suggestions for improvement" },
  { name: "pause_publishing", description: "Pause all scheduled content" },
  { name: "resume_publishing", description: "Resume publishing" },
];

export default function AskAIPage() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "ai",
      content: "Hi! I'm your AI social media manager. You can ask me anything—change your posting schedule, check what's working, request content, or just chat. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    posthog.capture("ai_chat_message_sent", {
      message_length: input.trim().length,
      conversation_turn: messages.length,
    });
    setInput("");
    setLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .slice(-10) // Last 10 messages for context
        .map(m => ({
          role: m.role === "ai" ? "assistant" : m.role,
          content: m.content,
        }));

      // Call the chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input.trim(),
          conversationHistory,
        }),
      });

      const data = await response.json();
      
      const aiResponse = data.response || data.error || "I apologize, but I couldn't process your request. Please try again.";
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: aiResponse,
        timestamp: new Date(),
        toolCalls: data.toolCalls?.map((tc: any) => ({
          name: tc.name,
          humanName: tc.humanName,
        })),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      posthog.captureException(error, { tags: { context: "ai_chat" } });

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
    
    setLoading(false);
  }

  function handleSuggestedPrompt(prompt: string) {
    setInput(prompt);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/mission-control">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          Talk to your AI
        </h1>
      </div>

      {/* Chat */}
      <Card className="bg-card/50 border-border h-[500px] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={msg.role === "ai" ? "bg-primary" : "bg-green-500"}>
                    {msg.role === "ai" ? "AI" : "You"}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "ai"
                      ? "bg-muted border border-input text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {/* Tool calls indicator */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {msg.toolCalls.map((tc, i) => (
                        <span 
                          key={i} 
                          className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {tc.humanName}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-sm">
                    {msg.role === "ai" ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  <p className="text-xs opacity-50 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary">AI</AvatarFallback>
                </Avatar>
                <div className="rounded-2xl px-4 py-3 bg-muted border border-input">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Quick actions */}
        {messages.length <= 2 && (
          <div className="px-4 pb-2">
            <p className="text-muted-foreground text-sm mb-3">Quick actions:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_ACTIONS.map((category) => (
                <div key={category.category} className="space-y-1">
                  <p className="text-xs text-muted-foreground/60 px-1">{category.category}</p>
                  {category.actions.map((action) => (
                    <Button
                      key={action.prompt}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleSuggestedPrompt(action.prompt)}
                    >
                      <action.icon className="h-3 w-3 mr-2 shrink-0" />
                      <span className="truncate">{action.label}</span>
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="bg-muted border-input text-foreground"
              disabled={loading}
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
