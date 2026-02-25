---
name: compliance
description: "Pre-screens all content before publishing against industry regulations, brand guidelines, and platform ToS. Catches FTC violations, health claims, financial advice, copyright issues. Gate between Content Creator and Publisher."
---

# SKILL: Compliance & Brand Safety Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Acts as the final gate between content creation and publishing. Every piece of content passes through this agent before it can be published. Checks for regulatory compliance, brand safety, platform terms of service violations, copyright concerns, and content appropriateness. Blocks non-compliant content and explains why.

This agent protects the client from lawsuits, platform bans, and PR disasters.

---

## File Location

```
agents/compliance.ts
lib/ai/prompts/compliance.ts
lib/ai/schemas/compliance.ts
```

---

## Position in Pipeline

```
Content Creator → [Compliance Agent] → Publisher
                       ↓ FAIL
                  Review Queue with violation details
```

**Every** piece of content must pass compliance before publishing. No exceptions. This includes auto-approved content (confidence ≥ threshold) — compliance still runs.

---

## Input Interface

```typescript
interface ComplianceInput {
  organizationId: string;
  contentId: string;
  content: {
    caption: string;
    hashtags: string[];
    mediaPrompt?: string;
    altText?: string;
    linkUrl?: string;
    contentType: string;
    platform: Platform;
  };
  brandConfig: {
    industry: string;
    doNots: string[];
    regulatoryNotes?: string;     // "We are a financial services company — no investment advice"
  };
  complianceRules: ComplianceRule[];  // From DB — industry-specific rules
}

interface ComplianceRule {
  id: string;
  category: string;
  rule: string;
  severity: "block" | "warn" | "info";
  appliesTo: string[];  // Industries or "all"
}
```

---

## Output Schema

```typescript
const ComplianceResultSchema = z.object({
  passed: z.boolean(),
  overallRisk: z.enum(["clear", "low_risk", "medium_risk", "high_risk", "blocked"]),

  checks: z.array(z.object({
    category: z.enum([
      "ftc_disclosure",         // Sponsored content without #ad or #sponsored
      "health_claims",          // Unsubstantiated health/medical claims
      "financial_advice",       // Investment advice without disclaimers
      "copyright",              // Copyrighted material, song lyrics, quotes
      "platform_tos",           // Violates platform community guidelines
      "brand_guidelines",       // Violates client's own do-nots
      "competitor_mention",     // Names a competitor (unless strategy allows)
      "profanity",              // Inappropriate language for the brand
      "sensitive_topic",        // Politics, religion, tragedy
      "misleading_claims",      // Exaggerated or false claims
      "data_privacy",           // Shares personal info, customer data
      "age_restricted",         // Alcohol, tobacco content without age gates
      "accessibility",          // Missing alt text, poor contrast
      "legal_liability",        // Promises, guarantees, legal language
    ]),
    status: z.enum(["pass", "warn", "fail"]),
    detail: z.string().optional(),
    suggestedFix: z.string().optional(),
  })),

  requiredDisclosures: z.array(z.string())
    .describe("Disclosures that must be added: '#ad', 'Not financial advice', etc."),

  suggestedRevision: z.string().optional()
    .describe("If fixable, a compliant version of the caption"),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Industry-Specific Rules (from DB)

```
Healthcare / Wellness:
- Block any claim about curing, treating, or preventing disease without FDA disclaimer
- Block before/after photos without "results may vary" disclaimer
- Warn on supplement claims without "not evaluated by FDA"

Financial Services:
- Block investment advice without "not financial advice" disclaimer
- Block guaranteed return claims
- Warn on any specific financial figures or projections

Food & Beverage:
- Warn on health claims about food products
- Block "organic" or "natural" claims without certification
- Block alcohol content without age restriction notice

Real Estate:
- Block fair housing violations (discriminatory language)
- Warn on price claims without "subject to change"

All Industries:
- Block copyrighted material (song lyrics, long quotes)
- Warn on unverified statistics or claims
- Block personal/customer data
- Warn on competitor mentions
- Block content that violates platform ToS
```

---

## Database

```prisma
model ComplianceRule {
  id          String   @id @default(uuid())
  category    String
  rule        String   @db.Text
  severity    String   // "block", "warn", "info"
  industries  String[] // ["healthcare", "finance"] or ["all"]
  platforms   String[] // ["all"] or specific platforms
  isEnabled   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ComplianceCheck {
  id              String   @id @default(uuid())
  organizationId  String
  contentId       String
  passed          Boolean
  overallRisk     String
  checks          Json     // Array of check results
  requiredDisclosures String[]
  suggestedRevision String? @db.Text
  checkedAt       DateTime @default(now())

  @@index([organizationId, checkedAt])
  @@index([contentId])
}
```

Admin UI:
- Super Admin → Compliance Rules (add/edit/toggle rules per industry)
- Dashboard → Content → each item shows compliance badge (✅ clear / ⚠️ warning / ❌ blocked)
- Dashboard → Compliance Log → history of all checks with details

---

## Execution

This agent runs synchronously in the publish pipeline — NOT as a cron job:

```typescript
// In the Publisher Agent or content approval flow:
const compliance = new ComplianceAgent();
const result = await compliance.run(organizationId, {
  contentId,
  content,
  brandConfig,
  complianceRules: await getComplianceRules(brandConfig.industry),
});

if (!result.data.passed) {
  // Block publishing
  await prisma.content.update({
    where: { id: contentId },
    data: {
      status: "COMPLIANCE_BLOCKED",
      metadata: { complianceResult: result.data },
    },
  });
  // Route to review queue with violation details
  return;
}

if (result.data.requiredDisclosures.length > 0) {
  // Auto-append required disclosures to caption
  content.caption += "\n\n" + result.data.requiredDisclosures.join(" | ");
}

// Proceed to publish
```

---

## Rules

1. **Compliance runs on EVERY piece of content.** Even auto-approved, even high-confidence.
2. **"block" severity = hard stop.** Content cannot publish until fixed and re-checked.
3. **"warn" severity = flag but allow.** Publishable, but flagged in dashboard for awareness.
4. **Auto-append disclosures** when required (e.g., #ad for sponsored content).
5. **Never override compliance blocks programmatically.** Only a human can approve a blocked item.
6. **Log every check.** Compliance audit trail is critical for regulated industries.
