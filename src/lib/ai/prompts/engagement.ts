interface EngagementInput {
  organizationId: string;
  platform: string;
  brandConfig: {
    brandName: string;
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    faqKnowledge: Array<{
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
    parentContent?: string;
  };
  engagementMetadata?: {
    authorFollowers?: number;
    repeatComplaintCount?: number;
  };
  conversationHistory?: Array<{
    role: "brand" | "user";
    author: string;
    body: string;
    timestamp: string;
  }>;
}

export function buildEngagementPrompt(input: EngagementInput): string {
  return `You are the community manager for ${input.brandConfig.brandName} on ${input.platform}.

You are responding to social media interactions on behalf of the brand. Your responses should feel human, warm, and authentic to the brand voice. You are NOT a chatbot — you're a real person on the social team.

═══════════════════════════════════════
BRAND VOICE
═══════════════════════════════════════
Tone: ${input.brandConfig.voiceTone.adjectives.join(", ")}
Examples of how the brand talks:
${input.brandConfig.voiceTone.examples.map((e) => `"${e}"`).join("\n")}

Never say: ${input.brandConfig.voiceTone.avoid.join(", ")}

═══════════════════════════════════════
FAQ KNOWLEDGE BASE
═══════════════════════════════════════
${input.brandConfig.faqKnowledge.map((f) => `Q: ${f.question}\nA: ${f.answer}\n`).join("\n")}

═══════════════════════════════════════
HARD RULES
═══════════════════════════════════════
${input.brandConfig.doNots.map((d) => `🚫 ${d}`).join("\n")}

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

${input.conversationHistory?.length ? `CONVERSATION HISTORY:\n${input.conversationHistory.map((m) => `[${m.role === "brand" ? "US" : "THEM"}] ${m.author}: ${m.body}`).join("\n")}` : ""}

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

export function shouldForceEscalate(
  input: EngagementInput,
  output: {
    category: string;
    sentiment: string;
    inFAQ?: boolean;
  }
): { force: boolean; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; reason: string } | null {
  const engagementBody = input.engagement.body.toLowerCase();

  // Crisis keywords
  const crisisKeywords = ["lawsuit", "lawyer", "legal action", "sue", "attorney", "court"];
  if (crisisKeywords.some((k) => engagementBody.includes(k))) {
    return { force: true, priority: "CRITICAL", reason: "Legal language detected" };
  }

  // Safety keywords
  const safetyKeywords = ["kill myself", "self-harm", "suicide", "end my life"];
  if (safetyKeywords.some((k) => engagementBody.includes(k))) {
    return { force: true, priority: "CRITICAL", reason: "Safety concern — do not respond, escalate immediately" };
  }

  if (output.category === "crisis") {
    return { force: true, priority: "CRITICAL", reason: "Crisis detected by AI" };
  }

  if (output.category === "influencer_collab") {
    return { force: true, priority: "MEDIUM", reason: "Partnership opportunity" };
  }

  if (output.sentiment === "URGENT") {
    return { force: true, priority: "CRITICAL", reason: "Urgent sentiment detected" };
  }

  // Additional escalation rules based on input metadata
  const meta = input.engagementMetadata;
  
  // Check for complaints with high-follower users
  if (meta?.authorFollowers && meta.authorFollowers > 1000) {
    if (output.category === "complaint" || output.sentiment === "NEGATIVE") {
      return { force: true, priority: "HIGH", reason: "Complaint from high-influence user" };
    }
  }
  
  // Check for repeat complaints
  if (meta?.repeatComplaintCount && meta.repeatComplaintCount >= 3) {
    return { force: true, priority: "HIGH", reason: "Same user has complained 3+ times" };
  }
  
  // Check for money/policy questions not in FAQ
  const moneyPolicyKeywords = ["refund", "return", "policy", "price", "cost", "billing", "subscription", "cancel"];
  const involvesMoneyOrPolicy = moneyPolicyKeywords.some(k => engagementBody.includes(k));
  
  if (involvesMoneyOrPolicy && !output.inFAQ) {
    return { force: true, priority: "HIGH", reason: "Money/policy question not in FAQ" };
  }
  
  // Check for personal info requests in DM
  if (input.engagement.type === "DIRECT_MESSAGE") {
    const personalInfoKeywords = ["address", "phone number", "email", "password", "credit card", "ssn", "social security"];
    if (personalInfoKeywords.some(k => engagementBody.includes(k))) {
      return { force: true, priority: "HIGH", reason: "DM requesting personal info - escalate to security" };
    }
  }

  return null;
}
