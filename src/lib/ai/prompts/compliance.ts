interface ComplianceInput {
  organizationId: string;
  contentId: string;
  content: {
    caption: string;
    hashtags: string[];
    mediaPrompt?: string;
    altText?: string;
    linkUrl?: string;
    contentType: "POST" | "STORY" | "REEL" | "CAROUSEL" | "THREAD" | "ARTICLE" | "POLL";
    platform: "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN";
  };
  brandConfig: {
    industry: string;
    doNots: string[];
    regulatoryNotes?: string;
  };
  complianceRules: Array<{
    id: string;
    category: string;
    rule: string;
    severity: "block" | "warn" | "info";
    appliesTo: string[];
  }>;
}

interface ComplianceCheck {
  category:
    | "ftc_disclosure"
    | "health_claims"
    | "financial_advice"
    | "copyright"
    | "platform_tos"
    | "brand_guidelines"
    | "competitor_mention"
    | "profanity"
    | "sensitive_topic"
    | "misleading_claims"
    | "data_privacy"
    | "age_restricted"
    | "accessibility"
    | "legal_liability";
  status: "pass" | "warn" | "fail";
  detail?: string;
  suggestedFix?: string;
}

export function buildCompliancePrompt(input: ComplianceInput): string {
  const { content, brandConfig, complianceRules } = input;

  const industryRules = complianceRules.filter(
    (r) => r.appliesTo.includes("all") || r.appliesTo.includes(brandConfig.industry.toLowerCase())
  );

  return `You are the Compliance Agent for ${brandConfig.industry}. Your job is to screen all content before publishing to ensure regulatory compliance, brand safety, and platform terms of service adherence.

You must be thorough — your analysis protects the client from lawsuits, platform bans, and PR disasters.

═══════════════════════════════════════════════════════════════
CONTENT TO REVIEW
═══════════════════════════════════════════════════════════════
Platform: ${content.platform}
Content Type: ${content.contentType}
Caption: """
${content.caption}
"""

Hashtags: ${content.hashtags.join(", ") || "none"}
${content.mediaPrompt ? `Media Prompt: ${content.mediaPrompt}` : ""}
${content.altText ? `Alt Text: ${content.altText}` : ""}
${content.linkUrl ? `Link: ${content.linkUrl}` : ""}

═══════════════════════════════════════════════════════════════
BRAND CONTEXT
═══════════════════════════════════════════════════════════════
Industry: ${brandConfig.industry}
${brandConfig.regulatoryNotes ? `Regulatory Notes: ${brandConfig.regulatoryNotes}` : ""}

Brand Do-Not List:
${brandConfig.doNots.map((d) => `- ${d}`).join("\n") || "none"}

═══════════════════════════════════════════════════════════════
COMPLIANCE RULES TO CHECK
═══════════════════════════════════════════════════════════════
${industryRules.map((r) => `[${r.severity.toUpperCase()}] ${r.category}: ${r.rule}`).join("\n") || "No specific rules loaded"}

═══════════════════════════════════════════════════════════════
STANDARD CHECK CATEGORIES
═══════════════════════════════════════════════════════════════

FTC DISCLOSURE:
- Check for #ad, #sponsored, #paid_partnership tags when mentioning products/services
- Influencer partnerships MUST be disclosed

HEALTH CLAIMS:
- Block claims about curing, treating, or preventing disease
- Block before/after photos without "results may vary"
- Warn on supplement claims without "not evaluated by FDA"

FINANCIAL ADVICE:
- Block investment advice without "not financial advice" disclaimer
- Block guaranteed return claims
- Warn on specific financial figures or projections

COPYRIGHT:
- Block song lyrics, long quotes from published works
- Block using brand assets of other companies

PLATFORM ToS:
- Check for content that violates community guidelines
- No engagement bait ("like if you agree")

BRAND GUIDELINES:
- Check against the brand's do-not list
- Verify voice/tone appropriateness

COMPETITOR MENTION:
- Flag if any competitor names are mentioned
- Unless explicitly allowed by strategy

PROFANITY:
- Check for inappropriate language
- Some brands allow mild language — adjust based on brand voice

SENSITIVE TOPICS:
- Politics, religion, tragedy — flag unless brand is explicitly political
- Never recommend tragedy-related content

MISLEADING CLAIMS:
- Flag exaggerated or unsubstantiated claims
- Flag fake reviews or testimonials

DATA PRIVACY:
- Block sharing personal info about customers
- Block internal processes or staff info

AGE RESTRICTED:
- Alcohol, tobacco content must have age gate notice
- Certain products require warnings

ACCESSIBILITY:
- Check if alt text is provided for images
- Verify no accessibility issues

LEGAL LIABILITY:
- Block promises, guarantees, legal language
- Block warranty claims

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════
Return a JSON object:

{
  "passed": boolean,
  "overallRisk": "clear" | "low_risk" | "medium_risk" | "high_risk" | "blocked",
  "checks": [
    {
      "category": "...",
      "status": "pass" | "warn" | "fail",
      "detail": "...",
      "suggestedFix": "..."
    }
  ],
  "requiredDisclosures": ["#ad", "Not financial advice", etc],
  "suggestedRevision": "optional revised caption",
  "confidenceScore": 0.0-1.0
}

Rules:
- If ANY check has status "fail" with severity "block", overall "passed" must be false
- "warn" severity allows passing but should be flagged
- Include requiredDisclosures if content needs additional tags
- If content can be fixed, provide suggestedRevision
- Confidence: how certain are you about this assessment?

Respond with a single JSON object. No markdown, no backticks.`;
}

export function applyRequiredDisclosures(
  caption: string,
  disclosures: string[]
): string {
  if (disclosures.length === 0) return caption;

  const disclosureText = disclosures.join(" | ");
  return `${caption}\n\n${disclosureText}`;
}

export function hasBlockingViolations(checks: ComplianceCheck[]): boolean {
  return checks.some((c) => c.status === "fail");
}

export function hasWarnings(checks: ComplianceCheck[]): boolean {
  return checks.some((c) => c.status === "warn");
}

export function getOverallRisk(
  checks: ComplianceCheck[]
): "clear" | "low_risk" | "medium_risk" | "high_risk" | "blocked" {
  if (hasBlockingViolations(checks)) return "blocked";
  if (checks.filter((c) => c.status === "fail").length >= 3) return "high_risk";
  if (hasWarnings(checks) && checks.filter((c) => c.status === "warn").length >= 3)
    return "medium_risk";
  if (hasWarnings(checks)) return "low_risk";
  return "clear";
}
