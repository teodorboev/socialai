import Anthropic from "@anthropic-ai/sdk";
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
  protected client: Anthropic;
  protected agentName: string;
  protected model: string;

  constructor(agentName: string, model = "claude-sonnet-4-20250514") {
    this.agentName = agentName;
    this.model = model;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
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

      // Record cost event if tokens were used
      if (result.tokensUsed && result.inputTokens && result.outputTokens) {
        const costCents = this.calculateActualCost(result.inputTokens, result.outputTokens);
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        
        try {
          await prisma.agentCostEvent.create({
            data: {
              organizationId,
              agentName: this.agentName,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              totalTokens: result.tokensUsed,
              costCents,
              model: this.model,
              contentId: (input as any)?._contentId,
              pipelineRunId: (input as any)?._pipelineRunId,
              period,
            },
          });
        } catch (costError) {
          console.error("Failed to record cost event:", costError);
        }
      }

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
   * Call Claude with support for prompt caching.
   * 
   * @param params.system - Can be either:
   *   - string: Plain system prompt (no caching)
   *   - CachableBlock[]: System blocks with cache_control for prompt caching
   *   - { static: string, dynamic?: string }: Convenience format that builds cached blocks
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async callClaude<T>(params: {
    system: string | CachableBlock[] | { static: string; dynamic?: string };
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
    cacheReadTokens: number;
    cacheWriteTokens: number;
  }> {
    // Convert system to the format expected by Anthropic
    let systemParam: string | CachableBlock[] = "";
    
    if (Array.isArray(params.system)) {
      // Already cached blocks
      systemParam = params.system;
    } else if (typeof params.system === "object" && "static" in params.system) {
      // Convenience format: { static, dynamic }
      systemParam = buildCachedSystemPrompt(params.system.static, params.system.dynamic);
    } else {
      // Plain string
      systemParam = params.system;
    }

    const messageParams: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: params.maxTokens ?? 4096,
      system: systemParam as string,
      messages: [{ role: "user", content: params.userMessage }],
    };

    // Add tool for structured output if schema provided
    if (params.schema) {
      const { zodToJsonSchema } = await import("zod-to-json-schema");
      
      messageParams.tools = [{
        name: "structured_output",
        description: "Output structured data",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: zodToJsonSchema(params.schema) as any,
      }];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messageParams.tool_choice = { type: "tool" as any, name: "structured_output" };
    }

    const response = await this.client.messages.create(messageParams);

    let text: string | undefined;
    let data: T | undefined;
    let parsedInput: unknown;

    if (params.schema) {
      // Handle structured output
      const toolUse = response.content.find((c) => c.type === "tool_use");
      if (toolUse && toolUse.type === "tool_use") {
        parsedInput = toolUse.input;
        data = params.schema.parse(parsedInput);
      }
    } else {
      // Handle text output
      const textContent = response.content.find((c) => c.type === "text");
      if (textContent && textContent.type === "text") {
        text = textContent.text;
      }
    }

    if (!text && !data) {
      throw new Error("No valid response from Claude");
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const tokensUsed = inputTokens + outputTokens;

    // Extract cache stats
    const cacheStats = extractCacheStats(response.usage);

    // Calculate actual cost in cents using Claude pricing
    const costCents = this.calculateActualCost(
      inputTokens, 
      outputTokens,
      cacheStats.cacheReadTokens,
      cacheStats.cacheWriteTokens
    );

    // Record the cost event with cache stats
    if (params.organizationId) {
      await this.recordCostEvent({
        organizationId: params.organizationId,
        inputTokens,
        outputTokens,
        totalTokens: tokensUsed,
        costCents,
        cacheReadTokens: cacheStats.cacheReadTokens,
        cacheWriteTokens: cacheStats.cacheWriteTokens,
        cacheSavingsUsd: cacheStats.estimatedSavingsUsd,
        contentId: params.contentId,
        pipelineRunId: params.pipelineRunId,
      });
    }

    return { 
      text, 
      data,
      tokensUsed, 
      inputTokens, 
      outputTokens,
      cacheSavings: cacheStats.estimatedSavingsUsd,
      cacheReadTokens: cacheStats.cacheReadTokens,
      cacheWriteTokens: cacheStats.cacheWriteTokens,
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
   * Legacy callClaude for backward compatibility (no caching)
   * @deprecated Use callClaude with system: { static, dynamic } for prompt caching
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

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const tokensUsed = inputTokens + outputTokens;

    // Calculate actual cost in cents using Claude pricing (Sonnet 4)
    const costCents = this.calculateActualCost(inputTokens, outputTokens);

    // Record the cost event
    if (organizationId) {
      await this.recordCostEvent({
        organizationId,
        inputTokens,
        outputTokens,
        totalTokens: tokensUsed,
        costCents,
        contentId,
        pipelineRunId,
      });
    }

    return { text: textContent.text, tokensUsed, inputTokens, outputTokens };
  }

  /**
   * Calculate actual cost using Claude API pricing (in cents)
   * Includes cache pricing (cache reads are much cheaper)
   */
  protected calculateActualCost(
    inputTokens: number, 
    outputTokens: number,
    cacheReadTokens: number = 0,
    cacheWriteTokens: number = 0
  ): number {
    // Sonnet 4 pricing
    const inputCostPerMillion = 3.00;   // $3.00 per 1M tokens
    const outputCostPerMillion = 15.00;  // $15.00 per 1M tokens
    const cacheReadCostPerMillion = 0.30;  // $0.30 per 1M tokens
    const cacheWriteCostPerMillion = 3.75; // $3.75 per 1M tokens
    
    const inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;
    const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * cacheReadCostPerMillion;
    const cacheWriteCost = (cacheWriteTokens / 1_000_000) * cacheWriteCostPerMillion;
    
    // Return in cents
    return (inputCost + outputCost + cacheReadCost + cacheWriteCost) * 100;
  }

  /**
   * Record cost event for billing analytics
   */
  protected async recordCostEvent(params: {
    organizationId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    cacheSavingsUsd?: number;
    contentId?: string;
    pipelineRunId?: string;
  }): Promise<void> {
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      
      await prisma.agentCostEvent.create({
        data: {
          organizationId: params.organizationId,
          agentName: this.agentName,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          totalTokens: params.totalTokens,
          costCents: params.costCents,
          cacheReadTokens: params.cacheReadTokens ?? 0,
          cacheWriteTokens: params.cacheWriteTokens ?? 0,
          model: this.model,
          contentId: params.contentId,
          pipelineRunId: params.pipelineRunId,
          period,
        },
      });
    } catch (error) {
      // Don't fail the agent if cost tracking fails
      console.error("Failed to record cost event:", error);
    }
  }
}
