/**
 * Provider Registry
 * 
 * Maps provider names to adapter instances.
 * Singleton pattern for efficient reuse.
 */

import type { ProviderAdapter } from "./base";
import { AnthropicAdapter } from "./anthropic";
import { OpenAIAdapter } from "./openai";
import { GoogleAdapter } from "./google";

class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();
  private static instance: ProviderRegistry;

  private constructor() {
    // Initialize all adapters
    this.register("anthropic", new AnthropicAdapter());
    this.register("openai", new OpenAIAdapter());
    this.register("google", new GoogleAdapter());
  }

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  private register(name: string, adapter: ProviderAdapter): void {
    this.adapters.set(name, adapter);
  }

  /** Get adapter by provider name */
  getAdapter(providerName: string): ProviderAdapter | undefined {
    return this.adapters.get(providerName);
  }

  /** Get all available (has API key) adapters */
  getAvailableAdapters(): ProviderAdapter[] {
    return Array.from(this.adapters.values()).filter((adapter) => adapter.isAvailable());
  }

  /** Check if a provider is available */
  isProviderAvailable(providerName: string): boolean {
    const adapter = this.adapters.get(providerName);
    return adapter?.isAvailable() ?? false;
  }

  /** Run health check on all providers */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [name, adapter] of this.adapters.entries()) {
      if (adapter.isAvailable()) {
        results.set(name, await adapter.healthCheck());
      } else {
        results.set(name, false);
      }
    }
    
    return results;
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
