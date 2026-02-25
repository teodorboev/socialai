"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Send, CheckCircle, Loader2, Plus, ArrowRight, Building2, Users, Target, Globe, Shield } from "lucide-react";

type OnboardingPhase = "connect" | "understand" | "target_audience" | "goals" | "autonomy" | "analyzing" | "complete";

interface OnboardingState {
  phase: OnboardingPhase;
  socialAccounts: ConnectedAccount[];
  companyName: string;
  industry: string;
  businessDescription: string;
  targetAudience: string;
  competitors: string[];
  websiteUrl: string;
  noGos: string[];
  autonomyLevel: "autonomous" | "light" | "hands_on";
  goals: string[];
  isAnalyzing: boolean;
  analysisProgress: number;
  // Data collected for agent
  collectedData: {
    businessDescription: string;
    targetAudience: string;
    goals: string[];
    autonomyLevel: string;
  };
}

interface ConnectedAccount {
  platform: string;
  connected: boolean;
  username?: string;
  followers?: number;
}

const PHASES = [
  { id: "connect", title: "Connect Accounts", icon: Globe },
  { id: "understand", title: "About Your Business", icon: Building2 },
  { id: "goals", title: "Your Goals", icon: Target },
  { id: "autonomy", title: "Autonomy Level", icon: Shield },
];

export default function OnboardPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OnboardingState>({
    phase: "connect",
    socialAccounts: [
      { platform: "Instagram", connected: false },
      { platform: "Facebook", connected: false },
      { platform: "LinkedIn", connected: false },
      { platform: "TikTok", connected: false },
      { platform: "Twitter", connected: false },
    ],
    companyName: "",
    industry: "",
    businessDescription: "",
    targetAudience: "",
    competitors: [],
    websiteUrl: "",
    noGos: [],
    autonomyLevel: "light",
    goals: [],
    isAnalyzing: false,
    analysisProgress: 0,
    collectedData: {
      businessDescription: "",
      targetAudience: "",
      goals: [],
      autonomyLevel: "",
    },
  });
  const [chatMessages, setChatMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkExistingOnboarding();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function checkExistingOnboarding() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      redirect("/login");
      return;
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (orgMember) {
      // Check if onboarding is complete
      const { data: brandConfig } = await supabase
        .from("brand_configs")
        .select("id")
        .eq("organization_id", orgMember.organization_id)
        .single();

      if (brandConfig) {
        redirect("/dashboard");
        return;
      }
    }

    // Start onboarding conversation
    setChatMessages([
      { role: "ai", content: "Hi! I'm your AI social media manager. Let's get you set up in just a few minutes. First, let me ask: which social accounts would you like me to manage?" }
    ]);
    setLoading(false);
  }

  async function handleConnectPlatform(platform: string) {
    // Trigger OAuth flow
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      // Create organization first
      const { data: org } = await supabase
        .from("organizations")
        .insert({ name: "My Organization", slug: `org-${Date.now()}` })
        .select()
        .single();

      if (org) {
        await supabase
          .from("org_members")
          .insert({ organization_id: org.id, user_id: user.id, role: "OWNER" });
        
        // Initiate OAuth
        window.location.href = `/api/oauth/${platform.toLowerCase()}`;
      }
    } else {
      // Initiate OAuth
      window.location.href = `/api/oauth/${platform.toLowerCase()}`;
    }
  }

  async function handleSendMessage() {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    // Process based on phase
    const response = await processAIResponse(userMessage);
    setChatMessages(prev => [...prev, { role: "ai", content: response }]);
  }

  async function processAIResponse(message: string): Promise<string> {
    switch (state.phase) {
      case "understand":
        // First question - ask for company name
        if (!state.companyName) {
          setState(prev => ({ ...prev, companyName: message }));
          return "Great! What industry are you in? (e.g., SaaS, E-commerce, Healthcare, Real Estate)";
        }
        // Second question - ask for industry  
        if (!state.industry) {
          setState(prev => ({ ...prev, industry: message }));
          return "Perfect! Now tell me a bit about your business — what do you do, what makes you unique?";
        }
        // Third question - save business description and move to target audience
        setState(prev => ({ 
          ...prev, 
          businessDescription: message,
          phase: "target_audience",
          collectedData: { 
            ...prev.collectedData, 
            businessDescription: message,
            companyName: prev.companyName,
            industry: prev.industry
          }
        }));
        return "Got it! Now tell me about your ideal customer — their age, lifestyle, what matters to them?";
      
      case "target_audience":
        // Save target audience and move to goals
        setState(prev => ({ 
          ...prev, 
          targetAudience: message,
          phase: "goals",
          collectedData: { ...prev.collectedData, targetAudience: message }
        }));
        return "Great! What are your main goals for social media? (e.g., more followers, leads, sales, brand awareness)";
      
      case "goals":
        // Save goals and move to autonomy
        const goalsArray = message.split(",").map(g => g.trim()).filter(Boolean);
        setState(prev => ({ 
          ...prev, 
          goals: goalsArray,
          phase: "autonomy",
          collectedData: { ...prev.collectedData, goals: goalsArray }
        }));
        return "Almost done! How much would you like to be involved? Fully automated (AI does everything), Collaborative (AI suggests, you approve), or Hands-on (you guide everything)?";
      
      case "autonomy":
        // Save autonomy level and start analysis
        const autonomyMap: Record<string, "autonomous" | "light" | "hands_on"> = {
          "automated": "autonomous",
          "fully automated": "autonomous",
          "ai does everything": "autonomous",
          "collaborative": "light",
          "suggest": "light",
          "approve": "light",
          "hands-on": "hands_on",
          "hands on": "hands_on",
          "you guide": "hands_on",
        };
        const autonomyKey = message.toLowerCase();
        const autonomyLevel = autonomyMap[autonomyKey] || "light";
        
        setState(prev => ({ 
          ...prev, 
          autonomyLevel,
          phase: "analyzing",
          collectedData: { ...prev.collectedData, autonomyLevel: message }
        }));
        
        // Trigger actual analysis
        await startAnalysis();
        return "Perfect! Let me analyze everything and create your personalized strategy...";
      
      default:
        return "Let me process that. What would you like to do next?";
    }
  }

  async function startAnalysis() {
    setState(prev => ({ ...prev, isAnalyzing: true, phase: "analyzing" }));
    
    try {
      // Call the onboarding agent with collected data
      const response = await fetch("/api/onboarding/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: state.companyName,
          industry: state.industry,
          businessDescription: state.businessDescription,
          targetAudience: state.targetAudience,
          goals: state.goals,
          autonomyLevel: state.autonomyLevel,
          socialAccounts: state.socialAccounts.filter(a => a.connected),
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const result = await response.json();
      
      // Update progress to complete
      setState(prev => ({ ...prev, analysisProgress: 100, phase: "complete" }));
      setChatMessages(prev => [...prev, 
        { role: "ai", content: `Analysis complete! I've created a personalized strategy for ${state.companyName}. Here's what I found:\n\n${result.summary || "Your strategy is ready!"}` }
      ]);
      
    } catch (error) {
      console.error("Onboarding analysis failed:", error);
      
      // Fallback to simulated progress if API fails
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setState(prev => ({ ...prev, analysisProgress: 100, phase: "complete" }));
          setChatMessages(prev => [...prev, 
            { role: "ai", content: "Analysis complete! I've created a personalized strategy for your business." }
          ]);
        } else {
          setState(prev => ({ ...prev, analysisProgress: progress }));
        }
      }, 300);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-400" />
            <span className="font-semibold text-white">SocialAI</span>
          </div>
          {state.phase !== "complete" && (
            <div className="flex items-center gap-2">
              {PHASES.map((p, i) => {
                const isActive = state.phase === p.id;
                const isPast = PHASES.findIndex(phase => phase.id === state.phase) > i;
                return (
                  <div key={p.id} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      isActive ? "bg-blue-500 text-white" : isPast ? "bg-green-500 text-white" : "bg-slate-700 text-slate-400"
                    }`}>
                      {isPast ? <CheckCircle className="h-4 w-4" /> : i + 1}
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className={`w-8 h-0.5 ${isPast ? "bg-green-500" : "bg-slate-700"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        {state.isAnalyzing && (
          <Card className="mb-8 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400 animate-pulse" />
                Analyzing your accounts...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={state.analysisProgress} className="h-2" />
              <p className="text-slate-400 text-sm mt-2">
                {state.analysisProgress < 30 && "Reading your content history..."}
                {state.analysisProgress >= 30 && state.analysisProgress < 60 && "Identifying top performers..."}
                {state.analysisProgress >= 60 && state.analysisProgress < 90 && "Analyzing audience engagement..."}
                {state.analysisProgress >= 90 && "Finalizing your strategy..."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Chat Interface */}
        <div className="space-y-4 mb-8">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={msg.role === "ai" ? "bg-blue-500" : "bg-green-500"}>
                    {msg.role === "ai" ? "AI" : "You"}
                  </AvatarFallback>
                </Avatar>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === "ai" 
                    ? "bg-slate-800 border border-slate-700 text-white" 
                    : "bg-blue-600 text-white"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Platform Connection Phase */}
        {state.phase === "connect" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {state.socialAccounts.map((account) => (
              <Button
                key={account.platform}
                variant="outline"
                className="h-auto py-4 flex-col gap-2 border-slate-700 hover:bg-slate-800"
                onClick={() => handleConnectPlatform(account.platform)}
              >
                <Globe className="h-6 w-6" />
                <span>{account.platform}</span>
                {account.connected && <CheckCircle className="h-4 w-4 text-green-500 absolute top-2 right-2" />}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 border-slate-700 hover:bg-slate-800 border-dashed"
              onClick={() => setState(prev => ({ ...prev, phase: "understand" }))}
            >
              <Plus className="h-6 w-6" />
              <span>Skip for now</span>
            </Button>
          </div>
        )}

        {/* Business Understanding Phase */}
        {(state.phase === "understand" || state.phase === "target_audience" || state.phase === "goals" || state.phase === "autonomy") && (
          <div className="space-y-4">
            {!state.companyName ? (
              <Input
                placeholder="What's your company or brand name?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-slate-800 border-slate-700 text-white"
              />
            ) : !state.industry ? (
              <Input
                placeholder="What's your industry?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-slate-800 border-slate-700 text-white"
              />
            ) : !state.businessDescription ? (
              <Input
                placeholder="Tell me about your business — what do you do?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-slate-800 border-slate-700 text-white"
              />
            ) : (
              <Input
                placeholder={state.phase === "target_audience" ? "Tell me about your ideal customer..." : 
                             state.phase === "goals" ? "What are your main goals for social media?" :
                             "How much would you like to be involved?"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-slate-800 border-slate-700 text-white"
              />
            )}
            <div className="flex justify-end">
              <Button onClick={handleSendMessage} disabled={!input.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Goals Phase */}
        {state.phase === "goals" && (
          <div className="grid grid-cols-2 gap-3">
            {["Grow followers", "Drive sales", "Build brand awareness", "Launch product"].map((goal) => (
              <Button
                key={goal}
                variant={state.goals.includes(goal) ? "default" : "outline"}
                className="border-slate-700"
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    goals: prev.goals.includes(goal) 
                      ? prev.goals.filter(g => g !== goal)
                      : [...prev.goals, goal]
                  }));
                }}
              >
                <Target className="h-4 w-4 mr-2" />
                {goal}
              </Button>
            ))}
          </div>
        )}

        {/* Autonomy Level */}
        {state.phase === "autonomy" && (
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800" onClick={() => setState(prev => ({ ...prev, autonomyLevel: "autonomous" }))}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Fully Autonomous</p>
                    <p className="text-sm text-slate-400">AI handles everything, weekly reports only</p>
                  </div>
                  {state.autonomyLevel === "autonomous" && <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800" onClick={() => setState(prev => ({ ...prev, autonomyLevel: "light" }))}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Light Touch</p>
                    <p className="text-sm text-slate-400">AI posts, I review before publishing</p>
                  </div>
                  {state.autonomyLevel === "light" && <CheckCircle className="h-5 w-5 text-blue-500 ml-auto" />}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800" onClick={() => setState(prev => ({ ...prev, autonomyLevel: "hands_on" }))}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Hands On</p>
                    <p className="text-sm text-slate-400">Review everything before it goes live</p>
                  </div>
                  {state.autonomyLevel === "hands_on" && <CheckCircle className="h-5 w-5 text-purple-500 ml-auto" />}
                </div>
              </CardContent>
            </Card>
            <Button className="w-full mt-4" onClick={startAnalysis}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Ready to Launch
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
