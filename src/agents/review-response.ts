import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  ReviewResponseSchema,
  ReviewResponseInputSchema,
  type ReviewResponseInput,
  type ReviewResponse,
} from "@/lib/ai/schemas/review-response";

export class ReviewResponseAgent extends BaseAgent {
  constructor() {
    super("REVIEW_RESPONSE");
  }

  async execute(input: ReviewResponseInput): Promise<AgentResult<ReviewResponse>> {
    const parsedInput = ReviewResponseInputSchema.parse(input);

    const systemPrompt = `You are a Review Response Specialist specializing in responding to Google, Yelp, and other review platform reviews.

Your role is to craft professional, brand-aligned responses to customer reviews that maintain reputation and encourage engagement.

CONTEXT:
- A customer review has been received on ${parsedInput.review.platform}
- You need to analyze sentiment and craft an appropriate response
- Response must align with brand voice and business policies

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

REVIEW DETAILS:
- Platform: ${parsedInput.review.platform}
- Rating: ${parsedInput.review.rating}/5 stars
- Author: ${parsedInput.review.author}
- Review: ${parsedInput.review.content}
${parsedInput.review.title ? `- Title: ${parsedInput.review.title}` : ""}
- Date: ${parsedInput.review.date}

BUSINESS INFO:
- Business: ${parsedInput.businessInfo.businessName}
- Industry: ${parsedInput.businessInfo.industry}
${parsedInput.businessInfo.policies ? `- Refund Policy: ${parsedInput.businessInfo.policies.refund || "N/A"}
- Return Policy: ${parsedInput.businessInfo.policies.return || "N/A"}
` : ""}

RESPONSE STYLE:
- Tone: ${parsedInput.responseStyle.tone.join(", ")}
- Length: ${parsedInput.responseStyle.length}
- Personalize: ${parsedInput.responseStyle.personalize ? "Yes" : "No"}
- Include Signature: ${parsedInput.responseStyle.includeSignature ? "Yes" : "No"}

${parsedInput.brandVoice ? `BRAND VALUES: ${parsedInput.brandVoice.values.join(", ")}
DO NOTS: ${parsedInput.brandVoice.doNots?.join(", ") || "None"}
` : ""}

INSTRUCTIONS:
1. Analyze the review sentiment (POSITIVE, NEUTRAL, NEGATIVE, URGENT)
2. Craft a response that matches the requested tone
3. Never make promises about refunds/returns without policy backing
4. Determine if escalation is needed (serious complaints, legal issues, etc.)
5. Provide confidence score in the response quality

Respond with a JSON object matching this schema:
${JSON.stringify(ReviewResponseSchema.shape, null, 2)}`;

    const result = await this.callLLM<ReviewResponse>({
      system: systemPrompt,
      userMessage: `Write a response to this ${parsedInput.review.platform} review from ${parsedInput.review.author}.`,
      schema: ReviewResponseSchema,
      maxTokens: 2000,
    });

    if (!result.data) {
      throw new Error("Failed to generate structured review response");
    }

    const shouldEscalate = result.data.shouldEscalate.required || result.data.sentiment === "URGENT";

    return {
      success: true,
      data: result.data,
      confidenceScore: result.data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Review requires escalation: ${result.data.shouldEscalate.reason}`
        : undefined,
      tokensUsed: result.tokensUsed,
    };
  }
}
