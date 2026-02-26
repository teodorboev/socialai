/**
 * OpenAI Provider Adapter
 * 
 * Uses the official OpenAI SDK for GPT models.
 * Supports: GPT-4o Mini, GPT-4o, o3, o4-mini
 */

import OpenAI from "openai";
import {
  type ProviderAdapter,
  type LLMCallRequest,
  type LLMCallResponse,
  type LLMToolCall,
  getApiKey,
} from "./base";

export class OpenAIAdapter implements ProviderAdapter {
  readonly providerName = "openai";
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = getApiKey("OPENAI_API_KEY");
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: LLMCallRequest): Promise<LLMCallResponse> {
    if (!this.client) {
      throw new Error("OpenAI client not available - no API key");
    }

    const startTime = Date.now();

    // Build messages array
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.unshift({
        role: "system",
        content: request.systemPrompt,
      });
    }

    // Convert tools to OpenAI format
    const tools = request.tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    try {
      const response = await this.client.chat.completions.create({
        model: request.model.modelId,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools,
        stream: false,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      // Extract content
      let content = "";
      const toolCalls: LLMToolCall[] = [];

      if (choice.message.content) {
        content = choice.message.content;
      }

      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          const func = (tc as any).function;
          toolCalls.push({
            id: tc.id,
            name: func?.name || "",
            input: func ? JSON.parse(func.arguments) : {},
          });
        }
      }

      // Determine finish reason
      let finishReason: LLMCallResponse["finishReason"] = "unknown";
      if (choice.finish_reason === "stop") finishReason = "stop";
      else if (choice.finish_reason === "length") finishReason = "length";
      else if (choice.finish_reason === "tool_calls") finishReason = "tool_use";
      else if (choice.finish_reason === "content_filter") finishReason = "content_filter";

      // Get cached tokens if available
      const cachedTokens = (response as any).usage?.prompt_cache_hit_tokens || 0;

      return {
        content,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          cachedTokens,
        },
        finishReason,
        model: response.model,
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async stream(
    request: LLMCallRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMCallResponse> {
    if (!this.client) {
      throw new Error("OpenAI client not available - no API key");
    }

    const startTime = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    if (request.systemPrompt) {
      messages.unshift({
        role: "system",
        content: request.systemPrompt,
      });
    }

    const tools = request.tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    try {
      const stream = await this.client.chat.completions.create({
        model: request.model.modelId,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools,
        stream: true,
      });

      let content = "";
      const toolCalls: LLMToolCall[] = [];
      let currentToolCall: Partial<LLMToolCall> | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          content += delta.content;
          onChunk(delta.content);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              if (currentToolCall) {
                toolCalls.push(currentToolCall as LLMToolCall);
              }
              currentToolCall = {
                id: tc.id,
                name: tc.function?.name || "",
                input: {},
              };
            }
            if (tc.function?.arguments && currentToolCall) {
              currentToolCall.input = {
                ...(currentToolCall.input as object),
                ...JSON.parse(tc.function.arguments),
              };
            }
          }
        }
      }

      if (currentToolCall) {
        toolCalls.push(currentToolCall as LLMToolCall);
      }

      const latencyMs = Date.now() - startTime;

      // Get usage from the last chunk
      const usage = (stream as any).apped?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
      };

      return {
        content,
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          cachedTokens: 0,
        },
        finishReason: "stop",
        model: request.model.modelId,
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw new Error(`OpenAI streaming error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
