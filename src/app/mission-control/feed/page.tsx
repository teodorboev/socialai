"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Sparkles, Calendar, MessageCircle, BarChart3, TrendingUp, AlertTriangle, CheckCircle, Instagram, Linkedin, Globe, RefreshCw } from "lucide-react";
import Link from "next/link";

interface ActivityItem {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  details: string;
  platform?: string;
  status?: "success" | "pending" | "failed";
}

// Default activity when no data
const DEFAULT_ACTIVITY: ActivityItem[] = [
  { id: "empty", timestamp: "Now", agent: "System", action: "Ready", details: "No activity yet. Connect social accounts to get started.", status: "success" },
];

const AGENT_ICONS: Record<string, any> = {
  Publisher: Globe,
  Engagement: MessageCircle,
  ContentCreator: Sparkles,
  TrendScout: TrendingUp,
  Analytics: BarChart3,
  CompetitorIntel: AlertTriangle,
  Strategy: Calendar,
};

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "bg-pink-500/20 text-pink-400",
  LinkedIn: "bg-blue-500/20 text-blue-400",
  Facebook: "bg-blue-600/20 text-blue-300",
  TikTok: "bg-black/80 text-white",
  Twitter: "bg-sky-500/20 text-sky-400",
};

export default function FeedPage() {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    try {
      const response = await fetch("/api/mission-control/activity?limit=30");
      const data = response.ok ? await response.json() : null;
      
      if (data?.activities?.length > 0) {
        setActivity(data.activities);
      } else {
        setActivity(DEFAULT_ACTIVITY);
      }
    } catch (error) {
      console.error("Error loading activity:", error);
      setActivity(DEFAULT_ACTIVITY);
    }
    setLoading(false);
  }

  const filteredActivity = filter === "all" 
    ? activity 
    : activity.filter(item => item.agent.toLowerCase() === filter.toLowerCase());

  const agents = ["all", ...new Set(activity.map(a => a.agent))];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 bg-slate-800" />
        <Skeleton className="h-96 bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/mission-control">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-400" />
            AI Activity Feed
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadActivity}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {agents.map((agent) => (
          <Button
            key={agent}
            variant={filter === agent ? "default" : "outline"}
            size="sm"
            className="whitespace-nowrap"
            onClick={() => setFilter(agent)}
          >
            {agent === "all" ? "All Activity" : agent}
          </Button>
        ))}
      </div>

      {/* Activity List */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {filteredActivity.map((item) => {
              const AgentIcon = AGENT_ICONS[item.agent] || Sparkles;
              return (
                <div key={item.id} className="flex items-start gap-4 p-4 hover:bg-slate-800/30">
                  {/* Timestamp */}
                  <div className="text-slate-500 text-sm w-20 shrink-0">
                    {item.timestamp}
                  </div>

                  {/* Agent Icon */}
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                    <AgentIcon className="h-5 w-5 text-slate-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-400 text-sm">{item.agent}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-white font-medium">{item.action}</span>
                    </div>
                    <p className="text-slate-300 text-sm">{item.details}</p>
                    {item.platform && (
                      <Badge 
                        className={`mt-2 text-xs ${PLATFORM_COLORS[item.platform] || "bg-slate-700 text-slate-300"}`}
                      >
                        {item.platform}
                      </Badge>
                    )}
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    {item.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {item.status === "pending" && (
                      <div className="h-5 w-5 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                    )}
                    {item.status === "failed" && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {filteredActivity.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No activity to show</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
