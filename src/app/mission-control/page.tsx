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

// Mock data for display
const MOCK_METRICS: Metric[] = [
  { value: "3,230", change: "+127", trend: "up", period: "this week" },
  { value: "4.2%", change: "+0.8%", trend: "up", period: "this week" },
  { value: "45.2K", change: "+12K", trend: "up", period: "this week" },
  { value: "$2,340", change: "+$890", trend: "up", period: "weekly" },
];

const MOCK_ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: "1",
    type: "content_review",
    title: "3 posts ready for review",
    description: "Publishing tomorrow starting 9am",
    actionLabel: "Preview & Approve All",
    deadline: "Approve by tonight",
  },
  {
    id: "2",
    type: "escalated_comment",
    title: "Customer complaint getting traction",
    description: "23 replies - AI drafted a response",
    actionLabel: "See response & approve",
  },
];

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: "1", timestamp: "2 min ago", action: "Published", details: '"5 ingredients to avoid..." on IG', platform: "Instagram" },
  { id: "2", timestamp: "15 min ago", action: "Replied to", details: "4 comments on yesterday's post" },
  { id: "3", timestamp: "1 hour ago", action: "Generated", details: "5 posts for next week" },
  { id: "4", timestamp: "3 hours ago", action: "Detected trending", details: '#CleanBeautyWeek → Creating themed post', platform: "Instagram" },
  { id: "5", timestamp: "Yesterday", action: "Weekly report", details: "Sent to your email" },
  { id: "6", timestamp: "Yesterday", action: "Competitor alert", details: 'Herbivore launched new campaign → Adjusting content' },
];

const MOCK_COMING_UP: ComingUpItem[] = [
  { id: "1", time: "Today 6pm", platform: "Instagram", contentType: "Reel", preview: "skincare routine tips" },
  { id: "2", time: "Tomorrow 9am", platform: "Instagram", contentType: "Carousel", preview: "top 5 ingredients" },
  { id: "3", time: "Tomorrow 8am", platform: "LinkedIn", contentType: "Post", preview: "industry trend analysis" },
];

const MOCK_WINS: WinItem[] = [
  { id: "1", type: "viral", description: "Reel hit 12K views", icon: "🔥" },
  { id: "2", type: "followers", description: "127 new followers", icon: "💛" },
  { id: "3", type: "clicks", description: "34 website clicks from Tuesday's carousel", icon: "🛒" },
  { id: "4", type: "review", description: "5-star review on Google → AI responded", icon: "⭐" },
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
    // In production, this would fetch from the database
    // For now, use mock data with a loading delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setMetrics(MOCK_METRICS);
    setAttentionItems(MOCK_ATTENTION_ITEMS);
    setActivity(MOCK_ACTIVITY);
    setComingUp(MOCK_COMING_UP);
    setWins(MOCK_WINS);
    setLoading(false);
  }

  const MetricCard = ({ metric, icon: Icon, label }: { metric: Metric; icon: any; label: string }) => (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-sm">{label}</span>
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div className="text-2xl font-bold text-white">{metric.value}</div>
        <div className={`flex items-center gap-1 text-sm ${
          metric.trend === "up" ? "text-green-400" : 
          metric.trend === "down" ? "text-red-400" : "text-slate-400"
        }`}>
          {metric.trend === "up" ? <TrendingUp className="h-3 w-3" /> : 
           metric.trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
          <span>{metric.change}</span>
          <span className="text-slate-500">· {metric.period}</span>
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
            <Skeleton key={i} className="h-28 bg-slate-800" />
          ))}
        </div>
        {/* Attention skeleton */}
        <Skeleton className="h-40 bg-slate-800" />
        {/* Activity skeleton */}
        <Skeleton className="h-64 bg-slate-800" />
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
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
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
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {item.type === "content_review" && <Sparkles className="h-5 w-5 text-blue-400" />}
                  {item.type === "escalated_comment" && <MessageCircle className="h-5 w-5 text-orange-400" />}
                  {item.type === "crisis_detected" && <AlertTriangle className="h-5 w-5 text-red-400" />}
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-sm text-slate-400">{item.description}</p>
                    {item.deadline && (
                      <p className="text-xs text-orange-400 mt-1">{item.deadline}</p>
                    )}
                  </div>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  {item.actionLabel}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty attention state */}
      {attentionItems.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-white font-medium">Nothing needs your attention</p>
            <p className="text-slate-400 text-sm">Your AI is handling everything</p>
          </CardContent>
        </Card>
      )}

      {/* AI Activity */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            AI Activity
          </CardTitle>
          <Link href="/feed">
            <Button variant="ghost" size="sm" className="text-slate-400">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <span className="text-slate-500 shrink-0 w-20">{item.timestamp}</span>
                <span className="text-slate-300">{item.action}</span>
                <span className="text-white">{item.details}</span>
                {item.platform && (
                  <Badge variant="outline" className="text-xs border-slate-600">
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
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              Coming Up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comingUp.map((item) => {
              const Icon = PLATFORM_ICONS[item.platform] || Globe;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">{item.time}</p>
                    <p className="text-slate-400 text-xs">
                      {item.platform} {item.contentType}: {item.preview}
                    </p>
                  </div>
                </div>
              );
            })}
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="w-full text-slate-400 mt-2">
                See full calendar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Wins */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Wins This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {wins.map((win) => (
              <div key={win.id} className="flex items-center gap-3">
                <span className="text-2xl">{win.icon}</span>
                <p className="text-white text-sm">{win.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Pulse */}
      <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2">
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
          <p className="text-slate-300">
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
