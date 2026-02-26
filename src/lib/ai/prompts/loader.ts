/**
 * AI Prompts - Template Loader
 * 
 * Loads prompt templates from DB and interpolates variables.
 * Supports {{variable}} syntax for dynamic values.
 */

import { prisma } from "@/lib/prisma";
import type { AgentName } from "@prisma/client";

// Simple in-memory cache with 5-minute TTL
const promptCache = new Map<string, { template: string; expiresAt: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PromptTemplateRow {
  id: string;
  agentName: string;
  name: string;
  body: string;
  variables: string[];
  version: number;
  isActive: boolean;
}

/**
 * Load a prompt template from DB with caching.
 * 
 * @param agentName - The agent name (e.g., "CONTENT_CREATOR")
 * @param templateName - The template name (e.g., "main", "quick_reply")
 * @param orgId - Optional org ID for org-specific templates
 * @returns The prompt body, or null if not found
 */
export async function getPromptTemplate(
  agentName: string,
  templateName: string = "main",
  orgId?: string
): Promise<string | null> {
  const cacheKey = `${agentName}:${templateName}:${orgId ?? "system"}`;
  
  // Check cache first
  const cached = promptCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.template;
  }

  try {
    // Try org-specific first, then fall back to system
    const template = await prisma.promptTemplate.findFirst({
      where: {
        agentName: agentName as AgentName,
        name: templateName,
        isActive: true,
        ...(orgId ? {} : {}), // Can add org filtering later
      },
      orderBy: { version: "desc" },
    });

    if (!template) {
      return null;
    }

    // Cache the result
    promptCache.set(cacheKey, {
      template: template.body,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return template.body;
  } catch (error) {
    console.error("Failed to load prompt template:", error);
    return null;
  }
}

/**
 * Interpolate variables into a prompt template.
 * Replaces {{variable}} with provided values.
 * 
 * @param template - The prompt template with {{variable}} placeholders
 * @param variables - Key-value pairs to replace
 * @returns The interpolated prompt
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string | number | boolean | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
  }

  // Remove any remaining unreplaced variables (optional - could throw instead)
  const unreplaced = result.match(/\{\{(\w+)\}\}/g);
  if (unreplaced) {
    console.warn(`Unreplaced variables in prompt: ${unreplaced.join(", ")}`);
  }

  return result;
}

/**
 * Load and interpolate a prompt in one call.
 * Convenience function for agents.
 */
export async function loadPrompt(
  agentName: string,
  templateName: string,
  variables: Record<string, string | number | boolean | undefined>,
  orgId?: string
): Promise<string> {
  const template = await getPromptTemplate(agentName, templateName, orgId);
  
  if (!template) {
    throw new Error(`No prompt template found for ${agentName}:${templateName}`);
  }

  return interpolatePrompt(template, variables);
}

/**
 * Clear the prompt cache.
 * Useful for admin UI after updating templates.
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Get all templates for an agent (for admin UI).
 */
export async function getAllTemplatesForAgent(agentName: string): Promise<PromptTemplateRow[]> {
  return prisma.promptTemplate.findMany({
    where: {
      agentName: agentName as AgentName,
    },
    orderBy: [{ name: "asc" }, { version: "desc" }],
  }) as Promise<PromptTemplateRow[]>;
}

/**
 * Create or update a prompt template.
 */
export async function upsertPromptTemplate(params: {
  agentName: string;
  name: string;
  body: string;
  variables: string[];
  description?: string;
}): Promise<void> {
  const { agentName, name, body, variables, description } = params;

  // Get latest version
  const latest = await prisma.promptTemplate.findFirst({
    where: { agentName: agentName as AgentName, name },
    orderBy: { version: "desc" },
  });

  const newVersion = (latest?.version ?? 0) + 1;

  await prisma.promptTemplate.create({
    data: {
      agentName: agentName as AgentName,
      name,
      body,
      variables,
      description,
      version: newVersion,
      isActive: true,
    },
  });

  // Clear cache for this agent
  clearPromptCache();
}
