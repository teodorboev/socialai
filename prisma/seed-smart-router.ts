/**
 * Smart Router Seed Data
 * 
 * Seeds initial LLM providers and models with pricing.
 * Run with: npx tsx prisma/seed-smart-router.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 Seeding SmartRouter data...");

  // Create providers only if API keys exist in environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_AI_API_KEY;

  const providers = [];

  // Anthropic
  if (anthropicKey) {
    const anthropic = await prisma.lLMProvider.upsert({
      where: { name: "anthropic" },
      update: {},
      create: {
        name: "anthropic",
        displayName: "Anthropic",
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
        sortOrder: 1,
        healthStatus: "healthy",
      },
    });
    providers.push(anthropic);
    console.log("✓ Created Anthropic provider");
  }

  // OpenAI
  if (openaiKey) {
    const openai = await prisma.lLMProvider.upsert({
      where: { name: "openai" },
      update: {},
      create: {
        name: "openai",
        displayName: "OpenAI",
        apiKeyEnvVar: "OPENAI_API_KEY",
        sortOrder: 2,
        healthStatus: "healthy",
      },
    });
    providers.push(openai);
    console.log("✓ Created OpenAI provider");
  }

  // Google
  if (googleKey) {
    const google = await prisma.lLMProvider.upsert({
      where: { name: "google" },
      update: {},
      create: {
        name: "google",
        displayName: "Google Gemini",
        apiKeyEnvVar: "GOOGLE_AI_API_KEY",
        sortOrder: 3,
        healthStatus: "healthy",
      },
    });
    providers.push(google);
    console.log("✓ Created Google provider");
  }

  if (providers.length === 0) {
    console.log("⚠ No API keys found - creating placeholder providers");
    // Create placeholder providers for UI
    await prisma.lLMProvider.upsert({
      where: { name: "anthropic" },
      update: {},
      create: {
        name: "anthropic",
        displayName: "Anthropic",
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
        isActive: false,
        sortOrder: 1,
        healthStatus: "healthy",
      },
    });
    await prisma.lLMProvider.upsert({
      where: { name: "openai" },
      update: {},
      create: {
        name: "openai",
        displayName: "OpenAI",
        apiKeyEnvVar: "OPENAI_API_KEY",
        isActive: false,
        sortOrder: 2,
        healthStatus: "healthy",
      },
    });
    await prisma.lLMProvider.upsert({
      where: { name: "google" },
      update: {},
      create: {
        name: "google",
        displayName: "Google Gemini",
        apiKeyEnvVar: "GOOGLE_AI_API_KEY",
        isActive: false,
        sortOrder: 3,
        healthStatus: "healthy",
      },
    });
  }

  // Get providers for model creation
  const anthropicProvider = await prisma.lLMProvider.findUnique({ where: { name: "anthropic" } });
  const openaiProvider = await prisma.lLMProvider.findUnique({ where: { name: "openai" } });
  const googleProvider = await prisma.lLMProvider.findUnique({ where: { name: "google" } });

  // If no Google key, create a placeholder (inactive) provider
  if (!googleProvider) {
    const placeholder = await prisma.lLMProvider.upsert({
      where: { name: "google" },
      update: {},
      create: {
        name: "google",
        displayName: "Google Gemini",
        apiKeyEnvVar: "GOOGLE_AI_API_KEY",
        isActive: false,
        sortOrder: 3,
        healthStatus: "unknown",
      },
    });
    console.log("✓ Created placeholder Google provider (inactive - no API key)");
  }

  const googleProviderFinal = await prisma.lLMProvider.findUnique({ where: { name: "google" } });

  // Update Google provider to active if API key exists now
  if (googleProviderFinal && googleKey) {
    await prisma.lLMProvider.update({
      where: { id: googleProviderFinal.id },
      data: { isActive: true, healthStatus: "healthy" },
    });
    console.log("✓ Activated Google provider");
  }

  if (!anthropicProvider || !openaiProvider || !googleProviderFinal) {
    throw new Error("Failed to create required providers");
  }

  // BUDGET TIER MODELS
  // Gemini 2.0 Flash - $0.10 in / $0.40 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: googleProviderFinal.id, modelId: "gemini-2.0-flash" } },
    update: {},
    create: {
      providerId: googleProviderFinal.id,
      modelId: "gemini-2.0-flash",
      displayName: "Gemini 2.0 Flash",
      tier: "budget",
      inputPricePer1M: 10,    // $0.10 per 1M = 10 cents
      outputPricePer1M: 40,   // $0.40 per 1M = 40 cents
      maxInputTokens: 1048576, // 1M context
      maxOutputTokens: 8192,
      supportsImages: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsCaching: true,
      capabilities: ["classification", "extraction", "generation", "moderation", "translation"],
      priorityInTier: 1,
      sortOrder: 1,
    },
  });
  console.log("✓ Created Gemini 2.0 Flash (budget)");

  // GPT-4o Mini - $0.15 in / $0.60 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: openaiProvider.id, modelId: "gpt-4o-mini" } },
    update: {},
    create: {
      providerId: openaiProvider.id,
      modelId: "gpt-4o-mini",
      displayName: "GPT-4o Mini",
      tier: "budget",
      inputPricePer1M: 15,
      outputPricePer1M: 60,
      maxInputTokens: 128000,
      maxOutputTokens: 16384,
      supportsImages: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsCaching: true,
      capabilities: ["classification", "extraction", "generation", "moderation", "translation"],
      priorityInTier: 2,
      sortOrder: 2,
    },
  });
  console.log("✓ Created GPT-4o Mini (budget)");

  // Claude Haiku 4.5 - $1.00 in / $5.00 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: anthropicProvider.id, modelId: "claude-haiku-4-5-20251001" } },
    update: {},
    create: {
      providerId: anthropicProvider.id,
      modelId: "claude-haiku-4-5-20251001",
      displayName: "Claude Haiku 4.5",
      tier: "budget",
      inputPricePer1M: 100,
      outputPricePer1M: 500,
      cachedInputPricePer1M: 30, // Prompt caching
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      supportsImages: true,
      supportsToolUse: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsCaching: true,
      capabilities: ["classification", "extraction", "generation", "moderation"],
      priorityInTier: 3,
      sortOrder: 3,
    },
  });
  console.log("✓ Created Claude Haiku 4.5 (budget)");

  // MID TIER MODELS
  // Claude Sonnet 4.5 - $3.00 in / $15.00 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: anthropicProvider.id, modelId: "claude-sonnet-4-5-20250929" } },
    update: {},
    create: {
      providerId: anthropicProvider.id,
      modelId: "claude-sonnet-4-5-20250929",
      displayName: "Claude Sonnet 4.5",
      tier: "mid",
      inputPricePer1M: 300,
      outputPricePer1M: 1500,
      cachedInputPricePer1M: 30,
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      supportsImages: true,
      supportsToolUse: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsCaching: true,
      capabilities: ["generation", "reasoning", "extraction", "coding", "summarization", "rewriting"],
      priorityInTier: 1,
      sortOrder: 1,
    },
  });
  console.log("✓ Created Claude Sonnet 4.5 (mid)");

  // GPT-4o - $2.50 in / $10.00 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: openaiProvider.id, modelId: "gpt-4o" } },
    update: {},
    create: {
      providerId: openaiProvider.id,
      modelId: "gpt-4o",
      displayName: "GPT-4o",
      tier: "mid",
      inputPricePer1M: 250,
      outputPricePer1M: 1000,
      maxInputTokens: 128000,
      maxOutputTokens: 16384,
      supportsImages: true,
      supportsToolUse: true,
      supportsJson: true,
      supportsStreaming: true,
      capabilities: ["generation", "reasoning", "extraction", "coding", "summarization"],
      priorityInTier: 2,
      sortOrder: 2,
    },
  });
  console.log("✓ Created GPT-4o (mid)");

  // Gemini 2.5 Pro - $1.25 in / $10.00 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: googleProviderFinal!.id, modelId: "gemini-2.5-pro" } },
    update: {},
    create: {
      providerId: googleProviderFinal!.id,
      modelId: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      tier: "mid",
      inputPricePer1M: 125,
      outputPricePer1M: 1000,
      maxInputTokens: 1048576, // 1M context
      maxOutputTokens: 8192,
      supportsImages: true,
      supportsJson: true,
      supportsStreaming: true,
      capabilities: ["generation", "reasoning", "extraction", "coding", "summarization"],
      priorityInTier: 3,
      sortOrder: 3,
    },
  });
  console.log("✓ Created Gemini 2.5 Pro (mid)");

  // FLAGSHIP TIER MODELS
  // Claude Opus 4.5 - $15.00 in / $75.00 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: anthropicProvider.id, modelId: "claude-opus-4-5-20250929" } },
    update: {},
    create: {
      providerId: anthropicProvider.id,
      modelId: "claude-opus-4-5-20250929",
      displayName: "Claude Opus 4.5",
      tier: "flagship",
      inputPricePer1M: 1500,
      outputPricePer1M: 7500,
      cachedInputPricePer1M: 150,
      maxInputTokens: 200000,
      maxOutputTokens: 8192,
      supportsImages: true,
      supportsToolUse: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsCaching: true,
      capabilities: ["reasoning", "analysis", "strategy", "generation", "coding"],
      priorityInTier: 1,
      sortOrder: 1,
    },
  });
  console.log("✓ Created Claude Opus 4.5 (flagship)");

  // o3 - $10.00 in / $40.00 out
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: openaiProvider.id, modelId: "o3" } },
    update: {},
    create: {
      providerId: openaiProvider.id,
      modelId: "o3",
      displayName: "OpenAI o3",
      tier: "flagship",
      inputPricePer1M: 1000,
      outputPricePer1M: 4000,
      maxInputTokens: 200000,
      maxOutputTokens: 100000,
      supportsImages: true,
      supportsToolUse: true,
      supportsJson: true,
      supportsStreaming: true,
      capabilities: ["reasoning", "analysis", "strategy", "coding"],
      priorityInTier: 2,
      sortOrder: 2,
    },
  });
  console.log("✓ Created o3 (flagship)");

  // Gemini 2.5 Pro (flagship) - same model but in flagship tier for variety
  await prisma.lLMModel.upsert({
    where: { providerId_modelId: { providerId: googleProviderFinal!.id, modelId: "gemini-2.5-pro-flagship" } },
    update: {},
    create: {
      providerId: googleProviderFinal!.id,
      modelId: "gemini-2.5-pro-flagship",
      displayName: "Gemini 2.5 Pro (Extended)",
      tier: "flagship",
      inputPricePer1M: 125,
      outputPricePer1M: 1000,
      maxInputTokens: 1048576,
      maxOutputTokens: 32768, // Extended output
      supportsImages: true,
      supportsJson: true,
      supportsStreaming: true,
      capabilities: ["reasoning", "analysis", "strategy", "generation"],
      priorityInTier: 3,
      sortOrder: 3,
    },
  });
  console.log("✓ Created Gemini 2.5 Pro Extended (flagship)");

  console.log("\n✅ SmartRouter seed complete!");
  console.log("\n📊 Model counts by tier:");
  const budget = await prisma.lLMModel.count({ where: { tier: "budget" } });
  const mid = await prisma.lLMModel.count({ where: { tier: "mid" } });
  const flagship = await prisma.lLMModel.count({ where: { tier: "flagship" } });
  console.log(`   Budget: ${budget}, Mid: ${mid}, Flagship: ${flagship}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
