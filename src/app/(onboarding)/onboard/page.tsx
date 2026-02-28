"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, ArrowRight, CheckCircle, Building2, Target, Users, Zap } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  isTyping?: boolean;
}

interface OnboardingData {
  companyName: string;
  industry: string;
  businessDescription: string;
  targetAudience: string;
  competitors: string[];
  autonomyLevel: "autonomous" | "light" | "hands_on";
  goals: string[];
  platforms: string[];
}

// Questions the AI will ask in order
const ONBOARDING_QUESTIONS = [
  {
    key: "companyName",
    question: "What is your company or brand name?",
    placeholder: "e.g., Bloom Botanics",
    icon: Building2,
  },
  {
    key: "industry",
    question: "What industry are you in?",
    placeholder: "e.g., Skincare, SaaS, Restaurant",
    icon: Target,
  },
  {
    key: "businessDescription",
    question: "Tell me a bit about what you do. What products or services do you offer?",
    placeholder: "We create...",
    multiline: true,
  },
  {
    key: "targetAudience",
    question: "Who is your ideal customer? Describe your target audience.",
    placeholder: "e.g., Women aged 25-45 interested in...",
    multiline: true,
  },
  {
    key: "competitors",
    question: "Who are your main competitors? (Optional - just enter names separated by commas)",
    placeholder: "e.g., Brand X, Brand Y",
  },
  {
    key: "goals",
    question: "What are your main goals for social media? (e.g., More followers, Drive sales, Build community)",
    placeholder: "I want to...",
    multiline: true,
  },
  {
    key: "autonomy",
    question: "How much control do you want? Should I post automatically, or review everything before it goes live?",
    options: [
      { value: "autonomous", label: "Full Auto", description: "AI handles everything, I just get weekly reports" },
      { value: "light", label: "Light Review", description: "AI posts, but I review before anything major goes out" },
      { value: "hands_on", label: "Hands On", description: "Review everything before it publishes" },
    ],
  },
  {
    key: "platforms",
    question: "Which platforms should I manage?",
    multiSelect: true,
    options: [
      { value: "INSTAGRAM", label: "Instagram" },
      { value: "FACEBOOK", label: "Facebook" },
      { value: "LINKEDIN", label: "LinkedIn" },
      { value: "TWITTER", label: "X (Twitter)" },
      { value: "TIKTOK", label: "TikTok" },
    ],
  },
];

export default function OnboardPage() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [data, setData] = useState<OnboardingData>({
    companyName: "",
    industry: "",
    businessDescription: "",
    targetAudience: "",
    competitors: [],
    autonomyLevel: "light",
    goals: [],
    platforms: [],
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkExistingSetup();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function checkExistingSetup() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      redirect("/login");
      return;
    }

    // Check if user already has brand config
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgMember) {
      const { data: brandConfig } = await supabase
        .from("brand_configs")
        .select("id")
        .eq("organization_id", orgMember.organization_id)
        .single();

      if (brandConfig) {
        redirect("/mission-control");
        return;
      }
    }

    // Start onboarding conversation
    setLoading(false);
    setMessages([
      {
        id: "1",
        role: "ai",
        content: `Hi! I'm SocialAI 🤖\n\nI'm your AI social media manager. I'll ask you a few quick questions to get to know your business, then I'll create a personalized strategy and start managing your social media.\n\nLet's get started!\n\n${ONBOARDING_QUESTIONS[0].question}`,
      },
    ]);
  }

  async function handleSend() {
    if (!input.trim() || isProcessing) return;

    const userInput = input.trim();
    setInput("");
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userInput,
    };
    setMessages(prev => [...prev, userMessage]);

    // Process the answer
    await processAnswer(userInput);
  }

  async function processAnswer(answer: string) {
    setIsProcessing(true);
    
    const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];
    
    // Add typing indicator
    setMessages(prev => [...prev, {
      id: "typing",
      role: "ai",
      content: "...",
      isTyping: true,
    }]);

    // Process based on question type
    if (currentQuestion.key === "competitors") {
      const competitors = answer.split(",").map(c => c.trim()).filter(c => c.length > 0);
      setData(prev => ({ ...prev, competitors }));
    } else if (currentQuestion.key === "goals") {
      setData(prev => ({ ...prev, goals: [answer] }));
    } else if (currentQuestion.key === "autonomy") {
      const level = answer.toLowerCase().includes("auto") ? "autonomous" : 
                    answer.toLowerCase().includes("hands") ? "hands_on" : "light";
      setData(prev => ({ ...prev, autonomyLevel: level }));
    } else if (currentQuestion.key === "platforms") {
      // Parse platform selections
      const platforms: string[] = [];
      const lower = answer.toLowerCase();
      if (lower.includes("instagram")) platforms.push("INSTAGRAM");
      if (lower.includes("facebook")) platforms.push("FACEBOOK");
      if (lower.includes("linkedin")) platforms.push("LINKEDIN");
      if (lower.includes("twitter") || lower.includes("x")) platforms.push("TWITTER");
      if (lower.includes("tiktok")) platforms.push("TIKTOK");
      if (platforms.length === 0) platforms.push("INSTAGRAM"); // Default
      setData(prev => ({ ...prev, platforms }));
    } else if (currentQuestion.key === "companyName") {
      setData(prev => ({ ...prev, companyName: answer }));
    } else if (currentQuestion.key === "industry") {
      setData(prev => ({ ...prev, industry: answer }));
    } else if (currentQuestion.key === "businessDescription") {
      setData(prev => ({ ...prev, businessDescription: answer }));
    } else if (currentQuestion.key === "targetAudience") {
      setData(prev => ({ ...prev, targetAudience: answer }));
    }

    // Remove typing indicator
    setMessages(prev => prev.filter(m => !m.isTyping));

    // Move to next question or complete
    const nextIndex = currentQuestionIndex + 1;
    
    if (nextIndex >= ONBOARDING_QUESTIONS.length) {
      // Complete onboarding
      await completeOnboarding();
    } else {
      setCurrentQuestionIndex(nextIndex);
      const nextQuestion = ONBOARDING_QUESTIONS[nextIndex];
      
      // Add AI response
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "ai",
          content: nextQuestion.question,
        }]);
      }, 300);
    }

    setIsProcessing(false);
  }

  async function completeOnboarding() {
    setMessages(prev => [...prev, {
      id: "processing",
      role: "ai",
      content: "Perfect! I'm analyzing your business and creating your personalized strategy...",
    }]);

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        redirect("/login");
        return;
      }

      // Get or create organization
      let { data: orgMember } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      let orgId = orgMember?.organization_id;

      if (!orgId) {
        // Create organization
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({ 
            name: data.companyName,
            slug: data.companyName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
          })
          .select("id")
          .single();

        if (orgError || !org) {
          throw new Error("Failed to create organization");
        }

        orgId = org.id;

        // Add user as member
        await supabase
          .from("org_members")
          .insert({
            organization_id: orgId,
            user_id: user.id,
            role: "OWNER",
          });
      }

      // Create brand config
      await supabase
        .from("brand_configs")
        .insert({
          organization_id: orgId,
          brand_name: data.companyName,
          industry: data.industry,
          business_description: data.businessDescription,
          target_audience: {
            description: data.targetAudience,
          },
          voice_tone: {
            adjectives: [],
            examples: [],
            avoid: [],
          },
          content_themes: data.goals,
          do_nots: [],
        });

      // Create default org settings
      await supabase
        .from("org_settings")
        .insert({
          organization_id: orgId,
          auto_publish_threshold: data.autonomyLevel === "autonomous" ? 0.9 : 0.5,
          flag_for_review_threshold: 0.75,
          auto_engagement_enabled: data.autonomyLevel === "autonomous",
        });

      setIsComplete(true);
      setMessages(prev => [...prev, {
        id: "complete",
        role: "ai",
        content: `🎉 All done! I've set up your account for **${data.companyName}**.\n\nHere's what I've configured:\n- Industry: ${data.industry}\n- Platforms: ${data.platforms.join(", ")}\n- Autonomy: ${data.autonomyLevel === "autonomous" ? "Full Auto" : data.autonomyLevel === "light" ? "Light Review" : "Hands On"}\n\nI'm now ready to start managing your social media! Head to Mission Control to see your dashboard.`,
      }]);

    } catch (error) {
      console.error("Onboarding error:", error);
      setMessages(prev => [...prev, {
        id: "error",
        role: "ai",
        content: "Sorry, I encountered an error setting up your account. Please try again or contact support.",
      }]);
    }
  }

  function handleOptionSelect(option: { value: string; label: string }) {
    setInput(option.label);
    handleSend();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">SocialAI</span>
          </div>
          {isComplete && (
            <Button onClick={() => redirect("/mission-control")}>
              Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </header>

      {/* Progress */}
      {!isComplete && (
        <div className="border-b bg-muted/30">
          <div className="max-w-2xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question {currentQuestionIndex + 1} of {ONBOARDING_QUESTIONS.length}</span>
              <span>{Math.round(((currentQuestionIndex) / ONBOARDING_QUESTIONS.length) * 100)}% complete</span>
            </div>
            <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${((currentQuestionIndex) / ONBOARDING_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="space-y-4">
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
                    {msg.isTyping ? (
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Options for current question */}
          {!isComplete && currentQuestion?.options && messages[messages.length - 1]?.role === "ai" && (
            <div className="mt-4 space-y-2">
              {currentQuestion.options?.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => handleOptionSelect(option)}
                >
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {"description" in option && (
                      <div className="text-xs text-muted-foreground">{(option as any).description}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}

          {/* Multi-select for platforms */}
          {!isComplete && currentQuestion?.multiSelect && messages[messages.length - 1]?.role === "ai" && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">You can mention multiple platforms:</p>
              <div className="flex flex-wrap gap-2">
                {currentQuestion.options?.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleOptionSelect(option)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {!isComplete && (
        <div className="border-t bg-background/50 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder={currentQuestion?.placeholder || "Type your answer..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isProcessing || currentQuestion?.options !== undefined}
                className="bg-muted border-input"
              />
              <Button type="submit" disabled={!input.trim() || isProcessing || currentQuestion?.options !== undefined}>
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
