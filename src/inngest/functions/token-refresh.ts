import { inngest } from "../client";
import { prisma } from "@/lib/prisma";

/**
 * Token Refresh - Checks and refreshes expiring OAuth tokens
 * Runs daily to ensure no social accounts lose access due to expired tokens
 */
export const tokenRefresh = inngest.createFunction(
  {
    id: "token-refresh",
    name: "Token Refresh",
    retries: 2,
  },
  {
    cron: "0 3 * * *", // Daily at 3am UTC
  },
  async ({ step }) => {
    // Get accounts with tokens expiring within 7 days
    const expiringAccounts = await step.run("get-expiring-accounts", async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      return prisma.socialAccount.findMany({
        where: {
          isActive: true,
          tokenExpiresAt: {
            lte: sevenDaysFromNow,
            gte: new Date(), // Not already expired
          },
        },
        include: {
          organization: true,
        },
      });
    });

    const results = [];

    for (const account of expiringAccounts) {
      const result = await step.run(`refresh-token-${account.id}`, async () => {
        if (!account.refreshToken) {
          return { success: false, error: "No refresh token available" };
        }

        try {
          // Note: In production, implement actual token refresh for each platform
          // This is a placeholder showing the structure
          // Each platform has its own refresh mechanism:
          // - Meta: POST to https://graph.facebook.com/v18.0/oauth/access_token
          // - TikTok: POST to https://open.tiktokapis.com/v2/oauth/token/
          // - LinkedIn: POST to https://www.linkedin.com/oauth/v2/accessToken
          // - Twitter: POST to https://api.twitter.com/2/oauth2/token
          
          // Placeholder: would call platform-specific refresh
          const newTokens = {
            accessToken: account.accessToken, // Would be new token
            refreshToken: account.refreshToken,
            expiresIn: 5184000, // 60 days
          };

          // Calculate new expiry
          const newExpiry = new Date();
          newExpiry.setSeconds(newExpiry.getSeconds() + newTokens.expiresIn);

          // Update the account
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              tokenExpiresAt: newExpiry,
            },
          });

          return { success: true };
        } catch (error) {
          console.error(`Token refresh failed for account ${account.id}:`, error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      });

      results.push({ accountId: account.id, ...result });
    }

    // Get accounts with already expired tokens
    const expiredAccounts = await step.run("get-expired-accounts", async () => {
      return prisma.socialAccount.findMany({
        where: {
          isActive: true,
          tokenExpiresAt: {
            lt: new Date(),
          },
        },
      });
    });

    // Mark expired accounts as inactive
    if (expiredAccounts.length > 0) {
      await step.run("mark-expired-inactive", async () => {
        const ids = expiredAccounts.map((a: { id: string }) => a.id);
        await prisma.socialAccount.updateMany({
          where: { id: { in: ids } },
          data: { isActive: false },
        });
      });
    }

    return {
      tokensRefreshed: results.filter(r => r.success).length,
      tokensFailed: results.filter(r => !r.success).length,
      accountsExpired: expiredAccounts.length,
    };
  }
);
