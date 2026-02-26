/**
 * Google Gemini Provider Adapter
 * 
 * Uses Google AI Gemini API.
 * Supports: Gemini 2.0 Flash, Gemini 2.5 Pro
 */

import {
  type ProviderAdapter,
  type LLMCallRequest,
  type LLMCallResponse,
  type LLMToolCall,
  getApiKey,
} from "./base";

interface GoogleModel {
  name: string;
  generationConfig: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

export class GoogleAdapter implements ProviderAdapter {
  readonly providerName = "google";
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = getApiKey("GOOGLE_AI_API_KEY");
  }

  isAvailable(): boolean {
    return this.apiKey !== undefined;
  }

  async complete(request: LLMCallRequest): Promise<LLMCallResponse> {
    if (!this.apiKey) {
      throw new Error("Google client not available - no API key");
    }

    const startTime = Date.now();

    // Convert messages to Google format
    const contents = request.messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Build the request body
    const modelName = `models/${request.model.modelId}`;
    
    const body: GoogleModel = {
      name: modelName,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents,
            generationConfig: body.generationConfig,
            systemInstruction: request.systemPrompt
              ? { role: "system", parts: [{ text: request.systemPrompt }] }
              : undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      // Extract content
      let content = "";
      const toolCalls: LLMToolCall[] = [];

      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.text) {
            content += part.text;
          } else if (part.functionCall) {
            toolCalls.push({
              id: part.functionCall.name + "-" + Date.now(),
              name: part.functionCall.name,
              input: part.functionCall.args || {},
            });
          }
        }
      }

      // Extract usage
      const usageMetadata = data.usageMetadata || {};
      const promptTokenCount = usageMetadata.promptTokenCount || 0;
      const candidatesTokenCount = usageMetadata.candidatesTokenCount || 0;
      const totalTokenCount = usageMetadata.totalTokenCount || 0;

      return {
        content,
        usage: {
          inputTokens: promptTokenCount,
          outputTokens: candidatesTokenCount,
          cachedTokens: 0,
        },
        finishReason: data.candidates?.[0]?.finishReason === "STOP" ? "stop" : "unknown",
        model: request.model.modelId,
        latencyMs,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw new Error(`Google API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async stream(
    request: LLMCallRequest,
    onChunk: (chunk: string) => void
  ): Promise<LLMCallResponse> {
    if (!this.apiKey) {
      throw new Error("Google client not available - no API key");
    }

    const startTime = Date.now();

    const contents = request.messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const modelName = `models/${request.model.modelId}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
            },
            systemInstruction: request.systemPrompt
              ? { role: "system", parts: [{ text: request.systemPrompt }] }
              : undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google streaming API error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const decoder = new TextDecoder();
      let content = "";
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates?.[0]?.content?.parts) {
              for (const part of parsed.candidates[0].content.parts) {
                if (part.text) {
                  content += part.text;
                  onChunk(part.text);
                }
              }
            }
            if (parsed.usageMetadata) {
              inputTokens = parsed.usageMetadata.promptTokenCount || 0;
              outputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      const latencyMs = Date.now() - startTime;

      return {
        content,
        usage: {
          inputTokens,
          outputTokens,
          cachedTokens: 0,
        },
        finishReason: "stop",
        model: request.model.modelId,
        latencyMs,
      };
    } catch (error) {
      throw new Error(`Google streaming error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "hi" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
