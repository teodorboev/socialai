import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { contentPipeline, onUrgentTrend } from "@/inngest/functions/content-pipeline";
import { publishScheduled } from "@/inngest/functions/publish-scheduled";
import { engagementMonitor, onNewEngagement } from "@/inngest/functions/engagement-monitor";
import { analyticsSnapshot, weeklyAnalyticsReport } from "@/inngest/functions/analytics-snapshot";
import { monthlyStrategyPlanner, onOnboardingComplete } from "@/inngest/functions/strategy-planner";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    contentPipeline,
    onUrgentTrend,
    publishScheduled,
    engagementMonitor,
    onNewEngagement,
    analyticsSnapshot,
    weeklyAnalyticsReport,
    monthlyStrategyPlanner,
    onOnboardingComplete,
  ],
});
