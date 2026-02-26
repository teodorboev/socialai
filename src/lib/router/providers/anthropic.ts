/**
 * Anthropic Provider Adapter
 * 
 * Uses the official Anthropic SDK for Claude models.
 * Supports: Claude Haiku, Sonnet, Opus
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  type ProviderAdapter,
  type LLMCallRequest,
  type LLMCallResponse,
  type LLMToolCall,
  getApiKey,
} from "./base";

export class AnthropicAdapter implements ProviderAdapter {
  readonly providerName = "anthropic";
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = getApiKey("ANTHROPIC_API_KEY");
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: LLMCallRequest): Promise<LLMCallResponse> {
    if (!this.client) {
      throw new Error("Anthropic client not available - no API key");
    }

    const startTime = Date.now();

    // Convert messages to Anthropic format
    const anthropicMessages = request.messages.map((msg) => ({
      role: msg.role === "system" ? "user" : msg.role, // Anthropic doesn't have system role in messages
      content: msg.content,
    }));

    // Add system prompt if provided
    const system = request.systemPrompt;

    try {
      const response = await this.client.messages.create({
        model: request.model.modelId,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system,
        messages: anthropicMessages,
        tools: request.tools as unknown as Anthropic.Tool[],
      });

      const latencyMs = Date.now() - startTime;

      // Extract content
      let content = "";
      const toolCalls: LLMToolCall[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          content += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      // Determine finish reason
      let finishReason: LLMCallResponse["finishReason"] = "unknown";
      if (response.stop_reason === "end_turn") finishReason = "stop";
      else if (response.stop_reason === "max_tokens") finishReason = "length";
      else if (response.stop_reason === "tool_use") finishReason = "tool_use";

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cachedTokens: (response.usage as any).cache_read_tokens || 0,
        },
        finishReason,
        model: request.model.modelId,
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async stream(
    request: LLMCallRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMCallResponse> {
    if (!this.client) {
      throw new Error("Anthropic client not available - no API key");
    }

    const startTime = Date.now();

    const anthropicMessages = request.messages.map((msg) => ({
      role: msg.role === "system" ? "user" : msg.role,
      content: msg.content,
    }));

    const system = request.systemPrompt;

    try {
      const stream = await this.client.messages.stream({
        model: request.model.modelId,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system,
        messages: anthropicMessages,
        tools: request.tools as unknown as Anthropic.Tool[],
      });

      let content = "";
      const toolCalls: LLMToolCall[] = [];
      let currentToolCall: Partial<LLMToolCall> | null = null;

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta") {
          if (chunk.delta.type === "text_delta") {
            const text = chunk.delta.text;
            content += text;
            onChunk(text);
          } else if (chunk.delta.type === "input_json_delta") {
            if (currentToolCall) {
              currentToolCall.input = {
                ...(currentToolCall.input as object),
                ...JSON.parse(chunk.delta.partial_json),
              };
            }
          }
        } else if (chunk.type === "content_block_start") {
          if (chunk.content_block.type === "tool_use") {
            currentToolCall = {
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              input: {},
            };
          }
        } else if (chunk.type === "content_block_stop") {
          if (currentToolCall && currentToolCall.id) {
            toolCalls.push(currentToolCall as LLMToolCall);
            currentToolCall = null;
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      const latencyMs = Date.now() - startTime;

      return {
        content,
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          cachedTokens: (finalMessage.usage as any).cache_read_tokens || 0,
        },
        finishReason: "stop",
        model: request.model.modelId,
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw new Error(`Anthropic streaming error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      // Make a minimal API call to check connectivity
      await this.client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
