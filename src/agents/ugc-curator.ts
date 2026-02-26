import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  UGCuratorSchema,
  UGCuratorInputSchema,
  type UGCuratorInput,
  type UGCurator,
} from "@/lib/ai/schemas/ugc-curator";

export class UGCuratorAgent extends BaseAgent {
  constructor() {
    super("UGC_CURATOR");
  }

  async execute(input: UGCuratorInput): Promise<AgentResult<UGCurator>> {
    const parsedInput = UGCuratorInputSchema.parse(input);

    const systemPrompt = `You are a User-Generated Content (UGC) Curator specializing in managing and organizing UGC campaigns.

Your role is to review UGC submissions, approve quality content, organize into campaigns, and manage the UGC program.

CONTEXT:
- Organization wants to leverage customer content for brand promotion
- You need to review submissions against brand guidelines
- Approved UGC should be organized into campaigns for repurposing

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

BRAND GUIDELINES:
- Brand: ${parsedInput.brandGuidelines.brandName}
- Values: ${parsedInput.brandGuidelines.values.join(", ")}
- Visual Style: ${parsedInput.brandGuidelines.visualStyle.join(", ")}
- Do Nots: ${parsedInput.brandGuidelines.doNots.join(", ")}
- Content Themes: ${parsedInput.brandGuidelines.contentThemes.join(", ")}

${parsedInput.ugcSubmissions.length > 0 ? `SUBMISSIONS TO REVIEW (${parsedInput.ugcSubmissions.length}):
${parsedInput.ugcSubmissions.slice(0, 20).map((s) => `- ID: ${s.id}, Author: ${s.author}, Platform: ${s.platform}\n  Caption: ${s.caption.substring(0, 100)}...`).join("\n\n")}
` : ""}

${parsedInput.campaigns?.length ? `ACTIVE CAMPAIGNS:
${parsedInput.campaigns.map((c) => `- ${c.name}: ${c.theme}`).join("\n")}
` : ""}

INSTRUCTIONS:
1. Review each submission against brand guidelines
2. Approve content that aligns with brand values and visual style
3. Flag or reject content that doesn't meet standards
4. Create suggested captions and hashtags for approved content
5. Organize approved UGC into relevant campaigns
6. Provide confidence score based on alignment with guidelines

Respond with a JSON object matching this schema:
${JSON.stringify(UGCuratorSchema.shape, null, 2)}`;

    const result = await this.callLLM<UGCurator>({
      system: systemPrompt,
      userMessage: `Review ${parsedInput.ugcSubmissions.length} UGC submissions for ${parsedInput.brandGuidelines.brandName} and organize them into campaigns.`,
      schema: UGCuratorSchema,
      maxTokens: 3500,
    });

    if (!result.data) {
      throw new Error("Failed to generate structured UGC curation results");
    }

    const shouldEscalate = result.data.confidenceScore < 0.6;

    return {
      success: true,
      data: result.data,
      confidenceScore: result.data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${result.data.confidenceScore}): Unable to confidently assess UGC against brand guidelines`
        : undefined,
      tokensUsed: result.tokensUsed,
    };
  }
}
