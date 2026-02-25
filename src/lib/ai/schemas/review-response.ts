import { z } from "zod";

export const ReviewResponseSchema = z.object({
  response: z.object({
    text: z.string().describe("The crafted response to the review"),
    tone: z.string().describe("Tone of the response (apologetic, grateful, neutral, etc.)"),
    shouldMentionCompensation: z.boolean().describe("Whether compensation or refund should be mentioned"),
    shouldInviteDirectContact: z.boolean().describe("Whether to invite the customer to contact directly"),
    privateMessage: z.string().optional().describe("Optional private DM follow-up if public response isn't appropriate"),
  }).describe("The generated response to the review"),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "URGENT"]).describe("Analyzed sentiment of the review"),
  shouldEscalate: z.object({
    required: z.boolean().describe("Whether human escalation is needed"),
    reason: z.string().describe("Reason for escalation decision"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().describe("Priority if escalation needed"),
    department: z.string().optional().describe("Which department should handle if escalated"),
  }).describe("Whether this review requires escalation to a human"),
  responseApproved: z.boolean().describe("Whether the response is approved for posting (vs. needs review)"),
  responseNotes: z.string().optional().describe("Additional notes about the response"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the response quality"),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

export const ReviewResponseInputSchema = z.object({
  organizationId: z.string(),
  review: z.object({
    id: z.string(),
    platform: z.enum(["GOOGLE", "YELP", "TRUSTPILOT", "FACEBOOK", "OTHER"]),
    rating: z.number().min(1).max(5).describe("Star rating"),
    title: z.string().optional().describe("Review title if available"),
    content: z.string().describe("Review text content"),
    author: z.string().describe("Name of reviewer"),
    date: z.string().describe("When the review was posted"),
    businessResponse: z.object({
      hasResponded: z.boolean(),
      responseText: z.string().optional(),
      responseDate: z.string().optional(),
    }).optional().describe("Whether business has already responded"),
    relevantContext: z.record(z.string(), z.string()).optional().describe("Additional context like order numbers, dates, etc."),
  }).describe("The review to respond to"),
  businessInfo: z.object({
    businessName: z.string(),
    industry: z.string(),
    productCategories: z.array(z.string()),
    commonIssues: z.array(z.string()).optional().describe("Common issues customers complain about"),
    policies: z.object({
      refund: z.string().optional(),
      return: z.string().optional(),
      warranty: z.string().optional(),
    }).optional().describe("Relevant business policies"),
  }).describe("Business information for context"),
  responseStyle: z.object({
    tone: z.array(z.string()).describe("Desired tone (professional, friendly, empathetic, etc.)"),
    length: z.enum(["SHORT", "MEDIUM", "LONG"]).describe("Preferred response length"),
    personalize: z.boolean().describe("Whether to personalize with customer name"),
    includeSignature: z.boolean().describe("Whether to include business signature"),
  }).describe("Guidelines for how responses should be written"),
  brandVoice: z.object({
    values: z.array(z.string()),
    doNots: z.array(z.string()).optional(),
  }).optional().describe("Brand voice guidelines"),
  previousResponses: z.array(z.object({
    platform: z.string(),
    rating: z.number(),
    response: z.string(),
  })).optional().describe("Examples of previous successful responses"),
});

export type ReviewResponseInput = z.infer<typeof ReviewResponseInputSchema>;
