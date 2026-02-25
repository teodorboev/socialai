import { prisma } from "@/lib/prisma";

type FeedbackType = "thumbs" | "star" | "correction" | "rejection";
type RuleType = "always" | "never" | "prefer" | "avoid";

interface CreateFeedbackInput {
  organizationId: string;
  userId: string;
  agentName: string;
  contentId?: string;
  feedbackType: FeedbackType;
  rating?: number;
  originalOutput?: string;
  correctedOutput?: string;
  rejectionReason?: string;
  notes?: string;
}

/**
 * Submit feedback for AI-generated content
 */
export async function submitFeedback(input: CreateFeedbackInput) {
  const feedback = await prisma.aIFeedback.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      agentName: input.agentName as any,
      contentId: input.contentId,
      feedbackType: input.feedbackType,
      rating: input.rating,
      originalOutput: input.originalOutput,
      correctedOutput: input.correctedOutput,
      rejectionReason: input.rejectionReason,
      notes: input.notes,
    },
  });

  // If correction, also create an exemplar from the corrected version
  if (input.feedbackType === "correction" && input.correctedOutput) {
    await prisma.aIExemplar.create({
      data: {
        organizationId: input.organizationId,
        agentName: input.agentName as any,
        content: input.correctedOutput,
        context: "Created from user correction",
        rating: 5,
        source: "correction",
      },
    });
  }

  return feedback;
}

/**
 * Submit a preference rule
 */
export async function submitPreference(
  organizationId: string,
  userId: string,
  rule: string,
  ruleType: RuleType,
  agentName?: string,
  platform?: string
) {
  return prisma.aIPreference.create({
    data: {
      organizationId,
      userId,
      agentName: agentName as any || null,
      platform: platform as any || null,
      rule,
      ruleType,
      source: "explicit",
      confidence: 1.0,
    },
  });
}

/**
 * Bookmark content as an exemplar
 */
export async function bookmarkExemplar(
  organizationId: string,
  userId: string,
  agentName: string,
  content: string,
  platform?: string,
  contentType?: string,
  context?: string
) {
  return prisma.aIExemplar.create({
    data: {
      organizationId,
      userId,
      agentName: agentName as any,
      platform: platform as any || null,
      contentType,
      content,
      context,
      rating: 5,
      source: "bookmarked",
    },
  });
}

/**
 * Get all feedback for an organization
 */
export async function getFeedbackHistory(
  organizationId: string,
  options?: {
    agentName?: string;
    feedbackType?: FeedbackType;
    limit?: number;
  }
) {
  return prisma.aIFeedback.findMany({
    where: {
      organizationId,
      ...(options?.agentName ? { agentName: options.agentName as any } : {}),
      ...(options?.feedbackType ? { feedbackType: options.feedbackType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
  });
}

/**
 * Get all preferences for an organization
 */
export async function getPreferences(organizationId: string, agentName?: string) {
  return prisma.aIPreference.findMany({
    where: {
      organizationId,
      ...(agentName ? { agentName: agentName as any } : {}),
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Get all exemplars for an organization
 */
export async function getExemplars(organizationId: string, agentName?: string) {
  return prisma.aIExemplar.findMany({
    where: {
      organizationId,
      ...(agentName ? { agentName: agentName as any } : {}),
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Toggle preference active state
 */
export async function togglePreference(preferenceId: string, isActive: boolean) {
  return prisma.aIPreference.update({
    where: { id: preferenceId },
    data: { isActive },
  });
}

/**
 * Delete a preference
 */
export async function deletePreference(preferenceId: string) {
  return prisma.aIPreference.delete({
    where: { id: preferenceId },
  });
}

/**
 * Delete an exemplar
 */
export async function deleteExemplar(exemplarId: string) {
  return prisma.aIExemplar.delete({
    where: { id: exemplarId },
  });
}

/**
 * Delete all training data for an organization
 */
export async function resetTrainingData(organizationId: string) {
  await prisma.$transaction([
    prisma.aIFeedback.deleteMany({ where: { organizationId } }),
    prisma.aIPreference.deleteMany({ where: { organizationId } }),
    prisma.aIExemplar.deleteMany({ where: { organizationId } }),
  ]);
}

/**
 * Get recent feedback for a specific content item
 */
export async function getContentFeedback(contentId: string) {
  return prisma.aIFeedback.findMany({
    where: { contentId },
    orderBy: { createdAt: "desc" },
  });
}
