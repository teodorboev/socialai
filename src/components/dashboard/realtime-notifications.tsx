"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, X, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "escalation" | "content_approved" | "content_published" | "engagement";
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "critical";
  created_at: string;
  read: boolean;
}

interface RealtimeNotificationsProps {
  organizationId: string;
}

export function RealtimeNotifications({ organizationId }: RealtimeNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();

  // Fetch initial notifications
  useEffect(() => {
    async function fetchNotifications() {
      // Fetch recent escalations
      const { data: escalations } = await supabase
        .from("escalations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "OPEN")
        .order("created_at", { ascending: false })
        .limit(10);

      if (escalations) {
        const mapped: Notification[] = escalations.map((e) => ({
          id: e.id,
          type: "escalation" as const,
          title: `Escalation: ${e.agent_name}`,
          message: e.reason,
          priority: e.priority as "low" | "medium" | "high" | "critical",
          created_at: e.created_at,
          read: false,
        }));
        setNotifications(mapped);
        setUnreadCount(mapped.length);
      }
    }

    fetchNotifications();
  }, [organizationId, supabase]);

  // Subscribe to real-time events
  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "escalations",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newEscalation = payload.new as any;
          const notification: Notification = {
            id: newEscalation.id,
            type: "escalation",
            title: `New Escalation: ${newEscalation.agent_name}`,
            message: newEscalation.reason,
            priority: newEscalation.priority,
            created_at: newEscalation.created_at,
            read: false,
          };
          setNotifications((prev) => [notification, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "content",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newContent = payload.new as any;
          if (newContent.status === "PUBLISHED") {
            const notification: Notification = {
              id: newContent.id,
              type: "content_published",
              title: "Content Published",
              message: `Your ${newContent.content_type.toLowerCase()} has been published`,
              created_at: newContent.published_at || newContent.created_at,
              read: false,
            };
            setNotifications((prev) => [notification, ...prev].slice(0, 20));
            setUnreadCount((prev) => prev + 1);
          } else if (newContent.status === "PENDING_REVIEW") {
            const notification: Notification = {
              id: newContent.id,
              type: "content_approved",
              title: "Content Ready for Review",
              message: `New ${newContent.content_type.toLowerCase()} is waiting for approval`,
              created_at: newContent.created_at,
              read: false,
            };
            setNotifications((prev) => [notification, ...prev].slice(0, 20));
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "engagements",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newEngagement = payload.new as any;
          const notification: Notification = {
            id: newEngagement.id,
            type: "engagement",
            title: "New Engagement",
            message: `${newEngagement.engagement_type} from @${newEngagement.author_username}`,
            created_at: newEngagement.created_at,
            read: false,
          };
          setNotifications((prev) => [notification, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, supabase]);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const getIcon = (type: Notification["type"], priority?: string) => {
    if (type === "escalation") {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    if (priority === "critical") {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAsRead();
        }}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {isConnected && (
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-semibold">Notifications</h3>
            <span className="text-xs text-muted-foreground">
              {isConnected ? "Live" : "Connecting..."}
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex gap-3 p-3 hover:bg-muted/50",
                      !notification.read && "bg-muted/30"
                    )}
                  >
                    <div className="mt-0.5">{getIcon(notification.type, notification.priority)}</div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => dismissNotification(notification.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  window.location.href = "/dashboard/escalations";
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
