import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getTrainingContext } from "@/lib/training/prompt-injection";

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  confidenceScore: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  tokensUsed: number;
}

export interface AgentInput {
  organizationId: string;
  platform?: string;
  _trainingContext?: string;
}

export abstract class BaseAgent {
  protected client: Anthropic;
  protected agentName: string;
  protected model: string;

  constructor(agentName: string, model = "claude-sonnet-4-20250514") {
    this.agentName = agentName;
    this.model = model;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  abstract execute(input: unknown): Promise<AgentResult<unknown>>;

  async run(organizationId: string, input: unknown): Promise<AgentResult<unknown>> {
    const startTime = Date.now();

    // Get training context for this organization and agent
    const agentInput = input as AgentInput;
    const platform = agentInput.platform;
    
    let trainingContext = "";
    try {
      trainingContext = await getTrainingContext(
        organizationId,
        this.agentName,
        platform
      );
    } catch (error) {
      console.error("Error getting training context:", error);
    }

    // Inject training context into the input
    const enrichedInput = {
      ...(input as object),
      _trainingContext: trainingContext,
    };

    try {
      const result = await this.execute(enrichedInput);
      const durationMs = Date.now() - startTime;

      await this.log(organizationId, {
        action: `${this.agentName}.execute`,
        inputSummary: input,
        outputSummary: result.data,
        confidenceScore: result.confidenceScore,
        durationMs,
        tokensUsed: result.tokensUsed,
        status: result.shouldEscalate ? "ESCALATED" : "SUCCESS",
      });

      if (result.shouldEscalate) {
        await this.escalate(
          organizationId,
          result.escalationReason ?? "Low confidence",
          input,
          "MEDIUM"
        );
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;

      await this.log(organizationId, {
        action: `${this.agentName}.execute`,
        inputSummary: input,
        durationMs,
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }
  }

  protected async log(organizationId: string, data: {
    action: string;
    inputSummary?: unknown;
    outputSummary?: unknown;
    confidenceScore?: number;
    durationMs: number;
    tokensUsed?: number;
    status: string;
    errorMessage?: string;
  }) {
    try {
      await prisma.agentLog.create({
        data: {
          organizationId,
          agentName: this.agentName as any,
          action: data.action,
          inputSummary: data.inputSummary as object,
          outputSummary: data.outputSummary as object,
          confidenceScore: data.confidenceScore,
          durationMs: data.durationMs,
          tokensUsed: data.tokensUsed,
          costEstimate: data.tokensUsed ? this.estimateCost(data.tokensUsed) : undefined,
          status: data.status as any,
          errorMessage: data.errorMessage,
        },
      });
    } catch (logError) {
      console.error("Failed to write agent log:", logError);
    }
  }

  protected async escalate(
    organizationId: string,
    reason: string,
    context: unknown,
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM"
  ) {
    try {
      const escalation = await prisma.escalation.create({
        data: {
          organizationId,
          agentName: this.agentName as any,
          reason,
          context: context as object,
          priority: priority as any,
          status: "OPEN",
        },
      });

      console.log(`Escalation created: ${escalation.id} - ${reason}`);
      return escalation;
    } catch (escError) {
      console.error("Failed to create escalation:", escError);
    }
  }

  private truncateForLog(data: unknown): object | undefined {
    if (data === undefined || data === null) return undefined;
    const str = JSON.stringify(data);
    if (str.length > 5000) {
      return { _truncated: true, length: str.length, preview: str.slice(0, 2000) };
    }
    try {
      return JSON.parse(str);
    } catch {
      return { _string: str };
    }
  }

  protected estimateCost(tokens: number): number {
    return (tokens / 1_000_000) * 7.5;
  }

  protected async callClaude({
    system,
    userMessage,
    maxTokens = 4096,
  }: {
    system: string;
    userMessage: string;
    maxTokens?: number;
  }): Promise<{ text: string; tokensUsed: number }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    
    if (!textContent || textContent.type !== "text" || !textContent.text) {
      throw new Error("No text response from Claude");
    }

    const tokensUsed =
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    return { text: textContent.text, tokensUsed };
  }
}
