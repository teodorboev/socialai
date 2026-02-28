"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, ArrowLeft, Settings, Zap, Calendar, BarChart3, MessageCircle } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

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
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      
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

        {/* Suggested prompts */}
        {messages.length <= 2 && (
          <div className="px-4 pb-2">
            <p className="text-muted-foreground text-sm mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="border-input text-foreground/80 text-xs"
                  onClick={() => handleSuggestedPrompt(prompt)}
                >
                  {prompt}
                </Button>
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

      {/* Available tools hint */}
      <Card className="mt-4 bg-card/30 border-border">
        <CardContent className="py-3">
          <p className="text-muted-foreground text-xs mb-2">I can help you with:</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Scheduling
            </span>
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Analytics
            </span>
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Content
            </span>
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <Settings className="h-3 w-3" /> Settings
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
