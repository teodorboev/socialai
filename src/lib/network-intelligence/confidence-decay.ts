/**
 * Network Intelligence - Confidence Decay
 * 
 * Archives insights that stop holding across clients.
 * Based on the inter-client-learning skill specification.
 */

import { prisma } from "@/lib/prisma";

const CONFIDENCE_DECAY_DAYS = 60; // If not validated in 60 days, start decaying
const MIN_EVIDENCE_COUNT = 3; // Minimum evidence to keep an insight active

/**
 * Run confidence decay check on all active insights.
 * Called monthly by the orchestrator.
 */
export async function runConfidenceDecay(): Promise<{
  archived: number;
  decayed: number;
  validated: number;
}> {
  const results = {
    archived: 0,
    decayed: 0,
    validated: 0,
  };

  // Get all active insights
  const activeInsights = await prisma.platformInsight.findMany({
    where: { isActive: true },
  });

  const now = new Date();

  for (const insight of activeInsights) {
    const lastValidated = insight.lastValidated 
      ? new Date(insight.lastValidated) 
      : insight.createdAt;

    const daysSinceValidation = Math.floor(
      (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if insight should be archived
    if (daysSinceValidation > CONFIDENCE_DECAY_DAYS * 2) {
      // More than 120 days without validation - archive completely
      await prisma.platformInsight.update({
        where: { id: insight.id },
        data: {
          isActive: false,
          archivedAt: now,
          archiveReason: "stale_no_validation",
        },
      });
      results.archived++;
      continue;
    }

    // Check if confidence should decay
    if (daysSinceValidation > CONFIDENCE_DECAY_DAYS) {
      // Decay confidence by 10% for each 30 days without validation
      const decayAmount = Math.floor(daysSinceValidation / 30) * 0.1;
      const newConfidence = Math.max(0.1, insight.confidence - decayAmount);

      await prisma.platformInsight.update({
        where: { id: insight.id },
        data: {
          confidence: newConfidence,
        },
      });
      results.decayed++;
    }
  }

  // Archive insights with too little evidence
  const lowEvidenceInsights = await prisma.platformInsight.findMany({
    where: {
      isActive: true,
      evidenceCount: { lt: MIN_EVIDENCE_COUNT },
    },
  });

  for (const insight of lowEvidenceInsights) {
    // Check if it's old enough to be considered stale
    const createdAt = new Date(insight.createdAt);
    const daysOld = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysOld > 30) {
      await prisma.platformInsight.update({
        where: { id: insight.id },
        data: {
          isActive: false,
          archivedAt: now,
          archiveReason: "insufficient_evidence",
        },
      });
      results.archived++;
    }
  }

  console.log(`Confidence decay: ${results.archived} archived, ${results.decayed} decayed, ${results.validated} validated`);

  return results;
}

/**
 * Re-validate an insight when new evidence supports it.
 * Called when aggregating patterns.
 */
export async function validateInsight(
  insightId: string,
  newEvidence: boolean = true
): Promise<void> {
  const insight = await prisma.platformInsight.findUnique({
    where: { id: insightId },
  });

  if (!insight) return;

  // Increase confidence with new evidence
  const confidenceBoost = newEvidence ? 0.05 : 0;
  const newConfidence = Math.min(1, insight.confidence + confidenceBoost);

  await prisma.platformInsight.update({
    where: { id: insightId },
    data: {
      confidence: newConfidence,
      evidenceCount: insight.evidenceCount + 1,
      lastValidated: new Date(),
    },
  });
}

/**
 * Get archived insights for review.
 */
export async function getArchivedInsights(): Promise<any[]> {
  return prisma.platformInsight.findMany({
    where: { isActive: false },
    orderBy: { archivedAt: "desc" },
  });
}

/**
 * Reactivate an archived insight if new evidence emerges.
 */
export async function reactivateInsight(insightId: string): Promise<void> {
  await prisma.platformInsight.update({
    where: { id: insightId },
    data: {
      isActive: true,
      archivedAt: null,
      archiveReason: null,
      confidence: 0.5, // Reset to moderate confidence
    },
  });
}
