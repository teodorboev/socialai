"use client";

import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, Bell, Menu, X, AlertTriangle, Pause, Play, ShieldAlert, Settings, Link2 } from "lucide-react";
import Link from "next/link";
import { CrisisIndicator } from "@/components/crisis-mode/crisis-overlay";
import { ThemeToggle } from "@/components/theme-toggle";

type AIStatus = "running" | "paused" | "crisis";

interface MissionControlLayoutProps {
  children: React.ReactNode;
}

export default function MissionControlLayout({ children }: MissionControlLayoutProps) {
  const [loading, setLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState<AIStatus>("running");
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasCrisis, setHasCrisis] = useState(false);
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

      // Check for critical escalations (crisis mode)
      const { count: criticalCount } = await supabase
        .from("escalations")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgMember.organization_id)
        .eq("status", "OPEN")
        .eq("priority", "CRITICAL");
      
      if (criticalCount && criticalCount > 0) {
        setHasCrisis(true);
        setAiStatus("crisis");
      } else {
        // Fetch actual pause state from database
        try {
          const response = await fetch("/api/organization/pause");
          if (response.ok) {
            const data = await response.json();
            if (data.isPaused) {
              setAiStatus("paused");
            }
          }
        } catch (error) {
          console.error("Error fetching pause state:", error);
        }
      }
    }

    setLoading(false);
  }

  async function togglePause() {
    const newPausedState = aiStatus === "running";
    
    try {
      const response = await fetch("/api/organization/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: newPausedState }),
      });

      if (response.ok) {
        setAiStatus(newPausedState ? "paused" : "running");
      } else {
        console.error("Failed to toggle pause state:", response.status);
      }
    } catch (error) {
      console.error("Error toggling pause:", error);
    }
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm lg:hidden">
          <div className="p-4">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2"
            >
              <X className="h-6 w-6" />
            </button>
            <nav className="mt-12 space-y-4">
              <Link href="/mission-control" className="block py-2 text-lg font-medium">
                Mission Control
              </Link>
              <Link href="/mission-control/feed" className="block py-2 text-lg text-muted-foreground">
                Activity Feed
              </Link>
              <Link href="/mission-control/ask" className="block py-2 text-lg text-muted-foreground">
                Talk to AI
              </Link>
              <Link href="/mission-control/notifications" className="block py-2 text-lg text-muted-foreground">
                Notifications
              </Link>
              <hr className="border-border my-4" />
              <Link href="/mission-control/accounts" className="block py-2 text-lg text-muted-foreground">
                Connected Accounts
              </Link>
              <Link href="/mission-control/settings/billing" className="block py-2 text-lg text-muted-foreground">
                Settings & Billing
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`border-b bg-background/50 backdrop-blur-sm sticky top-0 z-40 ${
        aiStatus === "crisis" ? "border-red-800 bg-red-950/30" : "border-border"
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/mission-control" className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColors[aiStatus]}`} />
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold hidden sm:inline">SocialAI</span>
            </Link>
            {aiStatus === "crisis" ? (
              <Link href="/mission-control/crisis">
                <CrisisIndicator />
              </Link>
            ) : (
              <span className="hidden sm:inline text-muted-foreground text-sm ml-2">
                {statusText[aiStatus]}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <Link href="/mission-control/accounts">
              <Button variant="ghost" size="sm" title="Connected Accounts">
                <Link2 className="h-4 w-4" />
              </Button>
            </Link>
            {aiStatus === "crisis" && (
              <Link href="/mission-control/crisis">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                >
                  <ShieldAlert className="h-4 w-4 mr-1" />
                  View Crisis
                </Button>
              </Link>
            )}
            {aiStatus === "running" && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={togglePause}
              >
                <Pause className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Pause</span>
              </Button>
            )}
            {aiStatus === "paused" && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={togglePause}
              >
                <Play className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Resume</span>
              </Button>
            )}
            <Link href="/mission-control/ask">
              <Button variant="ghost" size="sm">
                <MessageCircle className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Talk to AI</span>
              </Button>
            </Link>
            <Link href="/mission-control/notifications">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </Button>
            </Link>
            <ThemeToggle />
            <Link href="/mission-control/settings/billing">
              <Button variant="ghost" size="sm" title="Settings">
                <Settings className="h-4 w-4" />
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
