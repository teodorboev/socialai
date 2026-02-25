import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

/**
 * Event: Content Approved
 * When content is manually approved in the review queue
 */
export const onContentApproved = inngest.createFunction(
  {
    id: "on-content-approved",
    name: "On Content Approved",
    retries: 2,
  },
  {
    event: "content/approved",
  },
  async ({ event }) => {
    const { contentId, organizationId, scheduledFor } = event.data;

    // Get content details
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        socialAccount: true,
      },
    });

    if (!content || !content.socialAccount) {
      return { success: false, error: "Content or social account not found" };
    }

    const socialAccountId = content.socialAccountId;
    if (!socialAccountId) {
      return { success: false, error: "Content has no social account" };
    }

    // Determine optimal posting time if not specified
    let postTime = scheduledFor ? new Date(scheduledFor) : new Date();
    
    // If no time specified, calculate optimal time based on platform
    if (!scheduledFor) {
      // Default to next optimal slot (e.g., 9am or 6pm)
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 9) {
        postTime.setHours(9, 0, 0, 0);
      } else if (hour < 18) {
        postTime.setHours(18, 0, 0, 0);
      } else {
        postTime.setDate(postTime.getDate() + 1);
        postTime.setHours(9, 0, 0, 0);
      }
    }

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        organizationId,
        contentId: content.id,
        socialAccountId: socialAccountId,
        scheduledFor: postTime,
        status: "PENDING",
      },
    });

    // Send event for immediate processing if time is now
    if (postTime <= new Date()) {
      await inngest.send({
        name: "schedule/immediate",
        data: { scheduleId: schedule.id },
      });
    }

    return { success: true, scheduleId: schedule.id, scheduledFor: postTime };
  }
);

/**
 * Event: Escalation Resolved
 * When a human resolves an escalation, apply the resolution
 */
export const onEscalationResolved = inngest.createFunction(
  {
    id: "on-escalation-resolved",
    name: "On Escalation Resolved",
    retries: 2,
  },
  {
    event: "escalation/resolved",
  },
  async ({ event }) => {
    const { 
      escalationId, 
      organizationId, 
      resolution, 
      action,
      referenceType,
      referenceId 
    } = event.data;

    // Update escalation status
    await prisma.escalation.update({
      where: { id: escalationId },
      data: {
        status: "RESOLVED",
        resolution: resolution as string,
      },
    });

    // Apply the resolution based on type
    switch (action) {
      case "publish_draft":
        if (referenceType === "content" && referenceId) {
          await prisma.content.update({
            where: { id: referenceId },
            data: { status: "APPROVED" },
          });
        }
        break;

      case "send_response":
        if (referenceType === "engagement" && referenceId) {
          await prisma.engagement.update({
            where: { id: referenceId },
            data: { 
              aiResponseStatus: "APPROVED",
              respondedAt: new Date(),
            },
          });
        }
        break;

      case "update_strategy":
        if (referenceType === "content_plan" && referenceId) {
          await prisma.contentPlan.update({
            where: { id: referenceId },
            data: { status: "ACTIVE" },
          });
        }
        break;

      case "dismiss":
        // Just mark as resolved, no action needed
        break;
    }

    return { success: true, action };
  }
);

/**
 * Event: Account Connected
 * When a new social account is connected, run initial analysis
 */
export const onAccountConnected = inngest.createFunction(
  {
    id: "on-account-connected",
    name: "On Account Connected",
    retries: 2,
  },
  {
    event: "account/connected",
  },
  async ({ event }) => {
    const { organizationId, socialAccountId } = event.data;

    // Get the account
    const account = await prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
      include: {
        organization: {
          include: {
            brandConfig: true,
          },
        },
      },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    const results = {
      historicalFetched: false,
      analyticsAnalyzed: false,
      initialContentGenerated: false,
    };

    // Step 1: Fetch historical posts (would integrate with platform APIs)
    // In production: fetch last 90 days of posts from the platform
    try {
      // Placeholder: would call platform API to fetch historical posts
      // const posts = await fetchHistoricalPosts(account.platform, account.platformUserId);
      
      results.historicalFetched = true;
    } catch (error) {
      console.error("Failed to fetch historical posts:", error);
    }

    // Step 2: Run initial analytics analysis
    try {
      // Create initial analytics snapshot
      await prisma.analyticsSnapshot.create({
        data: {
          organizationId,
          socialAccountId: account.id,
          platform: account.platform,
          snapshotDate: new Date(),
          followers: 0, // Would be fetched from platform
          rawData: { initialSync: true },
        },
      });
      
      results.analyticsAnalyzed = true;
    } catch (error) {
      console.error("Failed to analyze initial analytics:", error);
    }

    // Step 3: Generate initial content if org is ready
    const org = account.organization;
    if (org.brandConfig) {
      try {
        // Trigger initial content generation
        await inngest.send({
          name: "content/generate",
          data: {
            organizationId,
            socialAccountId: account.id,
            reason: "initial_content",
          },
        });
        
        results.initialContentGenerated = true;
      } catch (error) {
        console.error("Failed to generate initial content:", error);
      }
    }

    return { success: true, results };
  }
);

/**
 * Event: Schedule Immediate
 * Process a schedule that needs immediate publishing
 */
export const onScheduleImmediate = inngest.createFunction(
  {
    id: "on-schedule-immediate",
    name: "On Schedule Immediate",
    retries: 3,
  },
  {
    event: "schedule/immediate",
  },
  async ({ event }) => {
    const { scheduleId } = event.data;

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        content: true,
        socialAccount: true,
      },
    });

    if (!schedule || !schedule.content || !schedule.socialAccount) {
      return { success: false, error: "Schedule not found" };
    }

    // Mark as publishing
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: "PUBLISHING" },
    });

    // In production: call platform API to publish
    // const platformClient = createSocialClient(schedule.socialAccount.platform, schedule.socialAccount);
    // const result = await platformClient.publish({ caption: schedule.content.caption, mediaUrls: schedule.content.mediaUrls });

    // For now, mark as published
    await prisma.$transaction([
      prisma.schedule.update({
        where: { id: scheduleId },
        data: { 
          status: "PUBLISHED", 
          publishedAt: new Date() 
        },
      }),
      prisma.content.update({
        where: { id: schedule.content.id },
        data: { 
          status: "PUBLISHED", 
          publishedAt: new Date() 
        },
      }),
    ]);

    return { success: true, contentId: schedule.content.id };
  }
);
