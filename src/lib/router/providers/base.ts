/**
 * Provider Adapter Interface
 * 
 * All LLM providers implement this interface.
 * Supports: Anthropic, OpenAI, Google Gemini
 */

import type { LLMModel, LLMProvider } from "@prisma/client";

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMCallRequest {
  model: LLMModel;
  provider: LLMProvider;
  messages: LLMMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LLMTool[];
  stream?: boolean;
}

export interface LLMTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMCallResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
  finishReason: "stop" | "length" | "tool_use" | "content_filter" | "unknown";
  model: string;
  latencyMs: number;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly providerName: string;
  
  /** Check if this provider is available (has API key, etc.) */
  isAvailable(): boolean;
  
  /** Make a non-streaming LLM call */
  complete(request: LLMCallRequest): Promise<LLMCallResponse>;
  
  /** Make a streaming LLM call */
  stream(request: LLMCallRequest, onChunk: (chunk: string) => void): Promise<LLMCallResponse>;
  
  /** Test the provider connection */
  healthCheck(): Promise<boolean>;
}

/**
 * Calculate cost in cents for a call
 */
export function calculateCallCost(
  model: LLMModel,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): { inputCost: number; outputCost: number; cacheSavings: number; totalCost: number } {
  // Input cost
  let inputCost = Math.ceil((inputTokens / 1_000_000) * model.inputPricePer1M);
  
  // Cache savings (if prompt caching is supported and used)
  let cacheSavings = 0;
  if (model.supportsCaching && cachedTokens > 0 && model.cachedInputPricePer1M) {
    const regularCost = Math.ceil((cachedTokens / 1_000_000) * model.inputPricePer1M);
    const cachedCost = Math.ceil((cachedTokens / 1_000_000) * model.cachedInputPricePer1M);
    cacheSavings = regularCost - cachedCost;
    inputCost -= cacheSavings;
  }
  
  // Output cost
  const outputCost = Math.ceil((outputTokens / 1_000_000) * model.outputPricePer1M);
  
  return {
    inputCost,
    outputCost,
    cacheSavings,
    totalCost: inputCost + outputCost,
  };
}

/**
 * Get API key from environment variable
 */
export function getApiKey(envVar: string): string | undefined {
  return process.env[envVar];
}
