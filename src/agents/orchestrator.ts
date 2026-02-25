import { prisma } from "@/lib/prisma";

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface AgentTask {
  agent: string;
  priority: Priority;
  reason: string;
}

interface AgentTaskResult {
  success: boolean;
  message: string;
}

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  failureThreshold: 3,
  cooldownMinutes: 30,
  resetAfterSuccess: true,
};

interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
}

/**
 * Orchestrator - The central coordination layer for all AI agents
 * 
 * This is NOT a BaseAgent - it's a deterministic coordination layer.
 * It determines what needs to run, prioritizes work, and manages dependencies.
 */
export class Orchestrator {
  private circuitBreakers: Map<string, CircuitState> = new Map();

  /**
   * Determines which agents need to run for a given org right now.
   * This is called by scheduled functions to determine work.
   */
  async getAgentSchedule(organizationId: string): Promise<AgentTask[]> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        brandConfig: true,
        socialAccounts: { where: { isActive: true } },
        contentPlans: { where: { status: "ACTIVE" }, take: 1 },
        schedules: { where: { status: "PENDING" } },
        orgSettings: true,
      },
    });

    if (!org) {
      return [];
    }

    const tasks: AgentTask[] = [];

    // Check if we need content generated
    const scheduledNext48h = await this.getScheduledContentCount(organizationId, 48);
    const targetNext48h = this.getTargetContentCount(org);
    
    if (scheduledNext48h < targetNext48h) {
      tasks.push({
        agent: "CONTENT_CREATOR",
        priority: scheduledNext48h === 0 ? "HIGH" : "MEDIUM",
        reason: `Only ${scheduledNext48h}/${targetNext48h} posts scheduled for next 48h`,
      });
    }

    // Check if we need a new strategy
    const activePlan = org.contentPlans[0];
    if (!activePlan || new Date(activePlan.periodEnd) < new Date()) {
      tasks.push({
        agent: "STRATEGY",
        priority: "HIGH",
        reason: "No active content plan",
      });
    }

    // Check for unprocessed engagements
    const pendingEngagements = await prisma.engagement.count({
      where: { organizationId, aiResponseStatus: "PENDING" },
    });
    
    if (pendingEngagements > 0) {
      tasks.push({
        agent: "ENGAGEMENT",
        priority: pendingEngagements > 20 ? "HIGH" : "MEDIUM",
        reason: `${pendingEngagements} unprocessed engagements`,
      });
    }

    // Check for open escalations
    const openEscalations = await prisma.escalation.count({
      where: { organizationId, status: "OPEN" },
    });
    
    if (openEscalations > 0) {
      tasks.push({
        agent: "ESCALATION",
        priority: "CRITICAL",
        reason: `${openEscalations} open escalations need human attention`,
      });
    }

    // Sort by priority
    return tasks.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
  }

  /**
   * Get count of scheduled content in the next N hours
   */
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

  /**
   * Calculate target content count based on org settings
   */
  private getTargetContentCount(org: any): number {
    const settings = org.orgSettings;
    const platforms = org.socialAccounts.length;
    
    if (!settings) {
      return platforms * 3; // Default: 3 posts per platform
    }

    return platforms * (settings.maxPostsPerDayPerPlatform || 3) * 2; // 2 days buffer
  }

  /**
   * Check if an agent is available (circuit breaker not open)
   */
  isAgentAvailable(agentName: string, organizationId: string): boolean {
    const key = `${agentName}:${organizationId}`;
    const state = this.circuitBreakers.get(key);
    
    if (!state) {
      return true;
    }

    if (state.isOpen) {
      // Check if cooldown has passed
      const cooldownEnd = new Date(state.lastFailure!.getTime() + CIRCUIT_BREAKER.cooldownMinutes * 60 * 1000);
      if (new Date() > cooldownEnd) {
        // Reset circuit breaker
        this.circuitBreakers.set(key, { failures: 0, lastFailure: null, isOpen: false });
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Record agent failure - opens circuit breaker if threshold exceeded
   */
  recordFailure(agentName: string, organizationId: string): void {
    const key = `${agentName}:${organizationId}`;
    const state = this.circuitBreakers.get(key) || { failures: 0, lastFailure: null, isOpen: false };
    
    state.failures += 1;
    state.lastFailure = new Date();

    if (state.failures >= CIRCUIT_BREAKER.failureThreshold) {
      state.isOpen = true;
      console.error(`Circuit breaker opened for ${agentName}:${organizationId} after ${state.failures} failures`);
    }

    this.circuitBreakers.set(key, state);
  }

  /**
   * Record agent success - resets circuit breaker
   */
  recordSuccess(agentName: string, organizationId: string): void {
    if (CIRCUIT_BREAKER.resetAfterSuccess) {
      this.circuitBreakers.delete(`${agentName}:${organizationId}`);
    }
  }

  /**
   * Get orchestrator metrics for monitoring dashboard
   */
  async getMetrics(): Promise<{
    activeOrganizations: number;
    openEscalations: number;
    pendingSchedules: number;
    failedSchedules: number;
    totalSocialAccounts: number;
    activeSocialAccounts: number;
  }> {
    const [
      activeOrganizations,
      openEscalations,
      pendingSchedules,
      failedSchedules,
      totalSocialAccounts,
      activeSocialAccounts,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.escalation.count({ where: { status: "OPEN" } }),
      prisma.schedule.count({ where: { status: "PENDING" } }),
      prisma.schedule.count({ where: { status: "FAILED" } }),
      prisma.socialAccount.count(),
      prisma.socialAccount.count({ where: { isActive: true } }),
    ]);

    return {
      activeOrganizations,
      openEscalations,
      pendingSchedules,
      failedSchedules,
      totalSocialAccounts,
      activeSocialAccounts,
    };
  }
}

/**
 * Priority ordering for sorting
 */
function priorityOrder(p: Priority): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p];
}

// Export singleton instance
export const orchestrator = new Orchestrator();
