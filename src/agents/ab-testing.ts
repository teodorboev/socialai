import { z } from "zod";
import { BaseAgent, type AgentResult } from "./shared/base-agent";
import {
  ExperimentDesignSchema,
  ExperimentResultSchema,
  type ExperimentDesign,
  type ExperimentResult,
  type ExperimentDesignInput,
  type ExperimentEvaluationInput,
} from "@/lib/ai/schemas/ab-testing";
import { prisma } from "@/lib/prisma";

const EXPERIMENT_TYPES = [
  { variable: "content_type", control: "single_image", variant: "carousel", metric: "saves" },
  { variable: "caption_length", control: "short", variant: "long", metric: "engagement_rate" },
  { variable: "hashtag_count", control: "low", variant: "high", metric: "reach" },
  { variable: "cta_style", control: "question", variant: "command", metric: "comments" },
  { variable: "posting_time", control: "morning", variant: "evening", metric: "impressions" },
  { variable: "visual_style", control: "photo", variant: "graphic", metric: "engagement_rate" },
  { variable: "hook_style", control: "question", variant: "statement", metric: "profile_visits" },
] as const;

export class ABTestingAgent extends BaseAgent {
  constructor() {
    super("AB_TESTING");
  }

  async execute(input: unknown): Promise<AgentResult<ExperimentDesign | ExperimentResult>> {
    const typedInput = input as { mode: "design" | "evaluate" } & (ExperimentDesignInput | ExperimentEvaluationInput);

    if (typedInput.mode === "design") {
      return this.designExperiment(input as ExperimentDesignInput);
    } else {
      return this.evaluateExperiment(input as ExperimentEvaluationInput);
    }
  }

  async designExperiment(input: ExperimentDesignInput): Promise<AgentResult<ExperimentDesign>> {
    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const systemPrompt = `You are an A/B testing expert for social media content optimization.

You need to design a rigorous experiment based on the optimization area provided.

EXPERIMENT TYPES (choose the most relevant):
${EXPERIMENT_TYPES.map(t => `- ${t.variable}: ${t.control} vs ${t.variant} (metric: ${t.metric})`).join("\n")}

EXISTING PLAYBOOK FINDINGS:
${input.existingPlaybook?.map(p => `- ${p.variable}: ${p.finding} → ${p.recommendation}`).join("\n") || "No existing playbook data"}

RECENT PERFORMANCE CONTEXT:
${input.recentPerformance ? JSON.stringify(input.recentPerformance, null, 2) : "No recent performance data"}

RULES:
1. Design experiments that test ONE variable at a time
2. Require minimum 5 posts per variant (recommend 10 for statistical significance)
3. Duration should be 7-30 days to capture different posting patterns
4. Focus on metrics that matter for the variable being tested
5. Create clear, testable hypotheses
6. Assign unique experiment group IDs for content tagging

Respond with a JSON object matching the required schema.`;

    const userMessage = `Design an A/B test experiment.

Optimization Area: ${input.optimizationArea}
Platform: ${input.platform}
Organization: ${input.organizationId}

Create a hypothesis-driven experiment that will provide actionable insights.`;

    try {
      const { text, tokensUsed } = await this.callClaude({
        system: systemPrompt,
        userMessage,
        maxTokens: 2000,
      });

      const parsed = this.parseDesignResponse(text, experimentId);
      const shouldEscalate = parsed.confidenceScore < 0.7;

      return {
        success: true,
        data: parsed,
        confidenceScore: parsed.confidenceScore,
        shouldEscalate,
        escalationReason: shouldEscalate ? `Low confidence in experiment design: ${parsed.hypothesis}` : undefined,
        tokensUsed,
      };
    } catch (error) {
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: `Failed to design experiment: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokensUsed: 0,
      };
    }
  }

  async evaluateExperiment(input: ExperimentEvaluationInput): Promise<AgentResult<ExperimentResult>> {
    const { controlGroupId, variantGroupId, successMetric } = input;

    const controlContent = await prisma.content.findMany({
      where: {
        organizationId: input.organizationId,
        abTestGroup: controlGroupId,
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
      include: {
        socialAccount: true,
      },
    });

    const variantContent = await prisma.content.findMany({
      where: {
        organizationId: input.organizationId,
        abTestGroup: variantGroupId,
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
      include: {
        socialAccount: true,
      },
    });

    if (controlContent.length < 3 || variantContent.length < 3) {
      return {
        success: true,
        data: {
          experimentId: input.experimentId,
          status: "insufficient_data" as const,
          controlMetric: 0,
          variantMetric: 0,
          improvement: 0,
          statisticalSignificance: 1,
          isSignificant: false,
          recommendation: "Insufficient data collected. Need at least 3 posts per variant.",
          playBookUpdate: "Run the experiment longer before drawing conclusions.",
          confidenceScore: 0.3,
        },
        confidenceScore: 0.3,
        shouldEscalate: false,
        tokensUsed: 0,
      };
    }

    const controlMetrics = await this.getMetricsForContent(controlContent, successMetric);
    const variantMetrics = await this.getMetricsForContent(variantContent, successMetric);

    if (controlMetrics.length === 0 || variantMetrics.length === 0) {
      return {
        success: true,
        data: {
          experimentId: input.experimentId,
          status: "insufficient_data" as const,
          controlMetric: 0,
          variantMetric: 0,
          improvement: 0,
          statisticalSignificance: 1,
          isSignificant: false,
          recommendation: "No analytics data available for comparison.",
          playBookUpdate: "Unable to evaluate - no metrics data found.",
          confidenceScore: 0.2,
        },
        confidenceScore: 0.2,
        shouldEscalate: false,
        tokensUsed: 0,
      };
    }

    const controlAvg = controlMetrics.reduce((a, b) => a + b, 0) / controlMetrics.length;
    const variantAvg = variantMetrics.reduce((a, b) => a + b, 0) / variantMetrics.length;

    const improvement = controlAvg > 0 ? ((variantAvg - controlAvg) / controlAvg) * 100 : 0;

    const { pValue, isSignificant } = this.calculateStatisticalSignificance(
      controlMetrics,
      variantMetrics,
      successMetric
    );

    const status = isSignificant
      ? improvement > 0
        ? "winner_variant" as const
        : "winner_control" as const
      : "inconclusive" as const;

    const systemPrompt = `You are an A/B testing expert. Based on the experiment results, provide a recommendation for the content playbook.

EXPERIMENT RESULTS:
- Control group: ${controlContent.length} posts, average ${successMetric}: ${controlAvg.toFixed(2)}
- Variant group: ${variantContent.length} posts, average ${successMetric}: ${variantAvg.toFixed(2)}
- Improvement: ${improvement.toFixed(1)}%
- Statistical significance: p-value = ${pValue.toFixed(4)} (significant: ${isSignificant})
- Winner: ${status}

RULES:
1. If statistically significant (p < 0.05), provide a specific playbook update
2. If not significant, recommend continuing testing or trying a different variable
3. Never recommend major strategy changes based on a single experiment
4. Provide actionable, specific instructions for the Content Creator

Respond with a JSON object matching the required schema.`;

    try {
      const { text, tokensUsed } = await this.callClaude({
        system: systemPrompt,
        userMessage: `Generate a recommendation for experiment ${input.experimentId}.`,
        maxTokens: 1000,
      });

      const parsed = this.parseResultResponse(text, input.experimentId, controlAvg, variantAvg, improvement, pValue, isSignificant);

      return {
        success: true,
        data: parsed,
        confidenceScore: parsed.confidenceScore,
        shouldEscalate: parsed.confidenceScore < 0.6,
        tokensUsed,
      };
    } catch (error) {
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: `Failed to evaluate experiment: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokensUsed: 0,
      };
    }
  }

  private async getMetricsForContent(
    content: Array<{ id: string; socialAccountId: string | null }>,
    metric: string
  ): Promise<number[]> {
    const socialAccountIds = content
      .map(c => c.socialAccountId)
      .filter((id): id is string => id !== null);

    if (socialAccountIds.length === 0) {
      return [];
    }

    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        socialAccountId: { in: socialAccountIds },
      },
      orderBy: { snapshotDate: "desc" },
      take: socialAccountIds.length * 2,
    });

    const metricsByAccount: Record<string, number[]> = {};
    for (const snapshot of snapshots) {
      if (!metricsByAccount[snapshot.socialAccountId]) {
        metricsByAccount[snapshot.socialAccountId] = [];
      }
      
      let value = 0;
      switch (metric) {
        case "engagement_rate":
          value = snapshot.engagementRate ?? 0;
          break;
        case "impressions":
          value = snapshot.impressions ?? 0;
          break;
        case "reach":
          value = snapshot.reach ?? 0;
          break;
        case "clicks":
          value = snapshot.clicks ?? 0;
          break;
        case "shares":
          value = (snapshot.rawData as any)?.shares ?? 0;
          break;
        case "saves":
          value = (snapshot.rawData as any)?.saves ?? 0;
          break;
        default:
          value = snapshot.engagementRate ?? 0;
      }
      
      if (value > 0) {
        metricsByAccount[snapshot.socialAccountId].push(value);
      }
    }

    return Object.values(metricsByAccount).flat().slice(0, content.length);
  }

  private calculateStatisticalSignificance(
    control: number[],
    variant: number[],
    metric: string
  ): { pValue: number; isSignificant: boolean } {
    if (control.length < 3 || variant.length < 3) {
      return { pValue: 1, isSignificant: false };
    }

    if (metric === "engagement_rate" || metric === "reach" || metric === "impressions") {
      return this.mannWhitneyUTest(control, variant);
    }

    return this.chiSquaredTest(control, variant);
  }

  private mannWhitneyUTest(control: number[], variant: number[]): { pValue: number; isSignificant: boolean } {
    const n1 = control.length;
    const n2 = variant.length;

    const allValues = [...control, ...variant]
      .map((v, i) => ({ value: v, originalIndex: i }))
      .sort((a, b) => a.value - b.value);

    let rankSum = 0;
    for (let i = 0; i < n1; i++) {
      const idx = allValues.findIndex(a => a.originalIndex === i);
      rankSum += idx + 1;
    }

    const u1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - rankSum;
    const u2 = n1 * n2 - u1;
    const u = Math.min(u1, u2);

    const mu = (n1 * n2) / 2;
    const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const z = sigma > 0 ? (u - mu) / sigma : 0;

    const pValue = 2 * this.normalCDF(Math.abs(z));
    return { pValue, isSignificant: pValue < 0.05 };
  }

  private chiSquaredTest(control: number[], variant: number[]): { pValue: number; isSignificant: boolean } {
    const median = [...control, ...variant].sort((a, b) => a - b)[Math.floor((control.length + variant.length) / 2)];
    
    const controlAbove = control.filter(v => v > median).length;
    const controlBelow = control.length - controlAbove;
    const variantAbove = variant.filter(v => v > median).length;
    const variantBelow = variant.length - variantAbove;

    const total = control.length + variant.length;
    const expectedControlAbove = (control.length * (controlAbove + variantAbove)) / total;
    const expectedControlBelow = (control.length * (controlBelow + variantBelow)) / total;
    const expectedVariantAbove = (variant.length * (controlAbove + variantAbove)) / total;
    const expectedVariantBelow = (variant.length * (controlBelow + variantBelow)) / total;

    const chiSq = 
      Math.pow(controlAbove - expectedControlAbove, 2) / expectedControlAbove +
      Math.pow(controlBelow - expectedControlBelow, 2) / expectedControlBelow +
      Math.pow(variantAbove - expectedVariantAbove, 2) / expectedVariantAbove +
      Math.pow(variantBelow - expectedVariantBelow, 2) / expectedVariantBelow;

    const pValue = 1 - this.chiSqCDF(chiSq, 1);
    return { pValue, isSignificant: pValue < 0.05 };
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private chiSqCDF(x: number, df: number): number {
    if (x <= 0) return 0;
    
    let result = 0;
    const k = df / 2;
    const lambda = x / 2;
    
    for (let i = 0; i < 100; i++) {
      const term = Math.pow(lambda, i) / this.factorial(i);
      result += term;
      if (term < 1e-10) break;
    }
    
    return 1 - Math.pow(lambda, k - 1) * Math.exp(-lambda) * result / this.gamma(k);
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  private gamma(x: number): number {
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7,
    ];

    if (x < 0.5) {
      return Math.PI / (Math.sin(Math.PI * x) * this.gamma(1 - x));
    }

    x -= 1;
    let a = c[0];
    for (let i = 1; i < g + 2; i++) {
      a += c[i] / (x + i);
    }

    const t = x + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
  }

  private parseDesignResponse(text: string, experimentId: string): ExperimentDesign {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = ExperimentDesignSchema.parse({
      ...parsed,
      experimentId,
    });

    return validated;
  }

  private parseResultResponse(
    text: string,
    experimentId: string,
    controlMetric: number,
    variantMetric: number,
    improvement: number,
    pValue: number,
    isSignificant: boolean
  ): ExperimentResult {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = ExperimentResultSchema.parse({
      ...parsed,
      experimentId,
      controlMetric,
      variantMetric,
      improvement,
      statisticalSignificance: pValue,
      isSignificant,
    });

    return validated;
  }

  async updatePlaybook(
    organizationId: string,
    experimentId: string,
    playBookUpdate: string
  ): Promise<void> {
    console.log(`[AB-Testing] Playbook update for org ${organizationId}, exp ${experimentId}: ${playBookUpdate}`);
  }
}
