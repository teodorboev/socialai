/**
 * LLM Caching - Layer 3: Template Short-Circuit
 * 
 * Bypasses Claude for predictable, low-value responses.
 * Templates are stored in the database per organization.
 */

import { prisma } from "@/lib/prisma";

interface TemplateMatch {
  matched: true;
  response: string;
  category: string;
  confidence: number;
}

interface TemplateNoMatch {
  matched: false;
}

export type TemplateResult = TemplateMatch | TemplateNoMatch;

// Built-in categories with default trigger patterns.
// These seed the DB on org creation; clients can then customize.
const BUILT_IN_CATEGORIES: Array<{
  category: string;
  triggers: RegExp[];
  defaultResponses: string[];
  maxBodyLength: number;
}> = [
  {
    category: "emoji_only",
    triggers: [/^[\p{Emoji}\s]+$/u],
    defaultResponses: ["❤️", "🙏✨", "😊💫", "🔥"],
    maxBodyLength: 20,
  },
  {
    category: "appreciation_simple",
    triggers: [
      /^(love (this|it|you)|amazing|great|awesome|fantastic|beautiful|perfect|wow|so good|obsessed)[\s!.]*$/i,
      /^(this is (amazing|great|perfect|so good))[\s!.]*$/i,
    ],
    defaultResponses: [
      "Thank you so much! ❤️",
      "This means so much to us! 🙏",
      "You just made our day! ✨",
    ],
    maxBodyLength: 60,
  },
  {
    category: "want_to_buy",
    triggers: [
      /where (can i|do i) (buy|get|find|order)/i,
      /how (do i|can i) (buy|order|get one|purchase)/i,
      /is this (available|for sale|in stock)/i,
    ],
    defaultResponses: [
      "You can shop at the link in our bio! 🛍️",
      "Head to the link in our bio to grab yours! ✨",
    ],
    maxBodyLength: 120,
  },
  {
    category: "price_inquiry",
    triggers: [
      /how much (does|is|are|do)/i,
      /what('s| is) the (price|cost)/i,
      /\bprice\b|\bcost\b|\bhow much\b/i,
    ],
    defaultResponses: [
      "DM us for pricing details! 📩",
      "Send us a DM and we'll get you all the details! 💬",
    ],
    maxBodyLength: 80,
  },
  {
    category: "shipping_inquiry",
    triggers: [
      /do you (ship|deliver) to/i,
      /shipping to/i,
      /available in/i,
    ],
    defaultResponses: [
      "DM us with your location and we'll check for you! 📦",
      "Send us a DM for shipping info! 📩",
    ],
    maxBodyLength: 100,
  },
];

/**
 * Attempts to match an engagement body against template categories.
 * Returns a template response if confident, or { matched: false } to fall through to Claude.
 */
export async function tryTemplateResponse(params: {
  organizationId: string;
  platform: string;
  engagementBody: string;
  engagementType: "COMMENT" | "DIRECT_MESSAGE" | "MENTION" | "REPLY";
}): Promise<TemplateResult> {
  // DMs always go to Claude — they're more personal and nuanced
  if (params.engagementType === "DIRECT_MESSAGE") {
    return { matched: false };
  }

  const body = params.engagementBody.trim();

  try {
    // Fetch org-specific templates from DB (includes customized + AI-improved templates)
    const orgTemplates = await prisma.engagementTemplate.findMany({
      where: {
        organizationId: params.organizationId,
        isActive: true,
        OR: [{ platform: params.platform }, { platform: null }],
      },
    });

    // Check DB templates first (org-specific, possibly AI-improved)
    for (const template of orgTemplates) {
      for (const trigger of template.triggers) {
        try {
          const pattern = new RegExp(trigger, "i");
          if (pattern.test(body) && body.length <= 200) {
            const response = pickRandom(template.responses as string[]);

            // Track usage asynchronously (don't block response)
            prisma.engagementTemplate.update({
              where: { id: template.id },
              data: { useCount: { increment: 1 } },
            }).catch(() => {}); // Fire and forget

            return {
              matched: true,
              response,
              category: template.category as string,
              confidence: 0.90,
            };
          }
        } catch {
          // Invalid regex, skip this trigger
          continue;
        }
      }
    }

    // Fall back to built-in patterns if no org-specific templates exist yet
    for (const builtin of BUILT_IN_CATEGORIES) {
      if (body.length > builtin.maxBodyLength) continue;

      for (const trigger of builtin.triggers) {
        try {
          if (trigger.test(body)) {
            return {
              matched: true,
              response: pickRandom(builtin.defaultResponses),
              category: builtin.category,
              confidence: 0.85,
            };
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    // If DB query fails, fall through to Claude
    console.error("Template matching error:", error);
  }

  return { matched: false };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Seeds default templates for a new org on creation.
 * Call from the onboarding pipeline after the org is created.
 */
export async function seedDefaultTemplates(organizationId: string): Promise<void> {
  try {
    const seeds = BUILT_IN_CATEGORIES.map((cat) => ({
      organizationId,
      category: cat.category,
      platform: null,
      triggers: cat.triggers.map((r) => r.source),
      responses: cat.defaultResponses,
      isActive: true,
    }));

    await prisma.engagementTemplate.createMany({
      data: seeds,
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("Failed to seed default templates:", error);
  }
}

/**
 * Get all templates for an organization.
 */
export async function getOrgTemplates(organizationId: string) {
  return prisma.engagementTemplate.findMany({
    where: { organizationId },
    orderBy: [{ category: "asc" }, { useCount: "desc" }],
  });
}

/**
 * Update a template.
 */
export async function updateTemplate(
  templateId: string,
  data: {
    triggers?: string[];
    responses?: string[];
    isActive?: boolean;
  }
) {
  return prisma.engagementTemplate.update({
    where: { id: templateId },
    data,
  });
}
