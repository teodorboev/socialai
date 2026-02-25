import { prisma } from "@/lib/prisma";
import type { AgentName, Organization, SocialAccount, OrgSettings } from "@prisma/client";
import { priorityOrder, type Priority } from "./task-queue";
import { recordFailure, recordSuccess, isCircuitOpen } from "./circuit-breaker";

export interface DispatchTask {
  agent: AgentName;
  organizationId: string;
  priority: Priority;
  reason: string;
  input?: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  tasksDispatched: number;
  skipped: number;
  errors: string[];
}

export interface OrganizationHealth {
  organizationId: string;
  needsContent: boolean;
  needsStrategy: boolean;
  needsEngagement: boolean;
  needsEscalation: boolean;
  needsVisuals: boolean;
  contentDeficit: number;
  pendingEngagements: number;
  openEscalations: number;
}

const MAX_CONCURRENT_ORGS = 5;
const CONTENT_BUFFER_HOURS = 48;

export class Brain {
  async dispatchTasksForOrganization(organizationId: string): Promise<DispatchTask[]> {
    const tasks: DispatchTask[] = [];
    
    const health = await this.getOrganizationHealth(organizationId);
    
    if (health.needsContent) {
      tasks.push({
        agent: "CONTENT_CREATOR",
        organizationId,
        priority: health.contentDeficit === 0 ? "HIGH" : "MEDIUM",
        reason: `Content deficit: ${health.contentDeficit} posts needed`,
      });
    }

    if (health.needsVisuals) {
      tasks.push({
        agent: "CREATIVE_DIRECTOR",
        organizationId,
        priority: "MEDIUM",
        reason: "Content pending visual generation",
      });
    }

    if (health.needsStrategy) {
      tasks.push({
        agent: "STRATEGY",
        organizationId,
        priority: "HIGH",
        reason: "No active content plan",
      });
    }

    if (health.needsEngagement) {
      tasks.push({
        agent: "ENGAGEMENT",
        organizationId,
        priority: health.pendingEngagements > 20 ? "HIGH" : "MEDIUM",
        reason: `${health.pendingEngagements} pending engagements`,
      });
    }

    if (health.needsEscalation) {
      tasks.push({
        agent: "ANALYTICS",
        organizationId,
        priority: "CRITICAL",
        reason: `${health.openEscalations} open escalations`,
      });
    }

    return tasks.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
  }

  async getOrganizationHealth(organizationId: string): Promise<OrganizationHealth> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        brandConfig: true,
        socialAccounts: { where: { isActive: true } },
        contentPlans: { where: { status: "ACTIVE" }, take: 1 },
        orgSettings: true,
      },
    });

    if (!org) {
      return {
        organizationId,
        needsContent: false,
        needsStrategy: false,
        needsEngagement: false,
        needsEscalation: false,
        needsVisuals: false,
        contentDeficit: 0,
        pendingEngagements: 0,
        openEscalations: 0,
      };
    }

    const [scheduledCount, pendingEngagements, openEscalations, contentWithoutVisuals] = await Promise.all([
      this.getScheduledContentCount(organizationId, CONTENT_BUFFER_HOURS),
      prisma.engagement.count({
        where: { organizationId, aiResponseStatus: "PENDING" },
      }),
      prisma.escalation.count({
        where: { organizationId, status: "OPEN" },
      }),
      prisma.content.count({
        where: {
          organizationId,
          status: { in: ["APPROVED", "SCHEDULED", "PENDING_REVIEW"] },
          mediaUrls: { isEmpty: true },
        },
      }),
    ]);

    const targetCount = this.calculateTargetContentCount(org);
    const contentDeficit = Math.max(0, targetCount - scheduledCount);

    const activePlan = org.contentPlans[0];
    const planExpired = !activePlan || new Date(activePlan.periodEnd) < new Date();

    return {
      organizationId,
      needsContent: contentDeficit > 0,
      needsStrategy: planExpired,
      needsEngagement: pendingEngagements > 0,
      needsEscalation: openEscalations > 0,
      needsVisuals: contentWithoutVisuals > 0,
      contentDeficit,
      pendingEngagements,
      openEscalations,
    };
  }

  private async getScheduledContentCount(organizationId: string, hoursAhead: number): Promise<number> {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + hoursAhead);

    return prisma.schedule.count({
      where: {
        organizationId,
        status: "PENDING",
        scheduledFor: {
          gte: new Date(),
          lte: futureDate,
        },
      },
    });
  }

  private calculateTargetContentCount(
    org: Organization & {
      socialAccounts: SocialAccount[];
      orgSettings: OrgSettings | null;
    }
  ): number {
    const settings = org.orgSettings;
    const platformCount = org.socialAccounts.length;

    if (!settings) {
      return platformCount * 6;
    }

    const dailyPerPlatform = settings.maxPostsPerDayPerPlatform || 3;
    const bufferDays = settings.contentBufferDays || 2;

    return platformCount * dailyPerPlatform * bufferDays;
  }

  async dispatchForAllOrganizations(): Promise<DispatchResult> {
    const organizations = await prisma.organization.findMany({
      where: {
        plan: { not: "STARTER" },
        brandConfig: { isNot: null },
      },
      include: {
        orgSettings: true,
        socialAccounts: { where: { isActive: true } },
      },
      take: MAX_CONCURRENT_ORGS,
    });

    const allTasks: DispatchTask[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const org of organizations) {
      if (!org.orgSettings || org.socialAccounts.length === 0) {
        skipped++;
        continue;
      }

      const tasks = await this.dispatchTasksForOrganization(org.id);
      allTasks.push(...tasks);
    }

    const sortedTasks = allTasks.sort(
      (a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)
    );

    return {
      success: true,
      tasksDispatched: sortedTasks.length,
      skipped,
      errors,
    };
  }

  shouldRunAgent(agentName: AgentName, organizationId: string): boolean {
    return !isCircuitOpen(agentName, organizationId);
  }

  async executeTask(task: DispatchTask): Promise<{ success: boolean; error?: string }> {
    if (!this.shouldRunAgent(task.agent, task.organizationId)) {
      return {
        success: false,
        error: `Circuit breaker open for ${task.agent}`,
      };
    }

    try {
      const result = await this.runAgent(task.agent, task.organizationId, task.input);

      if (result.success) {
        recordSuccess(task.agent, task.organizationId);
      } else {
        recordFailure(task.agent, task.organizationId);
      }

      return result;
    } catch (error) {
      recordFailure(task.agent, task.organizationId);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async runAgent(
    agentName: AgentName,
    organizationId: string,
    input?: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    switch (agentName) {
      case "CONTENT_CREATOR": {
        const { ContentCreatorAgent } = await import("@/agents/content-creator");
        const agent = new ContentCreatorAgent();
        const result = await agent.run(organizationId, input || {});
        return { success: result.success, error: result.shouldEscalate ? "Escalated" : undefined };
      }

      case "ENGAGEMENT": {
        const { EngagementAgent } = await import("@/agents/engagement");
        const agent = new EngagementAgent();
        const result = await agent.run(organizationId, input || {});
        return { success: result.success, error: result.shouldEscalate ? "Escalated" : undefined };
      }

      case "STRATEGY": {
        const { StrategyAgent } = await import("@/agents/strategy");
        const agent = new StrategyAgent();
        const result = await agent.run(organizationId, input || {});
        return { success: result.success, error: result.shouldEscalate ? "Escalated" : undefined };
      }

      case "ANALYTICS": {
        const { AnalyticsAgent } = await import("@/agents/analytics");
        const agent = new AnalyticsAgent();
        const result = await agent.run(organizationId, input || {});
        return { success: result.success, error: result.shouldEscalate ? "Escalated" : undefined };
      }

      case "TREND_SCOUT": {
        const { TrendScoutAgent } = await import("@/agents/trend-scout");
        const agent = new TrendScoutAgent();
        const result = await agent.run(organizationId, input || {});
        return { success: result.success, error: result.shouldEscalate ? "Escalated" : undefined };
      }

      case "CREATIVE_DIRECTOR": {
        const { CreativeDirectorAgent } = await import("@/agents/creative-director");
        const agent = new CreativeDirectorAgent();
        const result = await agent.run(organizationId, input || {});
        return { success: result.success, error: result.shouldEscalate ? "Escalated" : undefined };
      }

      default:
        return { success: false, error: `Unknown agent: ${agentName}` };
    }
  }
}

export const brain = new Brain();
