import { z } from "zod";

export const AdCopySchema = z.object({
  adVariations: z.array(z.object({
    id: z.string().describe("Unique identifier for this ad variation"),
    headline: z.string().describe("Primary headline"),
    headline2: z.string().optional().describe("Secondary headline if applicable"),
    description: z.string().describe("Primary ad description"),
    description2: z.string().optional().describe("Additional description text"),
    cta: z.string().describe("Call-to-action button text"),
    adFormat: z.enum(["CAROUSEL", "SINGLE_IMAGE", "SINGLE_VIDEO", "COLLECTION", "STORY"]).describe("Ad format type"),
    hook: z.string().describe("The opening hook/attention grabber"),
    body: z.string().describe("Main body copy"),
    bulletPoints: z.array(z.string()).describe("Key selling points"),
    targetingSuggestion: z.string().describe("Suggested targeting approach"),
    platformOptimizations: z.record(z.string(), z.string()).optional().describe("Platform-specific adjustments"),
  })).describe("Generated ad variations"),
  targeting: z.object({
    audiences: z.array(z.object({
      name: z.string(),
      description: z.string(),
      criteria: z.array(z.object({
        type: z.string().describe("Interest, behavior, demographic, etc."),
        value: z.string().describe("The targeting criterion"),
        operator: z.enum(["include", "exclude"]).describe("Include or exclude this criterion"),
      })),
      estimatedReach: z.number().optional().describe("Estimated audience size"),
    })),
    lookalikeSuggestions: z.array(z.object({
      source: z.string().describe("What to base lookalike on"),
      percentage: z.string().describe("Similarity percentage"),
    })).optional().describe("Lookalike audience suggestions"),
    exclusionLists: z.array(z.string()).optional().describe("Audiences to exclude"),
  }).describe("Targeting recommendations"),
  budget: z.object({
    totalBudget: z.number().describe("Total budget recommendation"),
    dailySpend: z.number().describe("Recommended daily spend"),
    bidStrategy: z.enum(["LOWEST_COST", "TARGET_COST", "HIGHEST_VOLUME"]).describe("Bid strategy recommendation"),
    bidAmount: z.number().optional().describe("Target cost per result if applicable"),
    duration: z.object({
      start: z.string(),
      end: z.string(),
      weeks: z.number().describe("Campaign duration in weeks"),
    }).describe("Campaign duration"),
  }).describe("Budget allocation recommendations"),
  expectedROI: z.object({
    estimatedCPM: z.number().describe("Estimated cost per 1000 impressions"),
    estimatedCTR: z.number().describe("Estimated click-through rate"),
    estimatedCPC: z.number().describe("Estimated cost per click"),
    estimatedConversions: z.number().describe("Estimated number of conversions"),
    estimatedROAS: z.number().describe("Estimated return on ad spend"),
    confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Confidence in ROI estimates"),
    assumptions: z.array(z.string()).describe("Key assumptions behind estimates"),
  }).describe("Expected return on investment"),
  creativeAssets: z.array(z.object({
    type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_CARDS"]),
    specifications: z.object({
      aspectRatio: z.string(),
      dimensions: z.string(),
      duration: z.string().optional().describe("For video ads"),
    }).describe("Required specifications"),
    suggestions: z.array(z.string()).describe("Content suggestions for the creative"),
  })).describe("Creative asset recommendations"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the ad copy quality"),
});

export type AdCopy = z.infer<typeof AdCopySchema>;

export const AdCopyInputSchema = z.object({
  organizationId: z.string(),
  product: z.object({
    name: z.string(),
    description: z.string(),
    category: z.string(),
    price: z.number().optional().describe("Price in dollars"),
    USPs: z.array(z.string()).describe("Unique selling points"),
    targetCustomers: z.array(z.string()).describe("Who typically buys this"),
    competitors: z.array(z.string()).optional().describe("Main competitors"),
  }).describe("Product or service being advertised"),
  targetAudience: z.object({
    demographics: z.object({
      ageRange: z.array(z.number()),
      gender: z.array(z.string()),
      locations: z.array(z.string()),
      interests: z.array(z.string()),
    }).describe("Target demographic information"),
    behaviors: z.array(z.string()).optional().describe("Target behavioral characteristics"),
    painPoints: z.array(z.string()).describe("Problems the audience wants to solve"),
    motivations: z.array(z.string()).describe("What drives the audience to purchase"),
  }).describe("Target audience definition"),
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "LINKEDIN", "TWITTER"]).describe("Advertising platform"),
  campaignObjective: z.enum(["AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEADS", "SALES", "APP_INSTALLS"]).describe("Campaign objective"),
  budget: z.object({
    totalBudget: z.number(),
    duration: z.number().describe("Duration in weeks"),
    dailyBudget: z.number().optional(),
  }).describe("Campaign budget constraints"),
  brandVoice: z.object({
    tone: z.array(z.string()),
    doNots: z.array(z.string()).optional(),
  }).optional().describe("Brand voice guidelines"),
  previousAds: z.array(z.object({
    platform: z.string(),
    performance: z.object({
      ctr: z.number().optional(),
      cpc: z.number().optional(),
      conversions: z.number().optional(),
      roas: z.number().optional(),
    }),
    whatWorked: z.array(z.string()).optional(),
    whatDidntWork: z.array(z.string()).optional(),
  })).optional().describe("Performance data from previous ad campaigns"),
});

export type AdCopyInput = z.infer<typeof AdCopyInputSchema>;
