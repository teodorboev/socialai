import { inngest } from "@/inngest/client";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { CreativeDirectorAgent } from "@/agents/creative-director";
import { PublisherAgent } from "@/agents/publisher";
import { EngagementAgent } from "@/agents/engagement";
import { AnalyticsAgent } from "@/agents/analytics";
import { StrategyAgent } from "@/agents/strategy";
import { TrendScoutAgent } from "@/agents/trend-scout";
import { prisma } from "@/lib/prisma";
import { getConfidenceThresholds, determineContentAction } from "@/lib/confidence";
import type { AgentName, Platform, ContentStatus } from "@prisma/client";

export type PipelineName =
  | "content"
  | "engagement"
  | "analytics"
  | "strategy"
  | "trend"
  | "publish"
  | "onboarding";

export interface PipelineStep {
  agent: AgentName;
  name: string;
  required: boolean;
  continueOnFailure: boolean;
}

export interface PipelineResult {
  pipeline: PipelineName;
  success: boolean;
  steps: PipelineStepResult[];
  totalDurationMs: number;
  error?: string;
}

export interface PipelineStepResult {
  step: string;
  agent: AgentName;
  success: boolean;
  durationMs: number;
  output?: unknown;
  error?: string;
}

export const CONTENT_PIPELINE_STEPS: PipelineStep[] = [
  { agent: "CONTENT_CREATOR", name: "Generate content", required: true, continueOnFailure: false },
  { agent: "CREATIVE_DIRECTOR", name: "Generate visuals", required: false, continueOnFailure: true },
  { agent: "PUBLISHER", name: "Publish content", required: false, continueOnFailure: true },
];

export const ENGAGEMENT_PIPELINE_STEPS: PipelineStep[] = [
  { agent: "ENGAGEMENT", name: "Process engagement", required: true, continueOnFailure: false },
];

export const STRATEGY_PIPELINE_STEPS: PipelineStep[] = [
  { agent: "STRATEGY", name: "Generate strategy", required: true, continueOnFailure: false },
  { agent: "CONTENT_CREATOR", name: "Generate initial content", required: false, continueOnFailure: true },
];

export const PIPELINES: Record<PipelineName, PipelineStep[]> = {
  content: CONTENT_PIPELINE_STEPS,
  engagement: ENGAGEMENT_PIPELINE_STEPS,
  analytics: [],
  strategy: STRATEGY_PIPELINE_STEPS,
  trend: [],
  publish: [],
  onboarding: [],
};

export class Pipeline {
  constructor(private pipelineName: PipelineName) {}

  async execute(
    organizationId: string,
    input?: Record<string, unknown>
  ): Promise<PipelineResult> {
    const steps = PIPELINES[this.pipelineName];
    const results: PipelineStepResult[] = [];
    const startTime = Date.now();

    let hasFailed = false;

    for (const step of steps) {
      const stepStartTime = Date.now();

      if (hasFailed && !step.continueOnFailure) {
        results.push({
          step: step.name,
          agent: step.agent,
          success: false,
          durationMs: 0,
          error: "Skipped due to previous failure",
        });
        continue;
      }

      try {
        const output = await this.executeStep(step.agent, organizationId, input);
        
        results.push({
          step: step.name,
          agent: step.agent,
          success: true,
          durationMs: Date.now() - stepStartTime,
          output,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        results.push({
          step: step.name,
          agent: step.agent,
          success: false,
          durationMs: Date.now() - stepStartTime,
          error: errorMessage,
        });

        if (step.required) {
          hasFailed = true;
        }
      }
    }

    return {
      pipeline: this.pipelineName,
      success: !hasFailed,
      steps: results,
      totalDurationMs: Date.now() - startTime,
      error: hasFailed ? "Pipeline failed" : undefined,
    };
  }

  private async executeStep(
    agent: AgentName,
    organizationId: string,
    input?: Record<string, unknown>
  ): Promise<unknown> {
    switch (agent) {
      case "CONTENT_CREATOR": {
        const agent = new ContentCreatorAgent();
        const result = await agent.run(organizationId, input || {});
        
        if (result.success && result.data) {
          await this.handleContentResult(organizationId, result.data, result.confidenceScore);
        }
        
        return result.data;
      }

      case "CREATIVE_DIRECTOR": {
        const agent = new CreativeDirectorAgent();
        return (await agent.run(organizationId, input || {})).data;
      }

      case "PUBLISHER": {
        const agent = new PublisherAgent();
        return (await agent.run(organizationId, input || {})).data;
      }

      case "ENGAGEMENT": {
        const agent = new EngagementAgent();
        return (await agent.run(organizationId, input || {})).data;
      }

      case "STRATEGY": {
        const agent = new StrategyAgent();
        return (await agent.run(organizationId, input || {})).data;
      }

      case "ANALYTICS": {
        const agent = new AnalyticsAgent();
        return (await agent.run(organizationId, input || {})).data;
      }

      case "TREND_SCOUT": {
        const agent = new TrendScoutAgent();
        return (await agent.run(organizationId, input || {})).data;
      }

      default:
        throw new Error(`Unknown agent: ${agent}`);
    }
  }

  private async handleContentResult(
    organizationId: string,
    contentData: unknown,
    confidenceScore: number
  ): Promise<void> {
    const thresholds = await getConfidenceThresholds(organizationId);
    const action = determineContentAction(confidenceScore, thresholds);

    const content = contentData as {
      caption?: string;
      hashtags?: string[];
      contentType?: string;
      platform?: string;
    };

    const statusMap: Record<string, ContentStatus> = {
      auto_publish: "APPROVED",
      flag_and_publish: "APPROVED",
      queue_for_review: "PENDING_REVIEW",
      escalate: "PENDING_REVIEW",
    };

    const status = statusMap[action] || "DRAFT";

    await prisma.content.create({
      data: {
        organizationId,
        platform: (content.platform?.toUpperCase() || "INSTAGRAM") as Platform,
        contentType: (content.contentType as any) || "POST",
        status,
        caption: content.caption || "",
        hashtags: content.hashtags || [],
        confidenceScore,
      },
    });
  }
}

export function createPipeline(name: PipelineName): Pipeline {
  return new Pipeline(name);
}

export const contentPipeline = inngest.createFunction(
  {
    id: "content-pipeline",
    name: "Content Pipeline",
    retries: 2,
  },
  {
    cron: "0 */4 * * *",
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-organizations", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          orgSettings: true,
        },
        take: 10,
      });
    });

    const results = [];

    for (const org of organizations) {
      const result = await step.run(`content-pipeline-${org.id}`, async () => {
        const pipeline = createPipeline("content");
        
        const brandConfig = org.brandConfig;
        if (!brandConfig) return { success: false, error: "No brand config" };

        return pipeline.execute(org.id, {
          organizationId: org.id,
          platform: org.socialAccounts[0]?.platform.toLowerCase() || "instagram",
          brandConfig: {
            brandName: brandConfig.brandName,
            voiceTone: brandConfig.voiceTone,
            contentThemes: brandConfig.contentThemes,
            doNots: brandConfig.doNots,
            targetAudience: brandConfig.targetAudience,
            hashtagStrategy: brandConfig.hashtagStrategy,
          },
        });
      });

      results.push({ orgId: org.id, ...result });
    }

    return { processed: organizations.length, results };
  }
);

export const engagementPipeline = inngest.createFunction(
  {
    id: "engagement-pipeline",
    name: "Engagement Pipeline",
    retries: 2,
  },
  {
    cron: "*/15 * * * *",
  },
  async ({ step }) => {
    const pendingEngagements = await step.run("get-pending-engagements", async () => {
      return prisma.engagement.findMany({
        where: {
          aiResponseStatus: "PENDING",
        },
        include: {
          organization: {
            include: { brandConfig: true },
          },
          socialAccount: true,
        },
        take: 50,
      });
    });

    const results = [];

    for (const engagement of pendingEngagements) {
      const result = await step.run(`process-${engagement.id}`, async () => {
        if (!engagement.organization.brandConfig) {
          return { success: false, error: "No brand config" };
        }

        const agent = new EngagementAgent();
        const agentResult = await agent.run(engagement.organizationId, {
          organizationId: engagement.organizationId,
          platform: engagement.platform.toLowerCase(),
          brandConfig: {
            brandName: engagement.organization.brandConfig.brandName,
            voiceTone: engagement.organization.brandConfig.voiceTone,
            faqKnowledge: engagement.organization.brandConfig.faqKnowledge,
            doNots: engagement.organization.brandConfig.doNots,
          },
          engagementType: engagement.engagementType.toLowerCase(),
          authorName: engagement.authorName || "Unknown",
          body: engagement.body || "",
        });

        if (agentResult.success && agentResult.data) {
          const responseData = agentResult.data as { response?: string; shouldRespond?: boolean };
          
          await prisma.engagement.update({
            where: { id: engagement.id },
            data: {
              aiResponse: responseData.response,
              aiResponseStatus: responseData.shouldRespond ? "AUTO_RESPONDED" : "SKIPPED",
              confidenceScore: agentResult.confidenceScore,
              respondedAt: new Date(),
            },
          });
        }

        return agentResult;
      });

      results.push({ engagementId: engagement.id, ...result });
    }

    return { processed: pendingEngagements.length, results };
  }
);

export const strategyPipeline = inngest.createFunction(
  {
    id: "strategy-pipeline",
    name: "Strategy Pipeline",
    retries: 2,
  },
  {
    cron: "0 9 1 * *",
  },
  async ({ step }) => {
    const organizations = await step.run("get-organizations-needing-strategy", async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
          contentPlans: {
            where: {
              status: "ACTIVE",
              periodEnd: { gte: new Date() },
            },
            take: 1,
          },
        },
      });
    });

    const needsStrategy = organizations.filter(
      (org) => !org.contentPlans.length || new Date(org.contentPlans[0].periodEnd) < new Date()
    );

    const results = [];

    for (const org of needsStrategy) {
      const result = await step.run(`strategy-${org.id}`, async () => {
        if (!org.brandConfig) {
          return { success: false, error: "No brand config" };
        }

        const pipeline = createPipeline("strategy");
        return pipeline.execute(org.id, {
          organizationId: org.id,
          brandConfig: {
            brandName: org.brandConfig.brandName,
            industry: org.brandConfig.industry,
            targetAudience: org.brandConfig.targetAudience,
            contentThemes: org.brandConfig.contentThemes,
          },
        });
      });

      results.push({ orgId: org.id, ...result });
    }

    return { processed: needsStrategy.length, results };
  }
);
