import { z } from "zod";

export const OnboardingIntelligenceSchema = z.object({
  onboardingSteps: z.array(z.object({
    step: z.number().describe("Step number in the sequence"),
    title: z.string().describe("Title of the onboarding step"),
    description: z.string().describe("Description of what this step involves"),
    type: z.enum(["QUESTIONNAIRE", "ANALYSIS", "CONFIGURATION", "APPROVAL", "EDUCATION"]).describe("Type of onboarding step"),
    fields: z.array(z.object({
      name: z.string(),
      label: z.string(),
      type: z.enum(["TEXT", "TEXTAREA", "SELECT", "MULTISELECT", "DATE", "NUMBER", "FILE"]),
      required: z.boolean(),
      options: z.array(z.string()).optional().describe("Options for SELECT/MULTISELECT"),
      placeholder: z.string().optional(),
    })).optional().describe("Form fields if this is a questionnaire step"),
    estimatedTime: z.string().describe("Estimated time to complete this step"),
    canSkip: z.boolean().describe("Whether this step can be skipped"),
  })).describe("Ordered steps for client onboarding"),
  brandVoiceSetup: z.object({
    requiredFields: z.array(z.object({
      field: z.string(),
      label: z.string(),
      description: z.string(),
      importance: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    })).describe("Required brand voice configuration fields"),
    recommendedFields: z.array(z.object({
      field: z.string(),
      label: z.string(),
      description: z.string(),
    })).describe("Optional but recommended fields"),
    questions: z.array(z.object({
      question: z.string(),
      purpose: z.string().describe("Why this question is asked"),
      exampleAnswer: z.string().optional(),
    })).describe("Questions to ask client about brand voice"),
  }).describe("Brand voice configuration requirements"),
  contentStrategy: z.object({
    recommendedPlan: z.enum(["STARTER", "GROWTH", "PRO", "ENTERPRISE"]).describe("Recommended subscription tier"),
    platformPriority: z.array(z.object({
      platform: z.string(),
      priority: z.enum(["PRIMARY", "SECONDARY", "TERTIARY"]),
      rationale: z.string().describe("Why this platform is prioritized"),
    })).describe("Recommended platform priority"),
    contentMix: z.array(z.object({
      type: z.string().describe("Content type"),
      percentage: z.number().describe("Percentage of total content"),
      frequency: z.string().describe("How often to post this type"),
    })).describe("Recommended content type mix"),
    initialCampaigns: z.array(z.object({
      name: z.string(),
      objective: z.string(),
      duration: z.string(),
      keyMessages: z.array(z.string()),
    })).describe("Suggested initial campaigns"),
    timeline: z.object({
      week1: z.array(z.string()).describe("Goals for week 1"),
      week2: z.array(z.string()).describe("Goals for week 2"),
      month1: z.array(z.string()).describe("Goals for month 1"),
    }).describe("Recommended onboarding timeline"),
  }).describe("Initial content strategy recommendations"),
  timeline: z.object({
    totalDays: z.number().describe("Total onboarding duration in days"),
    phases: z.array(z.object({
      phase: z.string(),
      duration: z.string(),
      milestones: z.array(z.string()),
      deliverables: z.array(z.string()),
    })).describe("Onboarding phases and milestones"),
    goLiveDate: z.string().describe("Target date for going live with first posts"),
  }).describe("Onboarding timeline"),
  integrations: z.array(z.object({
    type: z.string().describe("Integration type (social platform, analytics, etc.)"),
    name: z.string(),
    status: z.enum(["REQUIRED", "RECOMMENDED", "OPTIONAL"]),
    setupSteps: z.array(z.string()),
  })).describe("Required and recommended integrations"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the onboarding plan"),
});

export type OnboardingIntelligence = z.infer<typeof OnboardingIntelligenceSchema>;

export const OnboardingIntelligenceInputSchema = z.object({
  organizationId: z.string(),
  clientInfo: z.object({
    companyName: z.string(),
    industry: z.string(),
    companySize: z.enum(["SOLO", "STARTUP", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]),
    website: z.string().optional(),
    existingSocialAccounts: z.array(z.object({
      platform: z.string(),
      handle: z.string(),
      followers: z.number().optional(),
    })).optional(),
  }).describe("Basic client information"),
  goals: z.array(z.object({
    goal: z.string().describe("Primary goal"),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    metrics: z.array(z.string()).describe("How success will be measured"),
  })).describe("Client's social media goals"),
  budget: z.object({
    monthly: z.number().optional().describe("Monthly budget in dollars"),
    hasAdSpend: z.boolean().optional().describe("Whether client manages paid social separately"),
  }).optional().describe("Budget information"),
  currentPainPoints: z.array(z.string()).optional().describe("Current challenges with social media"),
  competitors: z.array(z.string()).optional().describe("Main competitors to monitor"),
  existingBrandAssets: z.object({
    hasBrandGuidelines: z.boolean(),
    hasContentLibrary: z.boolean(),
    hasHashtagStrategy: z.boolean(),
  }).optional().describe("What brand assets client already has"),
  teamInfo: z.object({
    hasSocialManager: z.boolean(),
    hasContentCreator: z.boolean(),
    hasDesigner: z.boolean(),
    preferredInvolvement: z.enum(["FULL_AUTOMATION", "REVIEW_ONLY", "COLLABORATIVE"]).optional(),
  }).optional().describe("Client's team resources"),
});

export type OnboardingIntelligenceInput = z.infer<typeof OnboardingIntelligenceInputSchema>;
