import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "SocialAI <noreply@socialai.com>";

export async function sendEscalationEmail(
  toEmail: string,
  escalation: {
    id: string;
    reason: string;
    priority: string;
    createdAt: Date;
  },
  organizationName: string
) {
  if (!resend) {
    console.warn("Resend not configured, skipping email");
    return null;
  }

  const priorityColors: Record<string, string> = {
    LOW: "#22c55e",
    MEDIUM: "#eab308",
    HIGH: "#f97316",
    CRITICAL: "#ef4444",
  };

  return resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `[${escalation.priority}] Action Required: ${organizationName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${priorityColors[escalation.priority]}">Escalation Alert</h1>
        <p>An item requires your attention:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Priority:</strong> ${escalation.priority}</p>
          <p><strong>Reason:</strong> ${escalation.reason}</p>
          <p><strong>Created:</strong> ${escalation.createdAt.toLocaleString()}</p>
        </div>
        <p>Please review this item in your SocialAI dashboard.</p>
        <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL}/mission-control/escalations" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          View Escalations
        </a>
      </div>
    `,
  });
}

export async function sendWeeklyReportEmail(
  toEmail: string,
  report: {
    summary: string;
    totalImpressions: number;
    totalEngagements: number;
    bestPerformingPlatform: string;
  },
  organizationName: string
) {
  if (!resend) {
    console.warn("Resend not configured, skipping email");
    return null;
  }

  return resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `Weekly Report: ${organizationName} - ${new Date().toLocaleDateString()}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Weekly Analytics Report</h1>
        <p>Here's how your social media performed this week:</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0;">
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Impressions</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">${report.totalImpressions.toLocaleString()}</p>
          </div>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Engagements</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">${report.totalEngagements.toLocaleString()}</p>
          </div>
        </div>
        
        <p><strong>Best Platform:</strong> ${report.bestPerformingPlatform}</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        
        <p style="color: #6b7280; font-size: 14px;">
          ${report.summary}
        </p>
        
        <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL}/mission-control/analytics" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Full Analytics
        </a>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(toEmail: string, organizationName: string) {
  if (!resend) {
    console.warn("Resend not configured, skipping email");
    return null;
  }

  return resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Welcome to SocialAI!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Welcome to SocialAI! 🚀</h1>
        <p>Hi there,</p>
        <p>Welcome to <strong>${organizationName}</strong> on SocialAI!</p>
        
        <h2>Here's how to get started:</h2>
        <ol>
          <li><strong>Connect your accounts:</strong> Link your social media accounts in the Accounts page</li>
          <li><strong>Set up your brand:</strong> Tell us about your brand voice and audience</li>
          <li><strong>Let AI do the work:</strong> We'll start creating and scheduling content automatically</li>
        </ol>
        
        <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL}/mission-control/accounts" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Get Started
        </a>
        
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          Need help? Just reply to this email — we're here to support you.
        </p>
      </div>
    `,
  });
}
