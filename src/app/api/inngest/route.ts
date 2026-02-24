import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { contentPipeline, onUrgentTrend } from "@/inngest/functions/content-pipeline";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [contentPipeline, onUrgentTrend],
});
