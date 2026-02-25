"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, User, Bell, Menu, X, AlertTriangle, Pause, Play } from "lucide-react";
import Link from "next/link";

type AIStatus = "running" | "paused" | "crisis";

interface MissionControlLayoutProps {
  children: React.ReactNode;
}

export default function MissionControlLayout({ children }: MissionControlLayoutProps) {
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState<AIStatus>("running");
  const [notificationCount, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      redirect("/login");
      return;
    }

    // Check if organization exists and has brand config
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

      if (!brandConfig) {
        redirect("/onboard");
        return;
      }

      // Check for pending escalations
      const { count } = await supabase
        .from("escalations")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgMember.organization_id)
        .eq("status", "OPEN");
      
      setNotificationCount(count || 0);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse">
          <Sparkles className="h-8 w-8 text-blue-400" />
        </div>
      </div>
    );
  }

  const statusColors = {
    running: "bg-green-500",
    paused: "bg-yellow-500",
    crisis: "bg-red-500",
  };

  const statusText = {
    running: "AI is running",
    paused: "AI is paused",
    crisis: "Crisis mode active",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm lg:hidden">
          <div className="p-4">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2"
            >
              <X className="h-6 w-6" />
            </button>
            <nav className="mt-12 space-y-4">
              <Link href="/" className="block py-2 text-lg font-medium">
                Mission Control
              </Link>
              <Link href="/feed" className="block py-2 text-lg text-slate-400">
                Activity Feed
              </Link>
              <Link href="/ask" className="block py-2 text-lg text-slate-400">
                Talk to AI
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[aiStatus]}`} />
              <Sparkles className="h-5 w-5 text-blue-400" />
              <span className="font-semibold hidden sm:inline">SocialAI</span>
            </Link>
            <span className="hidden sm:inline text-slate-400 text-sm ml-2">
              {statusText[aiStatus]}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {aiStatus === "crisis" && (
              <Button 
                variant="outline" 
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-900/20"
                onClick={() => setAiStatus("running")}
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
            {aiStatus === "running" && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setAiStatus("paused")}
              >
                <Pause className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Pause</span>
              </Button>
            )}
            <Link href="/ask">
              <Button variant="ghost" size="sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Talk to AI</span>
              </Button>
            </Link>
            <Link href="/notifications">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
