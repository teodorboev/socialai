/**
 * SmartRouter - Main API
 * 
 * Intelligent LLM routing that:
 * 1. Classifies requests into tiers (budget/mid/flagship)
 * 2. Resolves best model from DB
 * 3. Executes with fallback on failure
 * 4. Logs every call for cost tracking
 * 
 * Zero hardcoded model IDs - all from DB.
 * Zero hardcoded prices - all from DB.
 */

import { prisma } from "@/lib/prisma";
import { providerRegistry } from "./providers/registry";
import { classifyRequest, type ClassificationInput, type TaskType } from "./classifier";
import { resolveModel, type ResolverOptions, updateModelMetrics } from "./resolver";
import { calculateCallCost, type LLMMessage, type LLMTool, type LLMToolCall } from "./providers/base";
import type { LLMUsageLog } from "@prisma/client";

// Tool registry - maps tool names to execution functions
type ToolExecutor = (input: Record<string, unknown>) => Promise<unknown>;

const toolRegistry: Record<string, ToolExecutor> = {};

/**
 * Register a tool function that can be called by the LLM
 */
export function registerTool(name: string, executor: ToolExecutor) {
  toolRegistry[name] = executor;
}

/**
 * Unregister a tool
 */
export function unregisterTool(name: string) {
  delete toolRegistry[name];
}

export interface SmartRouterRequest {
  /** Which agent is making the call (determines default tier) */
  agentName: string;
  /** Optional explicit task type */
  taskType?: TaskType;
  /** Messages to send to the LLM */
  messages: LLMMessage[];
  /** System prompt */
  systemPrompt?: string;
  /** Override temperature */
  temperature?: number;
  /** Override max tokens */
  maxTokens?: number;
  /** Organization ID for cost tracking (optional) */
  organizationId?: string;
  /** Pipeline ID for grouping calls */
  pipelineId?: string;
  /** Additional context for classification */
  context?: ClassificationInput["context"];
  /** Options for model resolution */
  resolverOptions?: ResolverOptions;
  /** Enable streaming */
  stream?: boolean;
  /** Stream callback */
  onStream?: (chunk: string) => void;
  /** Tools available for the LLM to call */
  tools?: LLMTool[];
  /** Maximum tool call iterations (to prevent infinite loops) */
  maxToolIterations?: number;
}

export interface SmartRouterResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number;    // in cents
    outputCost: number;   // in cents
    cacheSavings: number; // in cents
    totalCost: number;    // in cents
  };
  model: {
    id: string;
    displayName: string;
    provider: string;
    tier: string;
  };
  classification: {
    tier: string;
    taskType: string;
    reasoning?: string;
  };
  latencyMs: number;
  wasFallback: boolean;
  fallbacksAttempted: number;
}

/**
 * Execute an LLM call through SmartRouter.
 * Handles classification, resolution, execution, fallback, and logging.
 */
export async function complete(request: SmartRouterRequest): Promise<SmartRouterResponse> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  let wasFallback = false;
  let fallbacksAttempted = 0;
  let resolvedModel: Awaited<ReturnType<typeof resolveModel>> | null = null;
  let classification: Awaited<ReturnType<typeof classifyRequest>> | null = null;

  try {
    // Step 1: Classify the request
    classification = await classifyRequest({
      agentName: request.agentName,
      taskType: request.taskType,
      context: request.context,
    });

    // Step 2: Resolve the best model for the tier
    resolvedModel = await resolveModel(
      classification.tier,
      request.taskType || "unknown",
      request.resolverOptions
    );

    // Step 3: Execute with fallback
    const adapter = providerRegistry.getAdapter(resolvedModel.provider.name);
    if (!adapter) {
      throw new Error(`Provider adapter not found: ${resolvedModel.provider.name}`);
    }

    let response;
    try {
      if (request.stream && request.onStream) {
        response = await adapter.stream(
          {
            model: resolvedModel.model,
            provider: resolvedModel.provider,
            messages: request.messages,
            systemPrompt: request.systemPrompt,
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            tools: request.tools,
          },
          request.onStream
        );
      } else {
        response = await adapter.complete({
          model: resolvedModel.model,
          provider: resolvedModel.provider,
          messages: request.messages,
          systemPrompt: request.systemPrompt,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          tools: request.tools,
        });
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Try fallbacks
      for (const fallback of resolvedModel.fallbacks) {
        fallbacksAttempted++;
        wasFallback = true;

        const fallbackAdapter = providerRegistry.getAdapter(fallback.provider.name);
        if (!fallbackAdapter) continue;

        try {
          const fallbackResponse = await fallbackAdapter.complete({
            model: fallback.model,
            provider: fallback.provider,
            messages: request.messages,
            systemPrompt: request.systemPrompt,
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            tools: request.tools,
          });

          response = fallbackResponse;
          resolvedModel = { model: fallback.model, provider: fallback.provider, fallbacks: [] };
          lastError = null;
          break;
        } catch (fbError) {
          lastError = fbError instanceof Error ? fbError : new Error(String(fbError));
          // Continue to next fallback
        }
      }
    }

    if (!response) {
      throw lastError || new Error("No response from any model");
    }

    // Step 4: Handle tool execution loop if tools are provided
    let finalContent = response.content;
    let totalUsage = { ...response.usage };
    let toolExecutions = 0;
    const maxIterations = request.maxToolIterations || 5;

    // If tools are provided and the model wants to use them, execute the tool loop
    if (request.tools && request.tools.length > 0 && response.toolCalls && response.toolCalls.length > 0) {
      const adapter = providerRegistry.getAdapter(resolvedModel.provider.name);
      if (adapter) {
        // Build conversation history including tool results
        let conversationMessages = [...request.messages];
        
        // Add initial assistant message with tool calls
        conversationMessages.push({
          role: "assistant",
          content: response.content,
        });

        while (response.toolCalls && response.toolCalls.length > 0 && toolExecutions < maxIterations) {
          toolExecutions++;

          // Execute each tool call
          const toolResults = [];
          for (const toolCall of response.toolCalls) {
            const executor = toolRegistry[toolCall.name];
            if (executor) {
              try {
                const result = await executor(toolCall.input);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.name,
                  content: JSON.stringify(result),
                });
              } catch (error) {
                toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.name,
                  content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
              }
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                name: toolCall.name,
                content: `Error: Tool '${toolCall.name}' not found`,
              });
            }
          }

          // Add tool results to conversation
          for (const result of toolResults) {
            conversationMessages.push({
              role: "user",
              content: result.content,
            });
          }

          // Continue conversation with tool results
          try {
            response = await adapter.complete({
              model: resolvedModel.model,
              provider: resolvedModel.provider,
              messages: conversationMessages,
              systemPrompt: request.systemPrompt,
              temperature: request.temperature,
              maxTokens: request.maxTokens,
              tools: request.tools,
            });

            // Accumulate usage
            totalUsage.inputTokens += response.usage.inputTokens;
            totalUsage.outputTokens += response.usage.outputTokens;
            if (response.usage.cachedTokens) {
              totalUsage.cachedTokens = (totalUsage.cachedTokens || 0) + response.usage.cachedTokens;
            }

            // Add assistant response to conversation
            conversationMessages.push({
              role: "assistant",
              content: response.content,
            });

            finalContent = response.content;
          } catch (error) {
            // If tool execution fails, break and return what we have
            console.error("Tool execution loop error:", error);
            break;
          }
        }
      }
    }

    // Step 5: Calculate cost
    const cost = calculateCallCost(
      resolvedModel.model,
      totalUsage.inputTokens,
      totalUsage.outputTokens,
      totalUsage.cachedTokens
    );

    // Step 6: Update model metrics
    await updateModelMetrics(resolvedModel.model.id, response.latencyMs, true);

    // Step 7: Log the call
    await logLLMUsage({
      organizationId: request.organizationId,
      agentName: request.agentName,
      pipelineId: request.pipelineId,
      requestTier: classification.tier,
      taskType: request.taskType || "unknown",
      providerId: resolvedModel.provider.id,
      providerName: resolvedModel.provider.name,
      modelId: resolvedModel.model.modelId,
      modelDisplayName: resolvedModel.model.displayName,
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      cachedTokens: totalUsage.cachedTokens ?? 0,
      totalTokens: totalUsage.inputTokens + totalUsage.outputTokens,
      inputCost: cost.inputCost,
      outputCost: cost.outputCost,
      cacheSavings: cost.cacheSavings,
      totalCost: cost.totalCost,
      latencyMs: response.latencyMs,
      wasRetry: false,
      wasFallback,
      originalModelId: wasFallback ? request.taskType : undefined,
      success: true,
    });

    const totalLatencyMs = Date.now() - startTime;

    return {
      content: finalContent,
      usage: {
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
      cachedTokens: totalUsage.cachedTokens ?? 0,
        totalTokens: response.usage.inputTokens + response.usage.outputTokens,
      },
      cost,
      model: {
        id: resolvedModel.model.id,
        displayName: resolvedModel.model.displayName,
        provider: resolvedModel.provider.name,
        tier: resolvedModel.model.tier,
      },
      classification: {
        tier: classification.tier,
        taskType: request.taskType || classification.taskType,
        reasoning: classification.reasoning,
      },
      latencyMs: totalLatencyMs,
      wasFallback,
      fallbacksAttempted,
    };
  } catch (error) {
    // Log failed call
    if (resolvedModel && classification) {
      await logLLMUsage({
        organizationId: request.organizationId,
        agentName: request.agentName,
        pipelineId: request.pipelineId,
        requestTier: classification.tier,
        taskType: request.taskType || "unknown",
        providerId: resolvedModel.provider.id,
        providerName: resolvedModel.provider.name,
        modelId: resolvedModel.model.modelId,
        modelDisplayName: resolvedModel.model.displayName,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        inputCost: 0,
        outputCost: 0,
        cacheSavings: 0,
        totalCost: 0,
        latencyMs: Date.now() - startTime,
        wasRetry: false,
        wasFallback,
        originalModelId: undefined,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      // Update model metrics as failure
      await updateModelMetrics(resolvedModel.model.id, Date.now() - startTime, false);
    }

    throw error;
  }
}

/**
 * Log LLM usage to database
 */
async function logLLMUsage(data: {
  organizationId?: string;
  agentName: string;
  pipelineId?: string;
  requestTier: string;
  taskType: string;
  providerId: string;
  providerName: string;
  modelId: string;
  modelDisplayName: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  cacheSavings: number;
  totalCost: number;
  latencyMs: number;
  wasRetry: boolean;
  wasFallback: boolean;
  originalModelId?: string;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await prisma.lLMUsageLog.create({
      data: {
        organizationId: data.organizationId,
        agentName: data.agentName,
        pipelineId: data.pipelineId,
        requestTier: data.requestTier,
        taskType: data.taskType,
        providerId: data.providerId,
        providerName: data.providerName,
        modelId: data.modelId,
        modelDisplayName: data.modelDisplayName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cachedTokens: data.cachedTokens,
        totalTokens: data.totalTokens,
        inputCost: data.inputCost,
        outputCost: data.outputCost,
        cacheSavings: data.cacheSavings,
        totalCost: data.totalCost,
        latencyMs: data.latencyMs,
        wasRetry: data.wasRetry,
        wasFallback: data.wasFallback,
        originalModelId: data.originalModelId,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
  } catch (error) {
    console.error("Failed to log LLM usage:", error);
  }
}

/**
 * Get usage statistics
 */
export async function getUsageStats(options: {
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
  agentName?: string;
}) {
  const where: any = {};

  if (options.organizationId) {
    where.organizationId = options.organizationId;
  }

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  if (options.agentName) {
    where.agentName = options.agentName;
  }

  const [totalCost, byTier, byProvider, byAgent, recentLogs] = await Promise.all([
    prisma.lLMUsageLog.aggregate({
      where,
      _sum: { totalCost: true, inputCost: true, outputCost: true, cacheSavings: true },
      _count: true,
    }),
    prisma.lLMUsageLog.groupBy({
      by: ["requestTier"],
      where,
      _sum: { totalCost: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.lLMUsageLog.groupBy({
      by: ["providerName"],
      where,
      _sum: { totalCost: true },
      _count: true,
    }),
    prisma.lLMUsageLog.groupBy({
      by: ["agentName"],
      where,
      _sum: { totalCost: true },
      _count: true,
    }),
    prisma.lLMUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return {
    total: {
      cost: totalCost._sum.totalCost || 0,
      inputCost: totalCost._sum.inputCost || 0,
      outputCost: totalCost._sum.outputCost || 0,
      cacheSavings: totalCost._sum.cacheSavings || 0,
      calls: totalCost._count,
    },
    byTier,
    byProvider,
    byAgent,
    recentLogs,
  };
}

// Export the main API
export const smartRouter = {
  complete,
  getUsageStats,
  registerTool,
  unregisterTool,
};
