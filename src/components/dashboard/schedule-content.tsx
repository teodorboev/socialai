"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ContentItem {
  id: string;
  caption: string;
  status: string;
  platform: string;
}

export function ScheduleContent({ content, onScheduled }: { content: ContentItem; onScheduled?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("12:00");

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    setLoading(true);

    const [hours, minutes] = time.split(":").map(Number);
    const scheduledFor = new Date(date);
    scheduledFor.setHours(hours, minutes, 0, 0);

    try {
      // Get social account for this content
      const response = await fetch(`/api/content/${content.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: scheduledFor.toISOString() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule");
      }

      toast.success("Content scheduled!");
      setOpen(false);
      onScheduled?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule");
    } finally {
      setLoading(false);
    }
  };

  if (content.status !== "APPROVED") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays className="h-4 w-4 mr-2" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>
          <div className="space-y-2">
            <Label>Select Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e: any) => setTime(e.target.value)}
            />
          </div>
          <div className="pt-2">
            <Button onClick={handleSchedule} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Schedule for {date?.toLocaleDateString()} at {time}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
