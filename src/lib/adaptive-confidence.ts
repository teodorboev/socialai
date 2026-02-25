import { prisma } from "@/lib/prisma";

interface ConfidenceThresholds {
  autoPublishThreshold: number;
  flagForReviewThreshold: number;
  requireReviewThreshold: number;
}

interface ReviewStats {
  totalReviews: number;
  approvals: number;
  edits: number;
  rejections: number;
  approvalRate: number;
  editRate: number;
  rejectionRate: number;
}

/**
 * Analyzes review patterns and suggests/adapts confidence thresholds
 * Based on ai-first-ux skill - Adaptive Confidence section
 */
export async function analyzeReviewPatterns(
  organizationId: string,
  daysBack: number = 30
): Promise<{
  stats: ReviewStats;
  currentThresholds: ConfidenceThresholds;
  suggestedThresholds: ConfidenceThresholds;
  shouldSuggestAutonomous: boolean;
  reason: string;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Get all content reviews in the period
  // Note: This assumes a ContentReview table exists - adjust based on actual schema
  const reviews = await prisma.content.findMany({
    where: {
      organizationId,
      updatedAt: { gte: startDate },
      status: { in: ["APPROVED", "REJECTED", "PUBLISHED"] },
    },
  });

  const totalReviews = reviews.length;
  
  // Calculate rates based on agent notes and rejection reasons
  const approvals = reviews.filter((r: { rejectionReason: string | null }) => !r.rejectionReason).length;
  const rejections = reviews.filter((r: { rejectionReason: string | null }) => r.rejectionReason).length;
  const edits = reviews.filter((r: { agentNotes: string | null }) => r.agentNotes && r.agentNotes.includes("edited")).length;

  const approvalRate = totalReviews > 0 ? approvals / totalReviews : 0;
  const editRate = totalReviews > 0 ? edits / totalReviews : 0;
  const rejectionRate = totalReviews > 0 ? rejections / totalReviews : 0;

  // Get current thresholds
  const orgSettings = await prisma.orgSettings.findUnique({
    where: { organizationId },
  });

  const currentThresholds: ConfidenceThresholds = {
    autoPublishThreshold: orgSettings?.autoPublishThreshold ?? 0.90,
    flagForReviewThreshold: orgSettings?.flagForReviewThreshold ?? 0.75,
    requireReviewThreshold: orgSettings?.requireReviewThreshold ?? 0.50,
  };

  // Calculate optimal thresholds based on behavior
  const suggestedThresholds = calculateOptimalThresholds(approvalRate, editRate, rejectionRate);

  // Check if should suggest autonomous mode
  const shouldSuggestAutonomous = approvalRate > 0.95 && editRate < 0.05 && totalReviews >= 20;

  // Generate reason
  let reason = "";
  if (shouldSuggestAutonomous) {
    reason = `You've approved ${Math.round(approvalRate * 100)}% of content without changes. Consider switching to fully autonomous mode?`;
  } else if (editRate > 0.3) {
    reason = `You're editing ${Math.round(editRate * 100)}% of generated content. I'm studying your edits to improve.`;
  } else if (approvalRate > 0.8 && editRate < 0.1) {
    reason = `Great approval rate (${Math.round(approvalRate * 100)}%). I've adjusted thresholds to reduce review friction.`;
  } else {
    reason = "Thresholds adjusted based on your review patterns.";
  }

  return {
    stats: {
      totalReviews,
      approvals,
      edits,
      rejections,
      approvalRate,
      editRate,
      rejectionRate,
    },
    currentThresholds,
    suggestedThresholds,
    shouldSuggestAutonomous,
    reason,
  };
}

function calculateOptimalThresholds(
  approvalRate: number,
  editRate: number,
  rejectionRate: number
): ConfidenceThresholds {
  // Base thresholds
  let autoPublish = 0.90;
  let flagForReview = 0.75;
  let requireReview = 0.50;

  // Adjust based on approval rate
  if (approvalRate > 0.95) {
    // Very high approval - trust the AI more
    autoPublish = 0.80;
    flagForReview = 0.65;
    requireReview = 0.40;
  } else if (approvalRate > 0.85) {
    // Good approval rate
    autoPublish = 0.85;
    flagForReview = 0.70;
    requireReview = 0.45;
  } else if (approvalRate < 0.6) {
    // Low approval rate - be more conservative
    autoPublish = 0.95;
    flagForReview = 0.85;
    requireReview = 0.65;
  }

  // Adjust based on edit rate (if edits are common, lower thresholds to get more review)
  if (editRate > 0.3) {
    autoPublish = Math.min(0.95, autoPublish + 0.05);
    flagForReview = Math.min(0.90, flagForReview + 0.10);
    requireReview = Math.min(0.75, requireReview + 0.10);
  }

  // Adjust based on rejection rate
  if (rejectionRate > 0.2) {
    autoPublish = Math.min(0.95, autoPublish + 0.05);
    flagForReview = Math.min(0.90, flagForReview + 0.05);
  }

  return {
    autoPublishThreshold: autoPublish,
    flagForReviewThreshold: flagForReview,
    requireReviewThreshold: requireReview,
  };
}

/**
 * Apply suggested thresholds to organization settings
 */
export async function applyConfidenceThresholds(
  organizationId: string,
  thresholds: ConfidenceThresholds
): Promise<void> {
  await prisma.orgSettings.update({
    where: { organizationId },
    data: {
      autoPublishThreshold: thresholds.autoPublishThreshold,
      flagForReviewThreshold: thresholds.flagForReviewThreshold,
      requireReviewThreshold: thresholds.requireReviewThreshold,
    },
  });
}

/**
 * Get content action based on confidence score and thresholds
 */
export function getContentAction(
  confidence: number,
  thresholds: ConfidenceThresholds
): "auto_publish" | "flag_and_publish" | "queue_for_review" | "escalate" {
  if (confidence >= thresholds.autoPublishThreshold) return "auto_publish";
  if (confidence >= thresholds.flagForReviewThreshold) return "flag_and_publish";
  if (confidence >= thresholds.requireReviewThreshold) return "queue_for_review";
  return "escalate";
}
