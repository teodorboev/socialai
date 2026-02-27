"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, Sparkles, MessageCircle, AlertTriangle, TrendingUp, 
  Calendar, DollarSign, CheckCircle, X, ArrowLeft, Filter,
  Instagram, Linkedin, Globe, Mail
} from "lucide-react";
import Link from "next/link";

type NotificationType = 
  | "content_ready"
  | "daily_digest"
  | "escalation"
  | "crisis"
  | "viral"
  | "milestone"
  | "competitor_alert"
  | "weekly_report"
  | "strategy_review"
  | "roi_report"
  | "ai_question";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}

// Default notifications when no real data
const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: "welcome",
    type: "ai_question",
    title: "Welcome to SocialAI!",
    message: "Your AI social media manager is ready. Complete your brand setup to get started.",
    read: false,
    createdAt: "Now",
    actionUrl: "/dashboard/brand",
    actionLabel: "Set up Brand",
  },
];

// Icon mapping
const NOTIFICATION_ICONS: Record<string, any> = {
  content_ready: Sparkles,
  daily_digest: Calendar,
  escalation: MessageCircle,
  crisis: AlertTriangle,
  viral: TrendingUp,
  milestone: CheckCircle,
  competitor_alert: AlertTriangle,
  weekly_report: DollarSign,
  strategy_review: Sparkles,
  roi_report: DollarSign,
  ai_question: MessageCircle,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  content_ready: "text-blue-400 bg-blue-500/20",
  daily_digest: "text-purple-400 bg-purple-500/20",
  escalation: "text-orange-400 bg-orange-500/20",
  crisis: "text-red-400 bg-red-500/20",
  viral: "text-yellow-400 bg-yellow-500/20",
  milestone: "text-green-400 bg-green-500/20",
  competitor_alert: "text-red-400 bg-red-500/20",
  weekly_report: "text-blue-400 bg-blue-500/20",
  strategy_review: "text-purple-400 bg-purple-500/20",
  roi_report: "text-green-400 bg-green-500/20",
  ai_question: "text-blue-400 bg-blue-500/20",
};

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const response = await fetch("/api/mission-control/notifications");
      const data = response.ok ? await response.json() : null;
      
      if (data?.notifications?.length > 0) {
        setNotifications(data.notifications);
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotifications(DEFAULT_NOTIFICATIONS);
    }
    setLoading(false);
  }

  async function markAsRead(id: string) {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  async function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function dismissNotification(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-12 w-48 bg-slate-800" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
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
            <Bell className="h-6 w-6" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-red-500/20 text-red-400">
                {unreadCount} new
              </Badge>
            )}
          </h1>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("unread")}
        >
          Unread ({unreadCount})
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.map((notification) => {
          const Icon = NOTIFICATION_ICONS[notification.type];
          const colorClass = NOTIFICATION_COLORS[notification.type];
          
          return (
            <Card 
              key={notification.id} 
              className={`bg-slate-900/50 border-slate-800 transition-all ${
                !notification.read ? "border-l-4 border-l-blue-500" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{notification.title}</p>
                        <p className="text-slate-400 text-sm mt-1">{notification.message}</p>
                        <p className="text-slate-500 text-xs mt-2">{notification.createdAt}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => dismissNotification(notification.id)}
                        >
                          <X className="h-4 w-4 text-slate-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Action */}
                    {notification.actionUrl && (
                      <div className="mt-3">
                        <Link href={notification.actionUrl}>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                            {notification.actionLabel || "View"}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredNotifications.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No notifications</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
