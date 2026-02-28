"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, TrendingUp, TrendingDown, Users, Eye, MousePointer, 
  DollarSign, ArrowRight, AlertTriangle, CheckCircle2, Clock,
  Instagram, Linkedin, Globe, Zap, Calendar, Trophy, MessageCircle
} from "lucide-react";
import Link from "next/link";

// Types
interface Metric {
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  period: string;
}

interface AttentionItem {
  id: string;
  type: "content_review" | "escalated_comment" | "crisis_detected" | "strategy_proposal";
  title: string;
  description: string;
  actionLabel: string;
  deadline?: string;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  platform?: string;
}

interface ComingUpItem {
  id: string;
  time: string;
  platform: string;
  contentType: string;
  preview?: string;
  imageUrl?: string;
}

interface WinItem {
  id: string;
  type: "viral" | "followers" | "clicks" | "review" | "conversion";
  description: string;
  icon: string;
}

// Default fallback data (shown when no real data available)
const DEFAULT_METRICS: Metric[] = [
  { value: "0", change: "+0", trend: "neutral" as const, period: "this week" },
  { value: "0%", change: "+0%", trend: "neutral" as const, period: "this week" },
  { value: "0", change: "+0", trend: "neutral" as const, period: "this week" },
  { value: "$0", change: "+$0", trend: "neutral" as const, period: "weekly" },
];

const DEFAULT_ATTENTION_ITEMS: AttentionItem[] = [];

const DEFAULT_ACTIVITY: ActivityItem[] = [];

const DEFAULT_COMING_UP: ComingUpItem[] = [];

const DEFAULT_WINS: WinItem[] = [
  { id: "welcome-1", type: "conversion", description: "Welcome! Set up your brand to get started.", icon: "✨" },
];

const PLATFORM_ICONS: Record<string, any> = {
  Instagram: Instagram,
  LinkedIn: Linkedin,
  Facebook: Globe,
};

export default function MissionControlPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [comingUp, setComingUp] = useState<ComingUpItem[]>([]);
  const [wins, setWins] = useState<WinItem[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      // Fetch overview data (metrics, attention items, coming up)
      const [overviewRes, activityRes, winsRes] = await Promise.all([
        fetch("/api/mission-control/overview"),
        fetch("/api/mission-control/activity?limit=6"),
        fetch("/api/mission-control/wins"),
      ]);

      const overviewData = overviewRes.ok ? await overviewRes.json() : null;
      const activityData = activityRes.ok ? await activityRes.json() : null;
      const winsData = winsRes.ok ? await winsRes.json() : null;

      // Set metrics from overview
      if (overviewData?.metrics) {
        const m = overviewData.metrics;
        setMetrics([
          m.followers,
          m.engagement,
          m.reach,
          m.roi,
        ]);
      } else {
        setMetrics(DEFAULT_METRICS);
      }

      // Set attention items from overview
      if (overviewData?.attentionItems?.count > 0) {
        const count = overviewData.attentionItems.count;
        const pendingReviews = overviewData.attentionItems.pendingReviews || 0;
        const escalations = overviewData.attentionItems.openEscalations || 0;
        
        const items: AttentionItem[] = [];
        if (pendingReviews > 0) {
          items.push({
            id: "content-review",
            type: "content_review",
            title: `${pendingReviews} post${pendingReviews > 1 ? "s" : ""} ready for review`,
            description: "Publishing soon - review before they go live",
            actionLabel: "Preview & Approve",
          });
        }
        if (escalations > 0) {
          items.push({
            id: "escalations",
            type: "escalated_comment",
            title: `${escalations} escalat${escalations > 1 ? "ions" : "ion"} needs attention`,
            description: "AI needs human input",
            actionLabel: "Review",
          });
        }
        setAttentionItems(items);
      } else {
        setAttentionItems(DEFAULT_ATTENTION_ITEMS);
      }

      // Set activity
      if (activityData?.activities?.length > 0) {
        setActivity(activityData.activities.slice(0, 6));
      } else {
        setActivity(DEFAULT_ACTIVITY);
      }

      // Set coming up from overview
      if (overviewData?.comingUp?.items?.length > 0) {
        const upcoming = overviewData.comingUp.items.slice(0, 3).map((item: any) => ({
          id: item.id,
          time: item.timeLabel,
          platform: item.platform,
          contentType: item.contentType,
          preview: item.preview,
        }));
        setComingUp(upcoming);
      } else {
        setComingUp(DEFAULT_COMING_UP);
      }

      // Set wins
      if (winsData?.wins?.length > 0) {
        setWins(winsData.wins.slice(0, 4));
      } else {
        setWins(DEFAULT_WINS);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // Use defaults on error
      setMetrics(DEFAULT_METRICS);
      setAttentionItems(DEFAULT_ATTENTION_ITEMS);
      setActivity(DEFAULT_ACTIVITY);
      setComingUp(DEFAULT_COMING_UP);
      setWins(DEFAULT_WINS);
    }
    
    setLoading(false);
  }

  const MetricCard = ({ metric, icon: Icon, label }: { metric: Metric; icon: any; label: string }) => (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-sm">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground/70" />
        </div>
        <div className="text-2xl font-bold text-foreground">{metric.value}</div>
        <div className={`flex items-center gap-1 text-sm ${
          metric.trend === "up" ? "text-green-400" : 
          metric.trend === "down" ? "text-red-400" : "text-muted-foreground"
        }`}>
          {metric.trend === "up" ? <TrendingUp className="h-3 w-3" /> : 
           metric.trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
          <span>{metric.change}</span>
          <span className="text-muted-foreground/70">· {metric.period}</span>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Metrics skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 bg-muted" />
          ))}
        </div>
        {/* Attention skeleton */}
        <Skeleton className="h-40 bg-muted" />
        {/* Activity skeleton */}
        <Skeleton className="h-64 bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard metric={metrics[0]} icon={Users} label="Followers" />
        <MetricCard metric={metrics[1]} icon={Eye} label="Engagement" />
        <MetricCard metric={metrics[2]} icon={Globe} label="Reach" />
        <MetricCard metric={metrics[3]} icon={DollarSign} label="ROI" />
      </div>

      {/* Needs Attention */}
      {attentionItems.length > 0 && (
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Needs Your Attention
              <Badge variant="secondary" className="ml-auto bg-yellow-500/20 text-yellow-400">
                {attentionItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionItems.map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {item.type === "content_review" && <Sparkles className="h-5 w-5 text-blue-400" />}
                  {item.type === "escalated_comment" && <MessageCircle className="h-5 w-5 text-orange-400" />}
                  {item.type === "crisis_detected" && <AlertTriangle className="h-5 w-5 text-red-400" />}
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    {item.deadline && (
                      <p className="text-xs text-orange-400 mt-1">{item.deadline}</p>
                    )}
                  </div>
                </div>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  {item.actionLabel}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty attention state */}
      {attentionItems.length === 0 && (
        <Card className="bg-card/50 border-border">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-foreground font-medium">Nothing needs your attention</p>
            <p className="text-muted-foreground text-sm">Your AI is handling everything</p>
          </CardContent>
        </Card>
      )}

      {/* AI Activity */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            AI Activity
          </CardTitle>
          <Link href="/feed">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <span className="text-muted-foreground/70 shrink-0 w-20">{item.timestamp}</span>
                <span className="text-foreground/80">{item.action}</span>
                <span className="text-foreground">{item.details}</span>
                {item.platform && (
                  <Badge variant="outline" className="text-xs border-input">
                    {item.platform}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coming Up + Wins */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Coming Up */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              Coming Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comingUp.map((item) => {
              const Icon = PLATFORM_ICONS[item.platform] || Globe;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground text-sm">{item.time}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.platform} {item.contentType}: {item.preview}
                    </p>
                  </div>
                </div>
              );
            })}
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground mt-2">
                See full calendar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Wins */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Wins This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {wins.map((win) => (
              <div key={win.id} className="flex items-center gap-3">
                <span className="text-2xl">{win.icon}</span>
                <p className="text-foreground text-sm">{win.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Pulse */}
      <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Weekly Pulse
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Sparkline placeholder */}
          <div className="h-16 mb-4 flex items-end gap-1">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((height, i) => (
              <div 
                key={i}
                className="flex-1 bg-blue-500/50 rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <p className="text-foreground/80">
            Strong week overall. Your ingredient spotlight posts continue to outperform — I'm creating more of those. 
            LinkedIn engagement dipped slightly, likely due to the holiday. Adjusting next week's schedule to compensate.
          </p>
          <Link href="/reports">
            <Button variant="ghost" size="sm" className="text-blue-400 mt-3">
              Read full report <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
