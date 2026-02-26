import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTrainingContext } from "@/lib/training/prompt-injection";
import { 
  memory, 
  formatMemoriesForPrompt, 
  type MemoryType, 
  type MemoryResult 
} from "@/lib/memory";
import { 
  buildCachedSystemPrompt, 
  extractCacheStats,
  type CachableBlock 
} from "@/lib/caching/prompt-cache";
import { 
  getPromptTemplate, 
  interpolatePrompt,
  loadPrompt,
  clearPromptCache 
} from "@/lib/ai/prompts/loader";
import { smartRouter, type SmartRouterRequest, type SmartRouterResponse } from "@/lib/router";
import type { TaskType } from "@/lib/router/classifier";

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  confidenceScore: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  tokensUsed: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheSavings?: number; // USD saved from prompt caching
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Context object passed to agents for building system prompts.
 * Contains all the data needed to construct static/dynamic prompts.
 */
export interface OrgContext {
  organizationId: string;
  platform?: string;
  trainingContext?: string;
  memoryContext?: string;
  // Agents can extend this with additional fields as needed
  [key: string]: unknown;
}

export interface AgentInput {
  organizationId: string;
  platform?: string;
  _trainingContext?: string;
  _memoryContext?: string;
  _contentId?: string;
  _pipelineRunId?: string;
}

export abstract class BaseAgent {
  protected agentName: string;
  protected taskType: TaskType = "generation"; // Default task type for classification

  constructor(agentName: string, _model?: string) {
    // Note: _model parameter is deprecated - SmartRouter now handles model selection
    // Kept for backward compatibility with existing agents
    this.agentName = agentName;
  }

  /**
   * Set the task type for this agent.
   * Used by SmartRouter to classify requests into appropriate tiers.
   */
  protected setTaskType(taskType: TaskType): void {
    this.taskType = taskType;
  }

  abstract execute(input: unknown): Promise<AgentResult<unknown>>;

  /**
   * Get the static portion of the system prompt.
   * This is cached by Anthropic and should contain:
   * - Brand voice/rules
   * - Platform rules
   * - Agent role definition
   * - Anything that doesn't change between calls
   * 
   * Override to enable prompt caching. Default returns empty string (no caching).
   * Can be async to load from DB.
   */
  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    return "";
  }

  /**
   * Get the dynamic portion of the system prompt.
   * This changes every call and includes:
   * - Current date/time
   * - Recent context (trends, recent posts)
   * - Organization-specific data that changes frequently
   * 
   * Override to include dynamic context. Return undefined if no dynamic content needed.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  protected getDynamicSystemPromptContext?(orgContext: OrgContext): string | undefined;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * Get prompt template from DB for this agent.
   * Loads and interpolates variables.
   * 
   * @param templateName - The template name (default: "main")
   * @param variables - Variables to interpolate into the prompt
   * @returns The interpolated prompt, or throws if not found
   */
  protected async getPromptFromTemplate(
    templateName: string,
    variables: Record<string, string | number | boolean | undefined>
  ): Promise<string> {
    return loadPrompt(this.agentName, templateName, variables);
  }

  /**
   * Build the org context object for prompt building.
   * Override to add agent-specific context data.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  protected buildOrgContext(input: unknown): OrgContext {
    const agentInput = input as AgentInput;
    return {
      organizationId: agentInput.organizationId,
      platform: agentInput.platform,
      trainingContext: agentInput._trainingContext,
      memoryContext: agentInput._memoryContext,
    };
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * Get the memory query for this agent.
   * Each agent defines what to search for based on its input.
   * Override to enable memory recall for this agent.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  getMemoryQuery(input: unknown): string {
    return "";
  }

  /**
   * Get the relevant memory types for this agent.
   * Each agent defines which memory types matter for its domain.
   * Override to enable memory recall for this agent.
   */
  relevantMemoryTypes(): MemoryType[] {
    return [];
  }

  /**
   * Store memories after execution.
   * Each agent defines what to remember based on its output.
   * Override to enable memory storage for this agent.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async storeMemory(orgId: string, input: unknown, result: AgentResult<unknown>): Promise<void> {
    // Default: do nothing - agents must opt-in by overriding
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * Format memories for prompt injection.
   * Subclasses can override to customize formatting.
   */
  protected formatMemoryContext(memories: MemoryResult[]): string {
    return formatMemoriesForPrompt(memories);
  }

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

    // RECALL: Get relevant memories before execution
    let memoryContext = "";
    try {
      const query = this.getMemoryQuery(input);
      const memoryTypes = this.relevantMemoryTypes();
      
      if (query && memoryTypes.length > 0) {
        const memories = await memory.recall({
          organizationId,
          query,
          memoryTypes,
          limit: 10,
          minSimilarity: 0.7,
        });
        
        memoryContext = this.formatMemoryContext(memories);
      }
    } catch (error) {
      console.error("Error recalling memories:", error);
      // Continue without memory context on error
    }

    // Inject contexts into the input
    const enrichedInput = {
      ...(input as object),
      _trainingContext: trainingContext,
      _memoryContext: memoryContext,
    };

    try {
      const result = await this.execute(enrichedInput);
      const durationMs = Date.now() - startTime;

      // Note: Cost tracking is now handled automatically by SmartRouter
      // via LLMUsageLog - no need for manual cost event recording

      await this.log(organizationId, {
        action: `${this.agentName}.execute`,
        inputSummary: input,
        outputSummary: result.data,
        confidenceScore: result.confidenceScore,
        durationMs,
        tokensUsed: result.tokensUsed,
        status: result.shouldEscalate ? "ESCALATED" : "SUCCESS",
      });

      // STORE: Save execution result as memory
      try {
        await this.storeMemory(organizationId, input, result);
      } catch (error) {
        console.error("Error storing memories:", error);
        // Don't fail the execution if memory storage fails
      }

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

  /**
   * Call LLM through SmartRouter.
   * Automatically classifies request, routes to optimal model, handles fallbacks, and logs usage.
   * 
   * @param params.system - System prompt
   * @param params.userMessage - User message
   * @param params.maxTokens - Max output tokens
   * @param params.organizationId - For cost tracking
   * @param params.contentId - For pipeline tracking
   * @param params.pipelineRunId - For pipeline tracking
   * @param params.schema - Optional Zod schema for structured output
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async callLLM<T>(params: {
    system: string;
    userMessage: string;
    maxTokens?: number;
    organizationId?: string;
    contentId?: string;
    pipelineRunId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema?: any;
  }): Promise<{ 
    text?: string; 
    data?: T;
    tokensUsed: number; 
    inputTokens: number; 
    outputTokens: number;
    cacheSavings: number;
    modelInfo?: {
      id: string;
      displayName: string;
      provider: string;
      tier: string;
    };
  }> {
    const request: SmartRouterRequest = {
      agentName: this.agentName,
      taskType: this.taskType,
      messages: [{ role: "user", content: params.userMessage }],
      systemPrompt: params.system,
      maxTokens: params.maxTokens,
      organizationId: params.organizationId,
      pipelineId: params.pipelineRunId,
    };

    const response = await smartRouter.complete(request);

    // Extract text or structured data
    let text: string | undefined;
    let data: T | undefined;

    if (params.schema) {
      // Try to parse as structured output
      try {
        data = params.schema.parse(JSON.parse(response.content));
      } catch {
        // If parsing fails, treat as text
        text = response.content;
      }
    } else {
      text = response.content;
    }

    return { 
      text, 
      data,
      tokensUsed: response.usage.totalTokens, 
      inputTokens: response.usage.inputTokens, 
      outputTokens: response.usage.outputTokens,
      cacheSavings: response.cost.cacheSavings / 100, // Convert cents to dollars for backward compat
      modelInfo: response.model,
    };
  }

  /**
   * Legacy callClaude for backward compatibility
   * @deprecated Use callLLM which uses SmartRouter
   */
  protected async callClaudeLegacy({
    system,
    userMessage,
    maxTokens = 4096,
    organizationId,
    contentId,
    pipelineRunId,
  }: {
    system: string;
    userMessage: string;
    maxTokens?: number;
    organizationId?: string;
    contentId?: string;
    pipelineRunId?: string;
  }): Promise<{ text: string; tokensUsed: number; inputTokens: number; outputTokens: number }> {
    const result = await this.callLLM({
      system,
      userMessage,
      maxTokens,
      organizationId,
      contentId,
      pipelineRunId,
    });

    return { 
      text: result.text || "", 
      tokensUsed: result.tokensUsed, 
      inputTokens: result.inputTokens, 
      outputTokens: result.outputTokens 
    };
  }

  /**
   * Build cached system prompt from org context.
   * Convenience method for agents that implement getStaticSystemPrompt.
   * Can be async if getStaticSystemPrompt is async.
   */
  protected async buildCachedPrompt(orgContext: OrgContext): Promise<CachableBlock[]> {
    const staticPart = await this.getStaticSystemPrompt(orgContext);
    const dynamicPart = this.getDynamicSystemPromptContext?.(orgContext);
    return buildCachedSystemPrompt(staticPart, dynamicPart);
  }

  /**
   * Backward-compatible alias for callLLM
   * @deprecated Use callLLM which uses SmartRouter
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected callClaude<T>(params: {
    system: string;
    userMessage: string;
    maxTokens?: number;
    organizationId?: string;
    contentId?: string;
    pipelineRunId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema?: any;
  }): Promise<{ 
    text?: string; 
    data?: T;
    tokensUsed: number; 
    inputTokens: number; 
    outputTokens: number;
    cacheSavings: number;
    modelInfo?: {
      id: string;
      displayName: string;
      provider: string;
      tier: string;
    };
  }> {
    return this.callLLM(params);
  }
}
