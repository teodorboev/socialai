import { prisma } from "@/lib/prisma";

type AgentName = string;
type Platform = string;

interface LearnedPattern {
  pattern: string;
  confidence: number;
  evidenceCount: number;
}

/**
 * Get training context for an organization and agent.
 * This is injected into every agent's prompt to provide client-specific guidance.
 */
export async function getTrainingContext(
  organizationId: string,
  agentName: AgentName,
  platform?: Platform
): Promise<string> {
  try {
    // 1. Get explicit preferences
    const preferences = await prisma.aIPreference.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { agentName: agentName as any },
          { agentName: null }, // Global preferences
        ],
      },
    });

    // 2. Filter by platform if applicable
    const platformPreferences = preferences.filter(
      (p: { platform: string | null }) => !p.platform || p.platform === platform
    );

    // 3. Get top exemplars (max 5 to keep prompt size reasonable)
    const exemplars = await prisma.aIExemplar.findMany({
      where: {
        organizationId,
        agentName: agentName as any,
        ...(platform ? { platform: platform as any } : {}),
      },
      orderBy: { rating: "desc" },
      take: 5,
    });

    // 4. Get recent corrections (max 3 most recent)
    const corrections = await prisma.aIFeedback.findMany({
      where: {
        organizationId,
        agentName: agentName as any,
        feedbackType: "correction",
        correctedOutput: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    // 5. Get learned patterns
    const learnedPatterns = await getLearnedPatterns(organizationId, agentName);

    // 6. Compose training block
    return composeTrainingBlock(
      platformPreferences,
      exemplars,
      corrections,
      learnedPatterns
    );
  } catch (error) {
    // If there's an error, return empty string - don't break the agent
    console.error("Error getting training context:", error);
    return "";
  }
}

/**
 * Compose the training context block to inject into prompts
 */
function composeTrainingBlock(
  preferences: any[],
  exemplars: any[],
  corrections: any[],
  patterns: LearnedPattern[]
): string {
  let block = "\n\n--- CLIENT-SPECIFIC TRAINING CONTEXT ---\n";

  if (preferences.length > 0) {
    block += `\nEXPLICIT RULES (follow these strictly):\n`;
    for (const pref of preferences) {
      block += `- ${pref.ruleType.toUpperCase()}: ${pref.rule}\n`;
    }
  }

  if (exemplars.length > 0) {
    block += `\nEXEMPLAR POSTS (match this quality and style):\n`;
    for (const ex of exemplars) {
      block += `- [${ex.platform ?? "any"}] "${ex.content.slice(0, 200)}"\n`;
      if (ex.context) block += `  Why it's good: ${ex.context}\n`;
    }
  }

  if (corrections.length > 0) {
    block += `\nRECENT CORRECTIONS (learn from these mistakes):\n`;
    for (const cor of corrections) {
      block += `- ORIGINAL: "${(cor.originalOutput ?? "").slice(0, 150)}"\n`;
      block += `  CORRECTED TO: "${(cor.correctedOutput ?? "").slice(0, 150)}"\n`;
    }
  }

  if (patterns.length > 0) {
    block += `\nLEARNED PATTERNS:\n`;
    for (const pat of patterns) {
      block += `- ${pat.pattern} (confidence: ${Math.round(pat.confidence * 100)}%)\n`;
    }
  }

  // Add instruction to follow training context
  block += `\nIMPORTANT: Follow the rules and examples above to match this client's preferences.\n`;

  block += `\n--- END TRAINING CONTEXT ---\n`;

  // Cap at ~2000 tokens worth of context
  if (block.length > 4000) {
    return block.slice(0, 4000) + "...\n--- END TRAINING CONTEXT ---\n";
  }

  return block;
}

/**
 * Derive learned patterns from feedback data
 */
async function getLearnedPatterns(
  organizationId: string,
  agentName: AgentName
): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];

  try {
    // Analyze rejection reasons
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
      }
    }

    // Analyze thumbs down patterns (if enough data)
    const negatives = await prisma.aIFeedback.count({
      where: {
        organizationId,
        agentName: agentName as any,
        feedbackType: "thumbs",
        rating: 0,
      },
    });

    if (negatives >= 5) {
      // Add a general pattern about rejection rate
      const total = await prisma.aIFeedback.count({
        where: {
          organizationId,
          agentName: agentName as any,
          feedbackType: "thumbs",
        },
      });

      if (total > 0) {
        const rejectionRate = negatives / total;
        if (rejectionRate > 0.3) {
          patterns.push({
            pattern: `High rejection rate detected (${Math.round(rejectionRate * 100)}%). Review preferences carefully.`,
            confidence: 0.8,
            evidenceCount: negatives,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error deriving patterns:", error);
  }

  return patterns;
}

/**
 * Get training stats for an organization
 */
export async function getTrainingStats(organizationId: string) {
  const [
    totalFeedback,
    correctionsCount,
    activeRules,
    learnedPatterns,
    exemplarsCount,
    thumbsUp,
    thumbsDown,
  ] = await Promise.all([
    prisma.aIFeedback.count({ where: { organizationId } }),
    prisma.aIFeedback.count({
      where: { organizationId, feedbackType: "correction" },
    }),
    prisma.aIPreference.count({
      where: { organizationId, isActive: true },
    }),
    getLearnedPatterns(organizationId, "CONTENT_CREATOR" as AgentName),
    prisma.aIExemplar.count({ where: { organizationId } }),
    prisma.aIFeedback.count({
      where: { organizationId, feedbackType: "thumbs", rating: 1 },
    }),
    prisma.aIFeedback.count({
      where: { organizationId, feedbackType: "thumbs", rating: 0 },
    }),
  ]);

  const accuracy =
    thumbsUp + thumbsDown > 0
      ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
      : 0;

  return {
    totalFeedback,
    correctionsCount,
    activeRules,
    learnedPatternsCount: learnedPatterns.length,
    exemplarsCount,
    accuracy,
    thumbsUp,
    thumbsDown,
  };
}
