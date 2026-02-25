/**
 * Billing - Inngest Functions
 * 
 * Handles billing-related event-driven workflows:
 * - Dunning sequence (payment failed recovery)
 * - Subscription canceled handling
 * - Payment past due handling
 * - Trial ending handling
 */

import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";

// ============================================================
// PAYMENT FAILED - DUNNING SEQUENCE
// ============================================================

/**
 * Handle payment failure with 3-step dunning sequence:
 * - Step 1: Soft notification (Day 0)
 * - Step 2: Firm warning (Day 3-5)
 * - Step 3: Final warning + service degradation (Day 7-10)
 */
export const handlePaymentFailed = inngest.createFunction(
  {
    id: "billing-payment-failed",
    name: "Billing: Payment Failed",
    retries: 3,
  },
  { event: "billing/payment-failed" },
  async ({ event, step }) => {
    const { organizationId, failCount, dunningStep } = event.data;

    console.log(`Payment failed for org ${organizationId}: attempt ${failCount}, step ${dunningStep}`);

    switch (dunningStep) {
      case 1:
        // Step 1: Soft notification - first failure
        await step.run("dunning-step-1", async () => {
          // Create attention item
          await prisma.attentionItem.create({
            data: {
              organizationId,
              type: "WARNING",
              title: "Payment failed - please update your card",
              description: "We couldn't process your payment. Update your payment method to keep your AI running.",
              priority: "HIGH",
            },
          });

          // Log activity
          await prisma.activityLog.create({
            data: {
              organizationId,
              type: "SYSTEM_ALERT",
              action: "billing",
              description: "Payment failed - please update your payment method",
            },
          });

          // TODO: Send email notification
          console.log(`Dunning step 1: Soft notification for org ${organizationId}`);
        });
        break;

      case 2:
        // Step 2: Firm warning - second failure
        await step.run("dunning-step-2", async () => {
          // Update attention item
          const existingItem = await prisma.attentionItem.findFirst({
            where: { organizationId, type: "WARNING", status: "OPEN" },
          });

          if (existingItem) {
            await prisma.attentionItem.update({
              where: { id: existingItem.id },
              data: {
                title: "Payment failed - second attempt",
                description: "This is your second failed payment attempt. Please update your payment method to avoid service interruption.",
                priority: "HIGH",
              },
            });
          } else {
            await prisma.attentionItem.create({
              data: {
                organizationId,
                type: "WARNING",
                title: "Payment failed - second attempt",
                description: "This is your second failed payment attempt. Please update your payment method to avoid service interruption.",
                priority: "HIGH",
              },
            });
          }

          // Log activity
          await prisma.activityLog.create({
            data: {
              organizationId,
              type: "SYSTEM_ALERT",
              action: "billing",
              description: "Second payment failed - service will pause in 7 days if not resolved",
            },
          });

          // TODO: Send urgent email
          console.log(`Dunning step 2: Firm warning for org ${organizationId}`);
        });
        break;

      case 3:
        // Step 3: Final warning + downgrade to core only
        await step.run("dunning-step-3", async () => {
          // Mark subscription as past_due
          await prisma.subscription.update({
            where: { organizationId },
            data: { status: "past_due" },
          });

          // Create critical attention item
          await prisma.attentionItem.create({
            data: {
              organizationId,
              type: "ERROR",
              title: "URGENT: Service about to pause",
              description: "Payment has failed 3 times. Your AI service will be paused. Update your payment method now to avoid interruption.",
              priority: "URGENT",
            },
          });

          // Log activity
          await prisma.activityLog.create({
            data: {
              organizationId,
              type: "SYSTEM_ALERT",
              action: "billing",
              description: "Service degraded - only core agents active until payment resolved",
            },
          });

          // Trigger churn prediction
          await inngest.send({
            name: "churn/prediction-triggered",
            data: {
              organizationId,
              reason: "payment_failed_3_times",
            },
          });

          console.log(`Dunning step 3: Service degraded for org ${organizationId}`);
        });
        break;
    }

    return { processed: true, dunningStep };
  }
);

// ============================================================
// SUBSCRIPTION CANCELED
// ============================================================

/**
 * Handle subscription cancellation - pause all operations
 */
export const handleSubscriptionCanceled = inngest.createFunction(
  {
    id: "billing-subscription-canceled",
    name: "Billing: Subscription Canceled",
    retries: 2,
  },
  { event: "billing/subscription-canceled" },
  async ({ event, step }) => {
    const { organizationId, reason } = event.data;

    console.log(`Subscription canceled for org ${organizationId}: ${reason}`);

    // Pause operations are handled by the orchestrator which checks subscription status
    // Log the cancellation
    await step.run("log-cancellation", async () => {
      // Create attention item
      await prisma.attentionItem.create({
        data: {
          organizationId,
          type: "SYSTEM_ALERT",
          title: "Subscription canceled",
          description: reason 
            ? `Your subscription has been canceled. Reason: ${reason}`
            : "Your subscription has been canceled. Contact support to reactivate.",
          priority: "HIGH",
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          organizationId,
          type: "SYSTEM_ALERT",
          action: "billing",
          description: `Subscription canceled - all AI operations paused. Reason: ${reason ?? "not provided"}`,
        },
      });

      // Store in memory for churn analysis
      try {
        await prisma.memory.create({
          data: {
            organizationId,
            content: `Client canceled subscription. Reason: ${reason ?? "not provided"}`,
            memoryType: "strategy_decision",
            agentSource: "BILLING",
            importance: 1.0,
          },
        });
      } catch (e) {
        // Memory table might not exist yet
        console.log("Memory table not available for churn logging");
      }
    });

    // Trigger churn prediction for analysis
    await step.run("trigger-churn-prediction", async () => {
      await inngest.send({
        name: "churn/prediction-triggered",
        data: {
          organizationId,
          reason: "subscription_canceled",
        },
      });
    });

    return { processed: true };
  }
);

// ============================================================
// PAYMENT PAST DUE
// ============================================================

/**
 * Handle subscription going past due - downgrade to core agents only
 */
export const handlePaymentPastDue = inngest.createFunction(
  {
    id: "billing-payment-past-due",
    name: "Billing: Payment Past Due",
    retries: 2,
  },
  { event: "billing/payment-past-due" },
  async ({ event, step }) => {
    const { organizationId } = event.data;

    console.log(`Payment past due for org ${organizationId}`);

    await step.run("handle-past-due", async () => {
      // Update subscription status
      await prisma.subscription.update({
        where: { organizationId },
        data: { status: "past_due" },
      });

      // Create attention item
      await prisma.attentionItem.create({
        data: {
          organizationId,
          type: "ERROR",
          title: "Payment past due - service affected",
          description: "Your payment is past due. Your AI has been downgraded to core features only. Update your payment method to restore full service.",
          priority: "URGENT",
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          organizationId,
          type: "SYSTEM_ALERT",
          action: "billing",
          description: "Payment past due - service degraded to core only",
        },
      });
    });

    return { processed: true };
  }
);

// ============================================================
// TRIAL ENDING
// ============================================================

/**
 * Handle trial ending - send reminder
 */
export const handleTrialEnding = inngest.createFunction(
  {
    id: "billing-trial-ending",
    name: "Billing: Trial Ending",
    retries: 2,
  },
  { event: "billing/trial-ending" },
  async ({ event, step }) => {
    const { organizationId, trialEndDate } = event.data;

    console.log(`Trial ending for org ${organizationId}`);

    await step.run("handle-trial-ending", async () => {
      // Update attention item if exists, or create new
      const existingItem = await prisma.attentionItem.findFirst({
        where: { 
          organizationId, 
          type: "SYSTEM_ALERT",
          title: { contains: "trial ends" },
          status: "OPEN",
        },
      });

      if (existingItem) {
        await prisma.attentionItem.update({
          where: { id: existingItem.id },
          data: {
            priority: "URGENT",
          },
        });
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          organizationId,
          type: "SYSTEM_ALERT",
          action: "billing",
          description: `Trial ending soon. End date: ${trialEndDate?.toISOString() ?? "unknown"}`,
        },
      });
    });

    return { processed: true };
  }
);

// ============================================================
// SUBSCRIPTION ACTIVATED
// ============================================================

/**
 * Handle subscription being activated (after checkout or payment recovery)
 */
export const handleSubscriptionActivated = inngest.createFunction(
  {
    id: "billing-subscription-activated",
    name: "Billing: Subscription Activated",
    retries: 2,
  },
  { event: "billing/subscription-activated" },
  async ({ event, step }) => {
    const { organizationId, planSlug } = event.data;

    console.log(`Subscription activated for org ${organizationId}: ${planSlug}`);

    await step.run("handle-activation", async () => {
      // Log activity
      await prisma.activityLog.create({
        data: {
          organizationId,
          type: "SYSTEM_ALERT",
          action: "billing",
          description: `Subscription activated: ${planSlug}`,
        },
      });

      // Clear any billing-related attention items
      await prisma.attentionItem.updateMany({
        where: {
          organizationId,
          type: { in: ["ERROR", "WARNING", "SYSTEM_ALERT"] },
          title: { contains: "payment" },
          status: "OPEN",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
    });

    // Trigger onboarding pipeline if newly activated
    if (planSlug) {
      await step.run("trigger-onboarding", async () => {
        await inngest.send({
          name: "onboarding/start",
          data: { organizationId },
        });
      });
    }

    return { processed: true };
  }
);

// ============================================================
// SUBSCRIPTION RESUMED
// ============================================================

/**
 * Handle subscription being resumed after pause
 */
export const handleSubscriptionResumed = inngest.createFunction(
  {
    id: "billing-subscription-resumed",
    name: "Billing: Subscription Resumed",
    retries: 2,
  },
  { event: "billing/subscription-resumed" },
  async ({ event, step }) => {
    const { organizationId } = event.data;

    console.log(`Subscription resumed for org ${organizationId}`);

    await step.run("handle-resume", async () => {
      // Log activity
      await prisma.activityLog.create({
        data: {
          organizationId,
          type: "SYSTEM_ALERT",
          action: "billing",
          description: "Subscription resumed - full service restored",
        },
      });
    });

    return { processed: true };
  }
);

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export const billingFunctions = [
  handlePaymentFailed,
  handleSubscriptionCanceled,
  handlePaymentPastDue,
  handleTrialEnding,
  handleSubscriptionActivated,
  handleSubscriptionResumed,
];
