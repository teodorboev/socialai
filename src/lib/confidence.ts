import { prisma } from "@/lib/prisma";

export interface ConfidenceThresholds {
  autoPublishThreshold: number;
  flagForReviewThreshold: number;
  requireReviewThreshold: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoPublishThreshold: 0.90,
  flagForReviewThreshold: 0.75,
  requireReviewThreshold: 0.50,
};

export type ContentAction = "auto_publish" | "flag_and_publish" | "queue_for_review" | "escalate";

export async function getConfidenceThresholds(organizationId: string): Promise<ConfidenceThresholds> {
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId },
  });

  if (!settings) {
    return DEFAULT_THRESHOLDS;
  }

  return {
    autoPublishThreshold: settings.autoPublishThreshold,
    flagForReviewThreshold: settings.flagForReviewThreshold,
    requireReviewThreshold: settings.requireReviewThreshold,
  };
}

export function determineContentAction(
  confidence: number,
  thresholds: ConfidenceThresholds
): ContentAction {
  if (confidence >= thresholds.autoPublishThreshold) {
    return "auto_publish";
  }
  if (confidence >= thresholds.flagForReviewThreshold) {
    return "flag_and_publish";
  }
  if (confidence >= thresholds.requireReviewThreshold) {
    return "queue_for_review";
  }
  return "escalate";
}

export async function processContentWithThresholds(
  organizationId: string,
  contentId: string,
  confidenceScore: number
): Promise<{ action: ContentAction; status: string }> {
  const thresholds = await getConfidenceThresholds(organizationId);
  const action = determineContentAction(confidenceScore, thresholds);

  let status: string;
  switch (action) {
    case "auto_publish":
    case "flag_and_publish":
      status = "APPROVED";
      break;
    case "queue_for_review":
      status = "PENDING_REVIEW";
      break;
    case "escalate":
      status = "PENDING_REVIEW";
      break;
  }

  return { action, status };
}

// Engagement thresholds
export async function getEngagementSettings(organizationId: string) {
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId },
  });

  return {
    autoEngagementEnabled: settings?.autoEngagementEnabled ?? false,
    engagementConfidenceMin: settings?.engagementConfidenceMin ?? 0.85,
    engagementResponseDelaySec: settings?.engagementResponseDelaySec ?? 300,
  };
}
