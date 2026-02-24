export interface ConfidenceThresholds {
  autoExecute: number;
  flagForReview: number;
  requireReview: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoExecute: 0.90,
  flagForReview: 0.75,
  requireReview: 0.50,
};

export const MATURE_THRESHOLDS: ConfidenceThresholds = {
  autoExecute: 0.80,
  flagForReview: 0.65,
  requireReview: 0.40,
};

export type ContentAction = "auto_execute" | "flag_and_execute" | "queue_for_review" | "escalate";

export function resolveAction(confidence: number, thresholds: ConfidenceThresholds): ContentAction {
  if (confidence >= thresholds.autoExecute) return "auto_execute";
  if (confidence >= thresholds.flagForReview) return "flag_and_execute";
  if (confidence >= thresholds.requireReview) return "queue_for_review";
  return "escalate";
}

export function getContentStatusFromAction(action: ContentAction): "APPROVED" | "PENDING_REVIEW" {
  switch (action) {
    case "auto_execute":
    case "flag_and_execute":
      return "APPROVED";
    case "queue_for_review":
    case "escalate":
      return "PENDING_REVIEW";
  }
}
