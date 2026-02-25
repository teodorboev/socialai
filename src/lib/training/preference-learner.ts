import { prisma } from "@/lib/prisma";

interface LearnedPattern {
  pattern: string;
  confidence: number;
  evidenceCount: number;
}

/**
 * Derive preferences from feedback patterns automatically.
 * Runs periodically to analyze feedback and create learned preferences.
 */
export async function derivePatterns(
  organizationId: string,
  agentName: string
): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];

  try {
    // 1. Analyze rejection reasons
    const rejections = await prisma.aIFeedback.groupBy({
      by: ["rejectionReason"],
      where: {
        organizationId,
        agentName: agentName as any,
        feedbackType: "rejection",
        rejectionReason: { not: null },
      },
      _count: true,
    });

    for (const rejection of rejections) {
      if (rejection.rejectionReason && rejection._count >= 3) {
        patterns.push({
          pattern: `Content is frequently rejected for: ${rejection.rejectionReason}`,
          confidence: Math.min(rejection._count / 10, 0.95),
          evidenceCount: rejection._count,
        });

        // Create a learned preference
        await prisma.aIPreference.upsert({
          where: {
            id: `${organizationId}-${agentName}-${rejection.rejectionReason}`,
          },
          create: {
            organizationId,
            agentName: agentName as any,
            rule: `Avoid: ${rejection.rejectionReason.replace("_", " ")}`,
            ruleType: "avoid",
            source: "learned",
            confidence: Math.min(rejection._count / 10, 0.95),
          },
          update: {
            confidence: Math.min(rejection._count / 10, 0.95),
            updatedAt: new Date(),
          },
        });
      }
    }

    // 2. Analyze thumbs down patterns
    const negatives = await prisma.aIFeedback.findMany({
      where: {
        organizationId,
        agentName: agentName as any,
        feedbackType: "thumbs",
        rating: 0,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (negatives.length >= 5) {
      const analysis = await analyzeRejectionPatterns(negatives);
      patterns.push(...analysis);
    }

    // 3. Analyze star ratings
    const starRatings = await prisma.aIFeedback.groupBy({
      by: ["rating"],
      where: {
        organizationId,
        agentName: agentName as any,
        feedbackType: "star",
        rating: { not: null },
      },
      _count: true,
    });

    const lowRated = starRatings.find((r: { rating: number | null }) => r.rating !== null && r.rating <= 2);
    if (lowRated && lowRated._count >= 5) {
      patterns.push({
        pattern: "Low-rated content patterns detected - review for common issues",
        confidence: 0.7,
        evidenceCount: lowRated._count,
      });
    }
  } catch (error) {
    console.error("Error deriving patterns:", error);
  }

  return patterns;
}

/**
 * Analyze rejected content to find common patterns
 */
async function analyzeRejectionPatterns(
  negatives: any[]
): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];

  // Simple pattern detection based on rejection reasons
  const reasonCounts: Record<string, number> = {};
  for (const feedback of negatives) {
    if (feedback.rejectionReason) {
      reasonCounts[feedback.rejectionReason] =
        (reasonCounts[feedback.rejectionReason] || 0) + 1;
    }
  }

  // Convert to patterns
  for (const [reason, count] of Object.entries(reasonCounts)) {
    if (count >= 3) {
      patterns.push({
        pattern: `Frequently rejected for: ${reason.replace("_", " ")}`,
        confidence: Math.min(count / 10, 0.9),
        evidenceCount: count,
      });
    }
  }

  return patterns;
}

/**
 * Auto-detect top-performing posts as exemplars
 */
export async function detectTopPerformers(organizationId: string) {
  try {
    // Get recently published content with high confidence scores
    const topContent = await prisma.content.findMany({
      where: {
        organizationId,
        status: "PUBLISHED",
        confidenceScore: { gte: 0.85 },
        publishedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { confidenceScore: "desc" },
      take: 10,
    });

    for (const content of topContent) {
      // Check if already an exemplar
      const existing = await prisma.aIExemplar.findFirst({
        where: {
          organizationId,
          content: content.caption,
        },
      });

      if (!existing) {
        await prisma.aIExemplar.create({
          data: {
            organizationId,
            agentName: "CONTENT_CREATOR" as any,
            platform: content.platform,
            contentType: content.contentType,
            content: content.caption,
            context: "Auto-detected high-performing content",
            rating: Math.round((content.confidenceScore || 0.85) * 5),
            source: "top_performer",
          },
        });
      }
    }

    return { detected: topContent.length };
  } catch (error) {
    console.error("Error detecting top performers:", error);
    return { detected: 0 };
  }
}

/**
 * Run weekly pattern analysis for all organizations with sufficient feedback
 */
export async function runWeeklyPatternAnalysis() {
  // Get all orgs that have feedback
  const allOrgs = await prisma.aIFeedback.findMany({
    select: { organizationId: true },
    distinct: ["organizationId"],
  });

  const results = [];

  for (const { organizationId } of allOrgs) {
    // Check if this org has enough feedback
    const count = await prisma.aIFeedback.count({
      where: { organizationId },
    });

    if (count < 10) continue; // Skip orgs with less than 10 feedback items

    const agentNames = await prisma.aIFeedback.findMany({
      where: { organizationId },
      select: { agentName: true },
      distinct: ["agentName"],
    });

    for (const { agentName } of agentNames) {
      const patterns = await derivePatterns(organizationId, agentName);
      results.push({ orgId: organizationId, agentName, patternsFound: patterns.length });
    }

    // Also detect top performers
    await detectTopPerformers(organizationId);
  }

  return results;
}
