import { BaseAgent, type AgentResult, type OrgContext } from "./shared/base-agent";
import { z } from "zod";
import { ComplianceResultSchema, type ComplianceInput } from "@/lib/ai/schemas/compliance";

export class ComplianceAgent extends BaseAgent {
  constructor() {
    super("COMPLIANCE");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as ComplianceInput;

    try {
      return await this.getPromptFromTemplate("main", {
        brandName: input.brandConfig.brandName,
        industry: input.brandConfig.industry,
        doNots: JSON.stringify(input.brandConfig.doNots),
        regulatoryNotes: input.brandConfig.regulatoryNotes || "",
        platform: input.content.platform,
        contentType: input.content.contentType,
        caption: input.content.caption,
        hashtags: JSON.stringify(input.content.hashtags),
        altText: input.content.altText || "",
        linkUrl: input.content.linkUrl || "",
      });
    } catch {
      return `You are a compliance and brand safety expert. You review content for regulatory compliance, brand guidelines, platform ToS, and copyright issues. Always respond with valid JSON.`;
    }
  }

  async execute(input: ComplianceInput): Promise<AgentResult<z.infer<typeof ComplianceResultSchema>>> {
    const orgContext: OrgContext = input as unknown as OrgContext;

    const systemPrompt = await this.buildCachedPrompt(orgContext);

    const userPrompt = `Check the following content for compliance issues:

BRAND: ${input.brandConfig.brandName}
INDUSTRY: ${input.brandConfig.industry}
DO NOTS: ${input.brandConfig.doNots.join(", ")}
${input.brandConfig.regulatoryNotes ? `REGULATORY NOTES: ${input.brandConfig.regulatoryNotes}` : ""}

CONTENT TO CHECK:
- Platform: ${input.content.platform}
- Type: ${input.content.contentType}
- Caption: ${input.content.caption}
- Hashtags: ${input.content.hashtags.join(", ")}
${input.content.altText ? `- Alt text: ${input.content.altText}` : ""}
${input.content.linkUrl ? `- Link: ${input.content.linkUrl}` : ""}

Check for:
1. FTC disclosure (sponsored content)
2. Health/medical claims (if industry is health/wellness)
3. Financial advice (if industry is finance)
4. Copyright (song lyrics, quotes)
5. Platform ToS violations
6. Brand guideline violations
7. Competitor mentions
8. Profanity
9. Sensitive topics (politics, religion)
10. Misleading claims
11. Data privacy
12. Age-restricted content
13. Accessibility (alt text)
14. Legal liability (promises, guarantees)

Respond with JSON:
{
  "passed": true|false,
  "overallRisk": "clear|low_risk|medium_risk|high_risk|blocked",
  "checks": [
    {
      "category": "category name",
      "status": "pass|warn|fail",
      "detail": "what was found",
      "suggestedFix": "how to fix (if fail or warn)"
    }
  ],
  "requiredDisclosures": ["#ad", "Not financial advice", etc],
  "suggestedRevision": "optional revised caption if needed",
  "confidenceScore": 0.0-1.0
}`;

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 2000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    const parsed = this.parseJsonResponse(text);
    const validated = ComplianceResultSchema.parse(parsed);

    const hasFailures = validated.checks.some((c) => c.status === "fail");
    const shouldEscalate = hasFailures || validated.overallRisk === "blocked" || validated.overallRisk === "high_risk";

    return {
      success: true,
      data: validated,
      confidenceScore: validated.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Compliance failures: ${validated.checks.filter((c) => c.status === "fail").map((c) => c.category).join(", ")}`
        : undefined,
      tokensUsed,
    };
  }

  private parseJsonResponse(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
