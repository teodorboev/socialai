/**
 * Agent Confidence Scoring - Unit Tests
 * 
 * Tests for confidence scoring and action determination:
 * - resolveAction
 * - getContentStatusFromAction
 * - Confidence thresholds
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  resolveAction, 
  getContentStatusFromAction,
  DEFAULT_THRESHOLDS, 
  MATURE_THRESHOLDS,
  type ConfidenceThresholds,
  type ContentAction
} from "@/agents/shared/confidence";

describe("Confidence Scoring - Thresholds", () => {
  it("should have default thresholds defined", () => {
    expect(DEFAULT_THRESHOLDS).toHaveProperty("autoExecute");
    expect(DEFAULT_THRESHOLDS).toHaveProperty("flagForReview");
    expect(DEFAULT_THRESHOLDS).toHaveProperty("requireReview");
  });

  it("should have mature thresholds defined", () => {
    expect(MATURE_THRESHOLDS).toHaveProperty("autoExecute");
    expect(MATURE_THRESHOLDS).toHaveProperty("flagForReview");
    expect(MATURE_THRESHOLDS).toHaveProperty("requireReview");
  });

  it("should have lower thresholds for mature orgs", () => {
    expect(MATURE_THRESHOLDS.autoExecute).toBeLessThan(DEFAULT_THRESHOLDS.autoExecute);
    expect(MATURE_THRESHOLDS.flagForReview).toBeLessThan(DEFAULT_THRESHOLDS.flagForReview);
    expect(MATURE_THRESHOLDS.requireReview).toBeLessThan(DEFAULT_THRESHOLDS.requireReview);
  });

  it("should have threshold values between 0 and 1", () => {
    expect(DEFAULT_THRESHOLDS.autoExecute).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_THRESHOLDS.autoExecute).toBeLessThanOrEqual(1);
    expect(DEFAULT_THRESHOLDS.flagForReview).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_THRESHOLDS.flagForReview).toBeLessThanOrEqual(1);
    expect(DEFAULT_THRESHOLDS.requireReview).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_THRESHOLDS.requireReview).toBeLessThanOrEqual(1);
  });

  it("should have ascending thresholds", () => {
    expect(DEFAULT_THRESHOLDS.autoExecute).toBeGreaterThan(DEFAULT_THRESHOLDS.flagForReview);
    expect(DEFAULT_THRESHOLDS.flagForReview).toBeGreaterThan(DEFAULT_THRESHOLDS.requireReview);
  });
});

describe("Confidence Scoring - Action Determination", () => {
  it("should return auto_execute for high confidence", () => {
    const action = resolveAction(0.95, DEFAULT_THRESHOLDS);
    expect(action).toBe("auto_execute");
  });

  it("should return auto_execute at exact threshold", () => {
    const action = resolveAction(DEFAULT_THRESHOLDS.autoExecute, DEFAULT_THRESHOLDS);
    expect(action).toBe("auto_execute");
  });

  it("should return flag_and_execute for medium-high confidence", () => {
    const threshold = (DEFAULT_THRESHOLDS.autoExecute + DEFAULT_THRESHOLDS.flagForReview) / 2;
    const action = resolveAction(threshold, DEFAULT_THRESHOLDS);
    expect(action).toBe("flag_and_execute");
  });

  it("should return flag_and_execute at exact flag threshold", () => {
    const action = resolveAction(DEFAULT_THRESHOLDS.flagForReview, DEFAULT_THRESHOLDS);
    expect(action).toBe("flag_and_execute");
  });

  it("should return queue_for_review for medium confidence", () => {
    const threshold = (DEFAULT_THRESHOLDS.flagForReview + DEFAULT_THRESHOLDS.requireReview) / 2;
    const action = resolveAction(threshold, DEFAULT_THRESHOLDS);
    expect(action).toBe("queue_for_review");
  });

  it("should return queue_for_review at exact require threshold", () => {
    const action = resolveAction(DEFAULT_THRESHOLDS.requireReview, DEFAULT_THRESHOLDS);
    expect(action).toBe("queue_for_review");
  });

  it("should return escalate for low confidence", () => {
    const action = resolveAction(0.3, DEFAULT_THRESHOLDS);
    expect(action).toBe("escalate");
  });

  it("should return escalate for zero confidence", () => {
    const action = resolveAction(0, DEFAULT_THRESHOLDS);
    expect(action).toBe("escalate");
  });

  it("should use custom thresholds when provided", () => {
    const customThresholds: ConfidenceThresholds = {
      autoExecute: 0.8,
      flagForReview: 0.6,
      requireReview: 0.4,
    };

    // Should escalate at 0.5 with custom thresholds
    const action = resolveAction(0.5, customThresholds);
    expect(action).toBe("escalate");

    // Should queue for review at 0.65 with custom thresholds
    const action2 = resolveAction(0.65, customThresholds);
    expect(action2).toBe("queue_for_review");

    // Should auto execute at 0.85 with custom thresholds
    const action3 = resolveAction(0.85, customThresholds);
    expect(action3).toBe("auto_execute");
  });

  it("should handle mature thresholds correctly", () => {
    // With mature thresholds, more content gets auto-executed
    const action = resolveAction(0.78, MATURE_THRESHOLDS);
    expect(action).toBe("auto_execute");
  });
});

describe("Confidence Scoring - Content Status", () => {
  it("should return APPROVED for auto_execute", () => {
    const status = getContentStatusFromAction("auto_execute");
    expect(status).toBe("APPROVED");
  });

  it("should return APPROVED for flag_and_execute", () => {
    const status = getContentStatusFromAction("flag_and_execute");
    expect(status).toBe("APPROVED");
  });

  it("should return PENDING_REVIEW for queue_for_review", () => {
    const status = getContentStatusFromAction("queue_for_review");
    expect(status).toBe("PENDING_REVIEW");
  });

  it("should return PENDING_REVIEW for escalate", () => {
    const status = getContentStatusFromAction("escalate");
    expect(status).toBe("PENDING_REVIEW");
  });
});

describe("Confidence Scoring - Edge Cases", () => {
  it("should handle exact boundary values", () => {
    expect(resolveAction(0.5, DEFAULT_THRESHOLDS)).toBe("escalate");
    expect(resolveAction(0.51, DEFAULT_THRESHOLDS)).toBe("escalate");
  });

  it("should handle values slightly above thresholds", () => {
    const epsilon = 0.001;
    expect(resolveAction(DEFAULT_THRESHOLDS.requireReview + epsilon, DEFAULT_THRESHOLDS))
      .toBe("queue_for_review");
    expect(resolveAction(DEFAULT_THRESHOLDS.flagForReview + epsilon, DEFAULT_THRESHOLDS))
      .toBe("flag_and_execute");
    expect(resolveAction(DEFAULT_THRESHOLDS.autoExecute + epsilon, DEFAULT_THRESHOLDS))
      .toBe("auto_execute");
  });

  it("should handle maximum confidence value", () => {
    const action = resolveAction(1.0, DEFAULT_THRESHOLDS);
    expect(action).toBe("auto_execute");
  });

  it("should handle negative confidence (should escalate)", () => {
    const action = resolveAction(-0.1, DEFAULT_THRESHOLDS);
    expect(action).toBe("escalate");
  });

  it("should handle confidence above 1.0 (should auto execute)", () => {
    const action = resolveAction(1.5, DEFAULT_THRESHOLDS);
    expect(action).toBe("auto_execute");
  });
});

describe("Confidence Scoring - Threshold Progression", () => {
  it("should have clear progression from conservative to aggressive", () => {
    // Conservative (new orgs): need high confidence to auto-execute
    const conservative = DEFAULT_THRESHOLDS;
    
    // Aggressive (mature orgs): can auto-execute with lower confidence
    const aggressive = MATURE_THRESHOLDS;
    
    // Mature orgs should have lower bar for everything
    expect(aggressive.autoExecute).toBeLessThan(conservative.autoExecute);
    expect(aggressive.flagForReview).toBeLessThan(conservative.flagForReview);
    expect(aggressive.requireReview).toBeLessThan(conservative.requireReview);
  });

  it("should maintain minimum threshold gaps", () => {
    const gap1 = DEFAULT_THRESHOLDS.autoExecute - DEFAULT_THRESHOLDS.flagForReview;
    const gap2 = DEFAULT_THRESHOLDS.flagForReview - DEFAULT_THRESHOLDS.requireReview;
    
    // Gaps should be reasonable (at least 0.05)
    expect(gap1).toBeGreaterThanOrEqual(0.05);
    expect(gap2).toBeGreaterThanOrEqual(0.05);
  });
});
