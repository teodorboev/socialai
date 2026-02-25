import { z } from "zod";

export const UGCuratorSchema = z.object({
  approvedUGC: z.array(z.object({
    id: z.string().describe("Unique identifier for the UGC"),
    originalContent: z.object({
      author: z.string(),
      platform: z.string(),
      originalCaption: z.string(),
      mediaUrl: z.string().optional(),
    }).describe("Original content details"),
    whyApproved: z.string().describe("Reason for approval"),
    suggestedCaption: z.string().describe("Recommended caption for reposting"),
    suggestedHashtags: z.array(z.string()).describe("Recommended hashtags"),
    campaignFit: z.array(z.string()).describe("Which campaigns this UGC fits"),
    permissions: z.object({
      explicit: z.boolean().describe("Whether explicit permission was obtained"),
      platformCompliant: z.boolean().describe("Whether reuse complies with platform terms"),
    }).describe("Permission status"),
  })).describe("UGC approved for brand use"),
  pendingUGC: z.array(z.object({
    id: z.string(),
    originalContent: z.object({
      author: z.string(),
      platform: z.string(),
      originalCaption: z.string(),
      mediaUrl: z.string().optional(),
    }),
    pendingReason: z.string().describe("Why review is needed"),
    suggestedActions: z.array(z.string()).describe("Actions needed for approval"),
  })).describe("UGC requiring additional review or permission"),
  rejectedUGC: z.array(z.object({
    id: z.string(),
    originalContent: z.object({
      author: z.string(),
      platform: z.string(),
      originalCaption: z.string(),
    }),
    rejectionReason: z.string().describe("Reason for rejection"),
    canResubmit: z.boolean().describe("Whether this can be resubmitted after changes"),
  })).describe("UGC rejected from program"),
  curatedCampaigns: z.array(z.object({
    name: z.string(),
    description: z.string(),
    theme: z.string(),
    ugcIds: z.array(z.string()).describe("UGC pieces included in this campaign"),
    targetPlatforms: z.array(z.string()),
    suggestedPostingSchedule: z.array(z.string()).describe("When to post this campaign content"),
    expectedEngagement: z.string().describe("Expected engagement based on source content"),
  })).describe("Organized UGC into campaign groups"),
  nextReviewDate: z.string().describe("When to next review pending submissions"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the curation decisions"),
});

export type UGCurator = z.infer<typeof UGCuratorSchema>;

export const UGCuratorInputSchema = z.object({
  organizationId: z.string(),
  ugcSubmissions: z.array(z.object({
    id: z.string(),
    author: z.string().describe("Original author username or name"),
    platform: z.string().describe("Platform where content was posted"),
    contentType: z.string().describe("Type of content (image, video, text)"),
    caption: z.string().describe("Original caption"),
    mediaUrl: z.string().optional().describe("URL to media content"),
    hashtags: z.array(z.string()).describe("Hashtags used in original"),
    engagement: z.object({
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      views: z.number().optional(),
    }).optional().describe("Engagement metrics"),
    postedAt: z.string().describe("When the content was posted"),
    hasPermission: z.boolean().optional().describe("Whether permission has been requested/obtained"),
  })).describe("New UGC submissions to review"),
  brandGuidelines: z.object({
    brandName: z.string(),
    values: z.array(z.string()).describe("Brand values that content should align with"),
    visualStyle: z.array(z.string()).describe("Visual style preferences"),
    doNots: z.array(z.string()).describe("Things to avoid in UGC"),
    requiredHashtags: z.array(z.string()).optional().describe("Required hashtags for UGC program"),
    contentThemes: z.array(z.string()).describe("Themes/brands the brand wants UGC for"),
  }).describe("Brand guidelines for UGC approval"),
  existingUGC: z.array(z.object({
    id: z.string(),
    author: z.string(),
    status: z.enum(["approved", "pending", "rejected"]),
    campaignIds: z.array(z.string()).optional(),
  })).optional().describe("Previously curated UGC for reference"),
  campaigns: z.array(z.object({
    id: z.string(),
    name: z.string(),
    theme: z.string(),
    status: z.string(),
  })).optional().describe("Active campaigns to organize UGC into"),
});

export type UGCuratorInput = z.infer<typeof UGCuratorInputSchema>;
