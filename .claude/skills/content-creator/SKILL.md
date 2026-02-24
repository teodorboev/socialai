---
name: content-creator
description: "Content generation agent: system prompt templates, Zod output schemas, platform-specific guidelines, quality checks, deduplication, Inngest triggers."
---

# SKILL: Content Creator Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Generates platform-specific social media content (posts, stories, reels, carousels, threads) that matches a brand's voice, follows the active content plan, and incorporates trending topics. This is the highest-volume agent — it runs multiple times daily per client.

---

## File Location

```
agents/content-creator.ts
lib/ai/prompts/content-creator.ts    ← System prompt template
lib/ai/schemas/content.ts            ← Zod output schemas
inngest/functions/content-pipeline.ts ← Scheduled trigger
```

---

## Input Interface

```typescript
interface ContentCreatorInput {
  organizationId: string;
  platform: Platform;               // "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN"
  brandConfig: {
    brandName: string;
    industry: string;
    voiceTone: {
      adjectives: string[];         // e.g. ["playful", "confident", "warm"]
      examples: string[];           // Example on-brand sentences
      avoid: string[];              // Words/phrases to never use
    };
    targetAudience: {
      demographics: string;
      interests: string[];
      painPoints: string[];
    };
    contentThemes: string[];        // Approved topic areas
    hashtagStrategy: {
      always: string[];             // Always include these
      never: string[];              // Never use these
      rotating: string[];           // Pool to pick from
    };
    doNots: string[];               // Hard rules: "never mention competitors by name"
  };
  contentPlanContext?: string;       // Current active plan from Strategy Agent
  trendContext?: string;             // From Trend Scout Agent
  previousTopPerformers?: Array<{   // From Analytics Agent
    caption: string;
    platform: string;
    engagementRate: number;
    contentType: string;
  }>;
  recentPosts?: Array<{             // Avoid repetition
    caption: string;
    createdAt: string;
  }>;
}
```

---

## Output Schema (Zod)

```typescript
// lib/ai/schemas/content.ts
import { z } from "zod";

export const ContentOutputSchema = z.object({
  caption: z.string()
    .min(1, "Caption cannot be empty")
    .max(2200, "Caption exceeds Instagram limit"),
  hashtags: z.array(z.string()).max(30),
  contentType: z.enum(["POST", "STORY", "REEL", "CAROUSEL", "THREAD", "ARTICLE", "POLL"]),
  mediaPrompt: z.string().optional()
    .describe("Detailed prompt for Visual Agent to generate imagery. Include style, colors, composition, mood."),
  altText: z.string().optional()
    .describe("Accessibility text for images"),
  linkUrl: z.string().url().optional(),
  platformNotes: z.string().optional()
    .describe("Platform-specific considerations: optimal length, format tips, CTA placement"),
  confidenceScore: z.number().min(0).max(1)
    .describe("How confident you are this matches the brand voice and will perform well"),
  reasoning: z.string()
    .describe("Brief explanation of content choices, theme alignment, and why this will resonate"),
});

export type ContentOutput = z.infer<typeof ContentOutputSchema>;
```

---

## System Prompt Template

```typescript
// lib/ai/prompts/content-creator.ts

export function buildContentCreatorPrompt(input: ContentCreatorInput): string {
  return `You are an expert social media content creator for ${input.brandConfig.brandName}.

Your job is to create ONE piece of content for ${input.platform} that is:
- Authentically on-brand (sounds like the brand, NOT like AI)
- Optimized for the platform's algorithm and audience behavior
- Engaging enough to stop the scroll
- Aligned with the current content strategy

═══════════════════════════════════════
BRAND VOICE
═══════════════════════════════════════
Tone: ${input.brandConfig.voiceTone.adjectives.join(", ")}
Industry: ${input.brandConfig.industry}

Example on-brand writing:
${input.brandConfig.voiceTone.examples.map((e, i) => `${i + 1}. "${e}"`).join("\n")}

Words/phrases to AVOID:
${input.brandConfig.voiceTone.avoid.map(a => `- "${a}"`).join("\n")}

═══════════════════════════════════════
TARGET AUDIENCE
═══════════════════════════════════════
Demographics: ${input.brandConfig.targetAudience.demographics}
Interests: ${input.brandConfig.targetAudience.interests.join(", ")}
Pain points: ${input.brandConfig.targetAudience.painPoints.join(", ")}

═══════════════════════════════════════
CONTENT RULES
═══════════════════════════════════════
Approved themes: ${input.brandConfig.contentThemes.join(", ")}

HARD RULES (never break these):
${input.brandConfig.doNots.map(d => `🚫 ${d}`).join("\n")}

HASHTAG RULES:
- Always include: ${input.brandConfig.hashtagStrategy.always.join(", ") || "none"}
- Never use: ${input.brandConfig.hashtagStrategy.never.join(", ") || "none"}
- Pick from rotating pool: ${input.brandConfig.hashtagStrategy.rotating.join(", ") || "none"}

═══════════════════════════════════════
PLATFORM: ${input.platform}
═══════════════════════════════════════
${getPlatformGuidelines(input.platform)}

${input.contentPlanContext ? `═══════════════════════════════════════\nCURRENT CONTENT PLAN\n═══════════════════════════════════════\n${input.contentPlanContext}` : ""}

${input.trendContext ? `═══════════════════════════════════════\nTRENDING NOW (consider incorporating)\n═══════════════════════════════════════\n${input.trendContext}` : ""}

${input.previousTopPerformers?.length ? `═══════════════════════════════════════\nTOP PERFORMERS (use as style/format inspiration)\n═══════════════════════════════════════\n${input.previousTopPerformers.map(p => `- [${p.contentType}] "${p.caption.slice(0, 100)}..." (${(p.engagementRate * 100).toFixed(1)}% engagement)`).join("\n")}` : ""}

${input.recentPosts?.length ? `═══════════════════════════════════════\nRECENT POSTS (avoid repeating similar content)\n═══════════════════════════════════════\n${input.recentPosts.map(p => `- "${p.caption.slice(0, 80)}..." (${p.createdAt})`).join("\n")}` : ""}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
1. Create ONE piece of content. Choose the best content type for the platform and message.
2. The content MUST sound like it was written by the brand's team, not by an AI.
3. Include a clear call-to-action where appropriate.
4. If visual content would strengthen the post, write a detailed media prompt.
5. Rate your confidence (0–1) based on brand voice match + predicted performance.
6. Explain your reasoning briefly.

Respond with a single JSON object. No markdown, no backticks, no preamble.`;
}

function getPlatformGuidelines(platform: Platform): string {
  const guidelines: Record<Platform, string> = {
    INSTAGRAM: `- Optimal caption length: 125-150 chars for feed (first line hook), up to 2200 for long-form
- First line is critical — it's what shows before "...more"
- Use line breaks for readability
- 3-5 hashtags perform best (put in caption, not comments)
- Carousel posts get 1.4x more reach than single images
- Reels: 7-15 seconds optimal, hook in first 2 seconds
- CTA: "Save this", "Share with a friend", "Double tap if..."`,
    FACEBOOK: `- Optimal post length: 40-80 characters get most engagement
- Questions drive comments
- Native video outperforms links
- Avoid engagement bait ("like if you agree") — algorithm penalizes it
- Link posts: compelling preview text matters more than the link title`,
    TIKTOK: `- Hook in first 1-2 seconds is EVERYTHING
- Optimal video length: 21-34 seconds
- Use trending sounds when relevant
- Conversational, unpolished tone performs best
- End with a question or open loop for comments
- Hashtags: 3-5, mix of niche and broad`,
    TWITTER: `- 71-100 characters get most engagement
- Threads for longer content (number each tweet)
- Hot takes and strong opinions drive engagement
- Quote tweets > retweets for reach
- Use polls for easy engagement
- Avoid external links in first tweet (kills reach)`,
    LINKEDIN: `- Professional but human tone
- First 2-3 lines visible before "see more" — make them count
- Personal stories outperform corporate content
- Optimal: 1300-2000 characters
- Use line breaks generously (one sentence per line)
- Document (carousel) posts get 2-3x reach
- Hashtags: 3-5, industry-specific`,
  };
  return guidelines[platform] || "";
}
```

---

## Inngest Trigger

```typescript
// inngest/functions/content-pipeline.ts

export const contentPipeline = inngest.createFunction(
  {
    id: "content-pipeline",
    retries: 3,
    concurrency: { limit: 5 },  // Max 5 orgs processed simultaneously
  },
  { cron: "0 */4 * * *" },  // Every 4 hours
  async ({ step }) => {
    // 1. Get orgs that need content generated
    const orgs = await step.run("get-orgs-needing-content", async () => {
      // Query orgs where:
      // - Has active subscription
      // - Has brand config
      // - Has connected social accounts
      // - Doesn't have enough scheduled content for the next 48 hours
    });

    // 2. For each org + platform combo, generate content
    for (const org of orgs) {
      for (const account of org.socialAccounts) {
        await step.run(`create-${org.id}-${account.platform}`, async () => {
          const agent = new ContentCreatorAgent();
          const result = await agent.run(org.id, { /* input */ });

          if (result.success && result.data) {
            const action = resolveAction(result.confidenceScore, await getOrgThresholds(org.id));
            // Create content record with appropriate status
            // If auto_execute → also create schedule record
          }
        });
      }
    }
  }
);
```

---

## Quality Checks Before Publishing

Before any content reaches the Publisher Agent, validate:

1. **Character limits**: Instagram (2200), Twitter (280 per tweet), LinkedIn (3000), TikTok (2200), Facebook (63,206)
2. **Brand voice compliance**: Run a quick secondary LLM check — "Does this sound like [brand]? Yes/No/Uncertain"
3. **Safety check**: No profanity (unless brand voice allows it), no sensitive topics, no competitor mentions (unless strategy allows)
4. **Hashtag validation**: Verify none are in the "never" list, required ones are present
5. **No AI tells**: Check for phrases like "As a...", "Here's a...", "In conclusion...", "It's important to note..."
6. **Deduplication**: Cosine similarity check against last 30 days of published content — reject if >0.85 similarity

---

## Testing

```typescript
// __tests__/agents/content-creator.test.ts
describe("ContentCreatorAgent", () => {
  it("should return valid ContentOutput for Instagram", async () => {
    const agent = new ContentCreatorAgent();
    const result = await agent.run(testOrgId, instagramInput);

    expect(result.success).toBe(true);
    expect(() => ContentOutputSchema.parse(result.data)).not.toThrow();
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  });

  it("should respect brand do-nots", async () => {
    const result = await agent.run(testOrgId, {
      ...input,
      brandConfig: { ...input.brandConfig, doNots: ["never mention price"] }
    });
    expect(result.data.caption.toLowerCase()).not.toContain("price");
  });

  it("should escalate low-confidence content", async () => {
    // Mock LLM to return low confidence
    const result = await agent.run(testOrgId, ambiguousInput);
    expect(result.shouldEscalate).toBe(true);
  });
});
```

---

## Common Failure Modes

| Issue | Cause | Fix |
|-------|-------|-----|
| Content sounds generic / AI-like | System prompt too vague, not enough brand examples | Add 5+ real brand post examples to `samplePosts` in BrandConfig |
| Hashtags irrelevant | Hashtag strategy not populated | Require hashtag strategy during onboarding |
| Content repeats themes | No dedup check, recentPosts not passed | Always pass last 30 days of content |
| JSON parse failure | LLM adds markdown backticks | Strip ```json fences before parsing |
| Caption too long for platform | No platform-specific validation | Add post-generation length check |
