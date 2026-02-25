"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface ContentCalendarProps {
  initialContent: any[];
}

export function ContentCalendar({ initialContent }: ContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [content] = useState(initialContent);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Group content by date
  const contentByDate: Record<string, any[]> = {};
  content.forEach((item: any) => {
    const schedule = item.schedules?.[0];
    const date = schedule?.scheduled_for
      ? new Date(schedule.scheduled_for).toDateString()
      : new Date(item.created_at).toDateString();
    if (!contentByDate[date]) {
      contentByDate[date] = [];
    }
    contentByDate[date].push(item);
  });

  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-500",
    PENDING_REVIEW: "bg-yellow-500",
    APPROVED: "bg-blue-500",
    SCHEDULED: "bg-purple-500",
    PUBLISHED: "bg-green-500",
    FAILED: "bg-red-500",
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {monthName} {year}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="h-20" />;
            }

            const date = new Date(year, month, day).toDateString();
            const dayContent = contentByDate[date] || [];
            const isToday = new Date().toDateString() === date;

            return (
              <div
                key={day}
                className={`h-20 border rounded p-1 ${
                  isToday ? "border-blue-500 bg-blue-50" : "bg-white"
                }`}
              >
                <div className="text-xs font-medium">{day}</div>
                <div className="space-y-1 mt-1">
                  {dayContent.slice(0, 2).map((item: any) => (
                    <div
                      key={item.id}
                      className={`text-[10px] px-1 py-0.5 rounded truncate ${
                        statusColors[item.status] || "bg-gray-500"
                      } text-white`}
                    >
                      {item.platform}
                    </div>
                  ))}
                  {dayContent.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayContent.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
