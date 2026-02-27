export interface ConfidenceThresholds {
  /** Confidence threshold for auto-approval and publishing */
  autoExecute: number;
  /** Confidence threshold for auto-approval with flag for visibility */
  flagForReview: number;
  /** Confidence threshold for requiring human review */
  requireReview: number;
  /** Confidence threshold for auto-rejection (content too poor to keep) */
  autoReject: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoExecute: 0.85,    // Lowered from 0.90 for more automation
  flagForReview: 0.70,  // Lowered from 0.75
  requireReview: 0.40,  // Lowered from 0.50 for more automation
  autoReject: 0.20,      // NEW: Auto-reject very low confidence content
};

export const MATURE_THRESHOLDS: ConfidenceThresholds = {
  autoExecute: 0.75,     // More aggressive for trusted orgs
  flagForReview: 0.60,  
  requireReview: 0.30,  
  autoReject: 0.15,     
};

export type ContentAction = "auto_execute" | "flag_and_execute" | "queue_for_review" | "auto_reject" | "escalate";

export function resolveAction(confidence: number, thresholds: ConfidenceThresholds): ContentAction {
  if (confidence >= thresholds.autoExecute) return "auto_execute";
  if (confidence >= thresholds.flagForReview) return "flag_and_execute";
  if (confidence >= thresholds.requireReview) return "queue_for_review";
  if (confidence >= thresholds.autoReject) return "auto_reject";
  return "escalate";
}

export function getContentStatusFromAction(action: ContentAction): "APPROVED" | "PENDING_REVIEW" | "REJECTED" {
  switch (action) {
    case "auto_execute":
    case "flag_and_execute":
      return "APPROVED";
    case "queue_for_review":
    case "escalate":
      return "PENDING_REVIEW";
    case "auto_reject":
      return "REJECTED";
  }
}

export function getRejectionReason(confidence: number): string {
  if (confidence < 0.10) return "Very low confidence - content may be off-brand or inappropriate";
  if (confidence < 0.15) return "Content does not match brand voice guidelines";
  if (confidence < 0.20) return "Content quality below acceptable threshold";
  return "Content confidence below auto-rejection threshold";
}
