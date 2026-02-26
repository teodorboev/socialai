import { vi, type Mock } from 'vitest';

// ============================================================================
// Types - Mirror the smart-router types
// ============================================================================

export interface LLMProvider {
  id: string;
  name: string;
  models: LLMModel[];
  isActive: boolean;
}

export interface LLMModel {
  id: string;
  name: string;
  providerId: string;
  contextWindow: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  capabilities: string[];
  isActive: boolean;
}

export interface AgentRoutingConfig {
  agentName: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
}

export interface RouteRequest {
  agentName: string;
  taskComplexity: 'simple' | 'moderate' | 'complex';
  tokensEstimated?: number;
  orgId?: string;
  forceModelId?: string;
}

export interface RouteResult {
  providerId: string;
  modelId: string;
  modelName: string;
  estimatedCost: number;
  reasoning: string;
}

// ============================================================================
// Mock Data - Per-agent predefined responses
// ============================================================================

export const MOCK_PROVIDERS: LLMProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', providerId: 'anthropic', contextWindow: 200000, inputCostPer1M: 3, outputCostPer1M: 15, capabilities: ['text', 'vision', 'structured'], isActive: true },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', providerId: 'anthropic', contextWindow: 200000, inputCostPer1M: 15, outputCostPer1M: 75, capabilities: ['text', 'vision', 'structured'], isActive: true },
      { id: 'claude-haiku-3-20250514', name: 'Claude Haiku 3', providerId: 'anthropic', contextWindow: 200000, inputCostPer1M: 0.8, outputCostPer1M: 4, capabilities: ['text', 'vision'], isActive: true },
    ],
    isActive: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', contextWindow: 128000, inputCostPer1M: 2.5, outputCostPer1M: 10, capabilities: ['text', 'vision', 'structured'], isActive: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', contextWindow: 128000, inputCostPer1M: 0.15, outputCostPer1M: 0.6, capabilities: ['text', 'vision'], isActive: true },
    ],
    isActive: true,
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2-flash', name: 'Gemini 2 Flash', providerId: 'google', contextWindow: 1000000, inputCostPer1M: 0, outputCostPer1M: 0, capabilities: ['text', 'vision', 'structured'], isActive: true },
    ],
    isActive: true,
  },
];

// Per-agent routing decisions
export const AGENT_ROUTING_MAP: Record<string, { modelId: string; complexity: 'simple' | 'moderate' | 'complex'; cost: number }> = {
  // Content agents - moderate complexity
  'CONTENT_CREATOR': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.0075 },
  'CAPTION_REWRITER': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.005 },
  'VISUAL': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.008 },
  'CREATIVE_DIRECTOR': { modelId: 'claude-opus-4-20250514', complexity: 'complex', cost: 0.025 },
  
  // Engagement agents - simple to moderate
  'ENGAGEMENT': { modelId: 'claude-haiku-3-20250514', complexity: 'simple', cost: 0.001 },
  'REVIEW_RESPONSE': { modelId: 'claude-haiku-3-20250514', complexity: 'simple', cost: 0.001 },
  'UGC_CURATOR': { modelId: 'claude-haiku-3-20250514', complexity: 'simple', cost: 0.001 },
  
  // Strategy & Analytics - complex
  'STRATEGY': { modelId: 'claude-opus-4-20250514', complexity: 'complex', cost: 0.03 },
  'ANALYTICS': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'REPORTING_NARRATOR': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.015 },
  'PREDICTIVE_CONTENT': { modelId: 'claude-sonnet-4-20250514', complexity: 'complex', cost: 0.02 },
  'CONTENT_DNA': { modelId: 'claude-opus-4-20250514', complexity: 'complex', cost: 0.025 },
  'GOAL_TRACKING': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'ROI_ATTRIBUTION': { modelId: 'claude-sonnet-4-20250514', complexity: 'complex', cost: 0.02 },
  'CROSS_CHANNEL_ATTRIBUTION': { modelId: 'claude-sonnet-4-20250514', complexity: 'complex', cost: 0.02 },
  'COMPETITOR_INTELLIGENCE': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  'COMPETITIVE_AD_INTELLIGENCE': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  'PRICING_INTELLIGENCE': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'INFLUENCER_SCOUT': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'SENTIMENT_INTELLIGENCE': { modelId: 'claude-sonnet-4-20250514', complexity: 'complex', cost: 0.018 },
  'SOCIAL_LISTENING': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  'CHURN_PREDICTION': { modelId: 'claude-sonnet-4-20250514', complexity: 'complex', cost: 0.015 },
  'MEDIA_PITCH': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  'LOCALIZATION': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'INTER_CLIENT_LEARNING': { modelId: 'claude-opus-4-20250514', complexity: 'complex', cost: 0.025 },
  
  // Trend & Testing - moderate
  'TREND_SCOUT': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'AB_TESTING': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'CALENDAR_OPTIMIZER': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.008 },
  'HASHTAG_OPTIMIZER': { modelId: 'claude-haiku-3-20250514', complexity: 'simple', cost: 0.002 },
  'SOCIAL_SEO': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.008 },
  'BRAND_VOICE_GUARDIAN': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.008 },
  'COMMUNITY_BUILDER': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'AD_COPY': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.008 },
  'REPURPOSE': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  
  // Crisis & Compliance - complex (need high accuracy)
  'CRISIS_RESPONSE': { modelId: 'claude-opus-4-20250514', complexity: 'complex', cost: 0.03 },
  'COMPLIANCE': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  
  // Orchestration & Coordination
  'ORCHESTRATOR': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.015 },
  'CONTENT_REPLENISHMENT': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  'SELF_EVALUATION': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.012 },
  'ONBOARDING_INTELLIGENCE': { modelId: 'claude-sonnet-4-20250514', complexity: 'complex', cost: 0.02 },
  'AI_TRAINING_MODE': { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate', cost: 0.01 },
  
  // Publisher - simple
  'PUBLISHER': { modelId: 'claude-haiku-3-20250514', complexity: 'simple', cost: 0.001 },
};

// Fallback for unknown agents
const DEFAULT_ROUTING = { modelId: 'claude-sonnet-4-20250514', complexity: 'moderate' as const, cost: 0.01 };

// ============================================================================
// SmartRouter Mock Class
// ============================================================================

export class MockSmartRouter {
  routingHistory: RouteRequest[] = [];
  routingResults: RouteResult[] = [];

  async route(request: RouteRequest): Promise<RouteResult> {
    this.routingHistory.push(request);
    
    const routing = AGENT_ROUTING_MAP[request.agentName] || DEFAULT_ROUTING;
    const model = MOCK_PROVIDERS
      .flatMap(p => p.models)
      .find(m => m.id === (request.forceModelId || routing.modelId));
    
    if (!model) {
      throw new Error(`Model not found: ${request.forceModelId || routing.modelId}`);
    }

    const result: RouteResult = {
      providerId: model.providerId,
      modelId: model.id,
      modelName: model.name,
      estimatedCost: routing.cost,
      reasoning: `Routed ${request.agentName} to ${model.name} for ${routing.complexity} task`,
    };
    
    this.routingResults.push(result);
    return result;
  }

  async getProviders(): Promise<LLMProvider[]> {
    return MOCK_PROVIDERS;
  }

  async getModels(providerId?: string): Promise<LLMModel[]> {
    if (providerId) {
      return MOCK_PROVIDERS.find(p => p.id === providerId)?.models || [];
    }
    return MOCK_PROVIDERS.flatMap(p => p.models);
  }

  async getAgentConfig(agentName: string): Promise<AgentRoutingConfig | null> {
    const routing = AGENT_ROUTING_MAP[agentName];
    if (!routing) return null;
    
    return {
      agentName,
      modelId: routing.modelId,
      temperature: routing.complexity === 'complex' ? 0.8 : routing.complexity === 'moderate' ? 0.7 : 0.6,
      maxTokens: routing.complexity === 'complex' ? 4000 : routing.complexity === 'moderate' ? 2000 : 1000,
    };
  }

  async updateAgentConfig(config: AgentRoutingConfig): Promise<void> {
    AGENT_ROUTING_MAP[config.agentName] = {
      modelId: config.modelId,
      complexity: config.maxTokens > 3000 ? 'complex' : config.maxTokens > 1500 ? 'moderate' : 'simple',
      cost: 0.01,
    };
  }

  getCostEstimate(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = MOCK_PROVIDERS.flatMap(p => p.models).find(m => m.id === modelId);
    if (!model) return 0;
    
    const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M;
    return inputCost + outputCost;
  }

  getRoutingHistory(): { request: RouteRequest; result: RouteResult }[] {
    return this.routingHistory.map((req, i) => ({ request: req, result: this.routingResults[i] }));
  }

  clearHistory(): void {
    this.routingHistory = [];
    this.routingResults = [];
  }
}

// ============================================================================
// Singleton for test reuse
// ============================================================================

let smartRouterInstance: MockSmartRouter | null = null;

export function getSmartRouterMock(): MockSmartRouter {
  if (!smartRouterInstance) {
    smartRouterInstance = new MockSmartRouter();
  }
  return smartRouterInstance;
}

export function resetSmartRouterMock(): void {
  smartRouterInstance = null;
}

