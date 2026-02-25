import { inngest } from "../client";
import { CalendarOptimizerAgent } from "@/agents/calendar-optimizer";
import { prisma } from "@/lib/prisma";

export const calendarOptimizer = inngest.createFunction(
  {
    id: "calendar-optimizer",
    name: "Calendar Optimizer",
    retries: 2,
  },
  {
    cron: "0 3 * * *", // Daily at 3 AM
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          schedules: {
            where: { status: "PENDING" },
            include: { content: true },
          },
        },
        take: 30,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (org.schedules.length === 0) continue;

      const optimizeResult = await step.run(`optimize-calendar-${org.id}`, async () => {
        const agent = new CalendarOptimizerAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          currentSchedules: org.schedules.map((s: any) => ({
            id: s.id,
            scheduledFor: s.scheduledFor,
            platform: s.content?.platform,
          })),
          socialAccounts: org.socialAccounts.map((a: any) => ({
            platform: a.platform,
            timezone: "UTC",
          })),
        });
      });

      if (optimizeResult.success && optimizeResult.data) {
        const data = optimizeResult.data as any;
        
        // Apply recommendations if confidence is high
        if (data.recommendations?.length > 0 && optimizeResult.confidenceScore > 0.8) {
          await step.run(`apply-optimizations-${org.id}`, async () => {
            for (const rec of data.recommendations.slice(0, 5)) {
              if (rec.type === "reschedule" && rec.scheduleId && rec.newTime) {
                await prisma.schedule.update({
                  where: { id: rec.scheduleId },
                  data: { scheduledFor: new Date(rec.newTime) },
                });
              }
            }
          });
        }

        results.push({ orgId: org.id, recommendations: data.recommendations?.length || 0 });
      }
    }

    return { organizationsOptimized: results.length };
  }
);
