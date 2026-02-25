/**
 * Weekly Goal Check Inngest Function
 * 
 * Runs weekly to check goal progress and auto-adjust strategy when behind.
 * Based on the goal-tracking skill specification.
 */

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { calculateGoalProgress, createCheckpoint, checkGoalProgress, getGoalSummary } from "@/lib/goals/tracker";
import { memory } from "@/lib/memory";

export const weeklyGoalCheck = inngest.createFunction(
  { id: "weekly-goal-check", retries: 2 },
  { cron: "0 6 * * 1" }, // Weekly on Monday at 6am
  async ({ step }) => {
    // Get all organizations with active goals
    const organizations = await step.run("get-orgs-with-goals", async () => {
      return prisma.organization.findMany({
        where: {
          goals: {
            some: {
              isActive: true,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });
    });

    const results = {
      checked: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      adjustments: 0,
    };

    for (const org of organizations) {
      try {
        // Get current metrics for this org
        const metrics = await step.run(`get-metrics-${org.id}`, async () => {
          // Get latest analytics snapshots
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const snapshots = await prisma.analyticsSnapshot.findMany({
            where: {
              organizationId: org.id,
              snapshotDate: { gte: thirtyDaysAgo },
            },
            orderBy: { snapshotDate: "desc" },
          });

          // Calculate current metrics
          const totalFollowers = snapshots.reduce((sum, s) => sum + (s.followers ?? 0), 0);
          const avgEngagement = snapshots.reduce((sum, s) => sum + (s.engagementRate ?? 0), 0) / Math.max(snapshots.length, 1);
          const totalClicks = snapshots.reduce((sum, s) => sum + (s.clicks ?? 0), 0);

          return {
            followers: totalFollowers,
            engagementRate: avgEngagement,
            clicks: totalClicks,
          };
        });

        // Check goal progress
        const goalStatus = await step.run(`check-goals-${org.id}`, async () => {
          return checkGoalProgress(org.id);
        });

        results.checked++;
        results.onTrack += goalStatus.onTrack;
        results.atRisk += goalStatus.atRisk;
        results.offTrack += goalStatus.offTrack;

        // Get goals and create checkpoints
        const goals = await step.run(`get-goals-${org.id}`, async () => {
          const { getActiveGoals } = await import("@/lib/goals/tracker");
          return getActiveGoals(org.id);
        });

        // Calculate period dates
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        const weekEnd = now;

        for (const goal of goals) {
          // Determine current value based on goal type
          let currentValue = 0;
          switch (goal.type) {
            case "grow_followers":
              currentValue = metrics.followers;
              break;
            case "increase_engagement":
              currentValue = metrics.engagementRate * 100;
              break;
            case "drive_website_traffic":
              currentValue = metrics.clicks;
              break;
            default:
              currentValue = 0;
          }

          // Create checkpoint
          await step.run(`checkpoint-${goal.id}`, async () => {
            const { createCheckpoint } = await import("@/lib/goals/tracker");
            await createCheckpoint(goal.id, weekStart, weekEnd, currentValue);
          });
        }

        // If significantly off-track, create attention item and adjust strategy
        if (goalStatus.offTrack > 0) {
          await step.run(`create-attention-${org.id}`, async () => {
            // Create attention item for human
            const details = `On track: ${goalStatus.onTrack}, At risk: ${goalStatus.atRisk}, Off track: ${goalStatus.offTrack}, Total: ${goals.length}`;
            await prisma.attentionItem.create({
              data: {
                organizationId: org.id,
                type: "GOAL_OFF_TRACK" as any,
                title: `Goal Progress Alert: ${goalStatus.offTrack} off track`,
                description: `${org.name} has ${goalStatus.offTrack} goal(s) significantly behind target. ${details}`,
                priority: goalStatus.offTrack >= goals.length / 2 ? "HIGH" : "MEDIUM",
              },
            });

            // Store in memory
            await memory.store({
              organizationId: org.id,
              content: `Weekly goal check: ${goalStatus.onTrack} on track, ${goalStatus.atRisk} at risk, ${goalStatus.offTrack} off track. ${goalStatus.offTrack > 0 ? "Strategy adjustment needed." : ""}`,
              memoryType: "strategy_decision",
              agentSource: "GOAL_TRACKER",
              importance: goalStatus.offTrack > 0 ? 0.8 : 0.5,
            });
          });

          results.adjustments++;
        }

      } catch (error) {
        console.error(`Error checking goals for org ${org.id}:`, error);
      }
    }

    return results;
  }
);
