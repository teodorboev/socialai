import { inngest } from "../client";
import { CrisisResponseAgent } from "@/agents/crisis-response";
import { prisma } from "@/lib/prisma";
import { sendEscalationEmail } from "@/lib/email";

export const crisisMonitor = inngest.createFunction(
  {
    id: "crisis-monitor",
    name: "Crisis Monitor",
    retries: 3,
  },
  {
    cron: "*/15 * * * *", // Every 15 minutes
  },
  async ({ step }) => {
    // Get all active organizations with social accounts
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          socialAccounts: { where: { isActive: true }, take: 5 },
          members: {
            where: { role: "OWNER" },
            take: 1,
          },
        },
        take: 20,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (org.socialAccounts.length === 0) continue;

      // Check recent engagements for crisis indicators
      const recentEngagements = await step.run(`check-engagements-${org.id}`, async () => {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        return prisma.engagement.findMany({
          where: {
            organizationId: org.id,
            createdAt: { gte: oneHourAgo },
            isEscalated: false,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
      });

      // Check for negative sentiment spikes
      const negativeCount = recentEngagements.filter(
        (e: { sentiment: string | null }) => e.sentiment === "NEGATIVE" || e.sentiment === "URGENT"
      ).length;

      const threshold = 5; // Configurable per org
      if (negativeCount >= threshold) {
        // Run crisis response agent
        const crisisResult = await step.run(`analyze-crisis-${org.id}`, async () => {
          const agent = new CrisisResponseAgent();
          return agent.run(org.id, {
            organizationId: org.id,
            recentEngagements: recentEngagements.map((e: any) => ({
              type: e.engagementType,
              body: e.body,
              sentiment: e.sentiment,
              authorName: e.authorName,
            })),
            negativeCount,
            timeWindow: "1 hour",
          });
        });

        if (crisisResult.success && crisisResult.shouldEscalate) {
          // Create escalation
          await step.run(`create-crisis-escalation-${org.id}`, async () => {
            const escalation = await prisma.escalation.create({
              data: {
                organizationId: org.id,
                agentName: "CRISIS_RESPONSE",
                reason: `Crisis detected: ${negativeCount} negative engagements in the last hour`,
                context: crisisResult.data as any,
                priority: "CRITICAL",
                status: "OPEN",
              },
            });

            // Send email notification
            const owner = org.members[0];
            if (owner) {
              await sendEscalationEmail(
                owner.userId,
                {
                  id: escalation.id,
                  reason: escalation.reason,
                  priority: escalation.priority,
                  createdAt: escalation.createdAt,
                },
                org.name
              );
            }

            return escalation;
          });
        }

        results.push({ orgId: org.id, negativeCount, escalated: crisisResult.shouldEscalate });
      }
    }

    return { organizationsChecked: results.length, crisisDetected: results.filter(r => r.escalated).length };
  }
);
