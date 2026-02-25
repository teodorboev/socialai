import { z } from "zod";

export const CrisisResponseSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("Assessed severity level of the crisis"),
  responseStrategy: z.object({
    approach: z.string().describe("Overall approach to handling this crisis"),
    tone: z.string().describe("Recommended tone for responses"),
    responseSpeed: z.string().describe("How quickly responses should be made"),
    channels: z.array(z.string()).describe("Which channels to prioritize for response"),
  }).describe("Strategic approach for crisis response"),
  responseTemplates: z.array(z.object({
    channel: z.string().describe("Channel this template is for"),
    type: z.string().describe("Type of response (initial acknowledgment, statement, follow-up, etc.)"),
    template: z.string().describe("The response template"),
    variables: z.array(z.string()).describe("Variables that need to be filled in"),
  })).describe("Pre-crafted response templates for various situations"),
  escalationNeeded: z.object({
    required: z.boolean().describe("Whether escalation to human team is needed"),
    reason: z.string().describe("Reason for escalation decision"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().describe("Priority level if escalation needed"),
    suggestedContacts: z.array(z.string()).optional().describe("Suggested team members to involve"),
  }).describe("Whether this crisis requires human escalation"),
  monitoringActions: z.array(z.object({
    action: z.string().describe("Action to take"),
    frequency: z.string().describe("How often to perform this action"),
    duration: z.string().describe("How long to continue monitoring"),
  })).describe("Recommended ongoing monitoring actions"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the crisis assessment"),
});

export type CrisisResponse = z.infer<typeof CrisisResponseSchema>;

export const CrisisResponseInputSchema = z.object({
  organizationId: z.string(),
  crisisType: z.string().describe("Type of crisis (product recall, negative virality, service outage, PR issue, etc.)"),
  mentions: z.array(z.object({
    platform: z.string(),
    author: z.string(),
    content: z.string(),
    reach: z.number().optional(),
    engagement: z.number().optional(),
    timestamp: z.string(),
  })).describe("Recent mentions related to the crisis"),
  sentiment: z.object({
    overall: z.string().describe("Overall sentiment (negative, neutral, positive)"),
    trend: z.string().describe("Sentiment trend (improving, stable, worsening)"),
    volume: z.number().describe("Volume of mentions"),
  }).describe("Current sentiment analysis"),
  affectedProducts: z.array(z.string()).optional().describe("Products or services affected"),
  timeline: z.object({
    startTime: z.string(),
    latestUpdate: z.string(),
  }).optional().describe("Timeline of the crisis event"),
  brandVoice: z.object({
    tone: z.array(z.string()),
    values: z.array(z.string()),
    doNots: z.array(z.string()).optional(),
  }).optional().describe("Brand voice guidelines to follow"),
  previousCrisisHandling: z.array(z.object({
    type: z.string(),
    approach: z.string(),
    outcome: z.string(),
  })).optional().describe("Previous crisis handling examples"),
});

export type CrisisResponseInput = z.infer<typeof CrisisResponseInputSchema>;
