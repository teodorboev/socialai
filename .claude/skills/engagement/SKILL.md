---
name: engagement
description: "Comment/DM auto-response agent: sentiment analysis, safety rules, forced escalation triggers, response length per platform, crisis detection."
---

# SKILL: Engagement Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

Monitors and responds to comments, DMs, mentions, and replies across all connected social platforms. Acts as the brand's community manager — warm, helpful, on-voice, and smart enough to know when NOT to respond and when to escalate to a human.

This is the most sensitive agent. Bad engagement responses can cause PR crises. The confidence threshold for auto-responding is higher than for content creation.

---

## File Location

```
agents/engagement.ts
lib/ai/prompts/engagement.ts
lib/ai/schemas/engagement.ts
inngest/functions/engagement-monitor.ts
```

---

## Input Interface

```typescript
interface EngagementInput {
  organizationId: string;
  platform: Platform;
  brandConfig: {
    brandName: string;
    voiceTone: { adjectives: string[]; examples: string[]; avoid: string[] };
    faqKnowledge: Array<{           // Pre-loaded Q&A pairs
      question: string;
      answer: string;
      category: string;
    }>;
    doNots: string[];
  };
  engagement: {
    type: "COMMENT" | "DIRECT_MESSAGE" | "MENTION" | "REPLY" | "QUOTE";
    authorName: string;
    authorUsername: string;
    body: string;
    parentContent?: string;         // The original post this is in response to
  };
  conversationHistory?: Array<{     // Prior exchanges in same thread
    role: "brand" | "user";
    author: string;
    body: string;
    timestamp: string;
  }>;
}
```

---

## Output Schema

```typescript
// lib/ai/schemas/engagement.ts
import { z } from "zod";

export const EngagementResponseSchema = z.object({
  response: z.string().max(500, "Response too long for social media reply"),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "URGENT"]),
  shouldRespond: z.boolean()
    .describe("false = skip this (spam, trolling, emoji-only, doesn't warrant a reply)"),
  confidenceScore: z.number().min(0).max(1),
  category: z.enum([
    "appreciation",        // "Love your product!"
    "question_faq",        // Question answered by FAQ
    "question_unknown",    // Question NOT in FAQ — needs care
    "complaint",           // Unhappy customer
    "support_request",     // Needs help with product/service
    "spam_troll",          // Ignore
    "conversation",        // General chat / banter
    "influencer_collab",   // Partnership opportunity
    "crisis",              // PR risk, legal mention, threat
  ]),
  suggestedAction: z.enum([
    "auto_respond",        // Confidence ≥ 0.85: send immediately
    "queue_for_review",    // Confidence 0.60-0.84: human reviews before sending
    "escalate",            // Confidence < 0.60 or crisis/complaint
    "skip",                // Don't respond (spam, trolling)
    "escalate_to_dm",      // Public complaint → offer to continue in DMs
  ]),
  reasoning: z.string(),
});

export type EngagementResponse = z.infer<typeof EngagementResponseSchema>;
```

---

## System Prompt Template

```typescript
export function buildEngagementPrompt(input: EngagementInput): string {
  return `You are the community manager for ${input.brandConfig.brandName} on ${input.platform}.

You are responding to social media interactions on behalf of the brand. Your responses should feel human, warm, and authentic to the brand voice. You are NOT a chatbot — you're a real person on the social team.

═══════════════════════════════════════
BRAND VOICE
═══════════════════════════════════════
Tone: ${input.brandConfig.voiceTone.adjectives.join(", ")}
Examples of how the brand talks:
${input.brandConfig.voiceTone.examples.map(e => `"${e}"`).join("\n")}

Never say: ${input.brandConfig.voiceTone.avoid.join(", ")}

═══════════════════════════════════════
FAQ KNOWLEDGE BASE
═══════════════════════════════════════
${input.brandConfig.faqKnowledge.map(f => `Q: ${f.question}\nA: ${f.answer}\n`).join("\n")}

═══════════════════════════════════════
HARD RULES
═══════════════════════════════════════
${input.brandConfig.doNots.map(d => `🚫 ${d}`).join("\n")}

ADDITIONAL ENGAGEMENT RULES:
🚫 NEVER make promises about refunds, replacements, shipping, or policy unless it's explicitly in the FAQ.
🚫 NEVER argue with customers. Empathize, offer help, move to DM.
🚫 NEVER engage with trolls, harassment, or bad-faith arguments. Skip or escalate.
🚫 NEVER share personal information about staff or internal processes.
🚫 NEVER use corporate jargon like "We apologize for the inconvenience" — be human.
🚫 NEVER respond to legal threats — escalate immediately as CRISIS.
✅ DO use the customer's name when available.
✅ DO keep replies SHORT — 1-3 sentences max for comments.
✅ DO move complex issues to DMs.
✅ DO thank people for positive feedback genuinely (not generically).
✅ DO match energy — if they use emojis, you can too. If they're formal, be formal.

═══════════════════════════════════════
INCOMING ${input.engagement.type.toUpperCase()}
═══════════════════════════════════════
From: @${input.engagement.authorUsername} (${input.engagement.authorName})
Message: "${input.engagement.body}"
${input.engagement.parentContent ? `In response to our post: "${input.engagement.parentContent.slice(0, 200)}"` : ""}

${input.conversationHistory?.length ? `CONVERSATION HISTORY:\n${input.conversationHistory.map(m => `[${m.role === "brand" ? "US" : "THEM"}] ${m.author}: ${m.body}`).join("\n")}` : ""}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
Analyze this interaction and decide how to respond. Consider:
1. Is this worth responding to? (spam/trolls = skip)
2. What category does this fall into?
3. What sentiment is the author expressing?
4. Can you confidently answer from the FAQ, or is this unknown territory?
5. Is there any PR/legal/crisis risk?

Rate your confidence:
- 0.85+ = You're sure this response is perfect and safe to auto-send
- 0.60-0.84 = Probably good but a human should glance at it
- Below 0.60 = Don't send without human approval

Respond with a single JSON object. No markdown, no backticks.`;
}
```

---

## Escalation Rules (Strict)

These override confidence scoring. If any of these conditions are true, ALWAYS escalate regardless of confidence:

| Condition | Priority | Reason |
|-----------|----------|--------|
| Sentiment = URGENT | CRITICAL | Could be a PR crisis |
| Category = crisis | CRITICAL | Legal/threat/PR risk |
| Mentions lawsuit, lawyer, legal | CRITICAL | Legal risk |
| Mentions self-harm, violence | CRITICAL | Safety risk — do not respond |
| Complaint with >1000 followers | HIGH | Influential unhappy customer |
| Same user complaining 3+ times | HIGH | Pattern of dissatisfaction |
| Question not in FAQ + involves money/policy | HIGH | Risk of incorrect promise |
| Category = influencer_collab | MEDIUM | Business opportunity for human |
| DM requesting personal info | HIGH | Privacy risk |

```typescript
function shouldForceEscalate(input: EngagementInput, output: EngagementResponse): {
  force: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
} | null {
  const body = input.engagement.body.toLowerCase();

  // Crisis keywords
  const crisisKeywords = ["lawsuit", "lawyer", "legal action", "sue", "attorney", "court"];
  if (crisisKeywords.some(k => body.includes(k))) {
    return { force: true, priority: "CRITICAL", reason: "Legal language detected" };
  }

  // Safety keywords
  const safetyKeywords = ["kill myself", "self-harm", "suicide", "end my life"];
  if (safetyKeywords.some(k => body.includes(k))) {
    return { force: true, priority: "CRITICAL", reason: "Safety concern — do not respond, escalate immediately" };
  }

  if (output.category === "crisis") {
    return { force: true, priority: "CRITICAL", reason: "Crisis detected by AI" };
  }

  if (output.category === "influencer_collab") {
    return { force: true, priority: "MEDIUM", reason: "Partnership opportunity" };
  }

  return null;
}
```

---

## Polling Strategy

```typescript
// inngest/functions/engagement-monitor.ts

export const engagementMonitor = inngest.createFunction(
  { id: "engagement-monitor", retries: 2 },
  { cron: "*/15 * * * *" },  // Every 15 minutes
  async ({ step }) => {
    // 1. Get all active social accounts
    // 2. For each account, fetch new comments/mentions/DMs since last check
    // 3. For each new engagement, run the EngagementAgent
    // 4. Based on suggestedAction:
    //    - "auto_respond" → call platform API to post reply
    //    - "queue_for_review" → save with status PENDING_REVIEW
    //    - "escalate" → create escalation record
    //    - "skip" → save with status SKIPPED
    //    - "escalate_to_dm" → post public reply + flag for DM follow-up
  }
);
```

---

## Response Length Guidelines

| Platform | Comment Reply | DM Reply |
|----------|-------------|----------|
| Instagram | 1-2 sentences, ≤150 chars | Up to 500 chars, more conversational |
| Facebook | 1-3 sentences | Up to 500 chars |
| TikTok | 1-2 sentences, ≤150 chars, match casual tone | Up to 500 chars |
| Twitter | 1-2 sentences, ≤280 chars | Up to 500 chars |
| LinkedIn | 2-3 sentences, professional tone | Up to 500 chars |

---

## Common Failure Modes

| Issue | Cause | Fix |
|-------|-------|-----|
| Responses sound robotic | Voice examples too few/generic | Add 10+ real brand reply examples to config |
| Wrong answer to FAQ question | FAQ not comprehensive | Expand FAQ; if uncertain, escalate don't guess |
| Engaging with trolls | Category misclassified | Add explicit troll pattern detection; lower shouldRespond threshold |
| Response too long for platform | No length enforcement | Post-validate against platform limits |
| Responded to deleted comment | Comment deleted between fetch and response | Check existence before posting reply |
