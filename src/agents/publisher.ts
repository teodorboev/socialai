/**
 * Publisher Agent
 * 
 * Takes approved content and publishes it to the correct social platform.
 * Handles scheduling, retry logic, rate limits, token refresh, and publishing confirmation.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSocialClient } from "@/lib/social/factory";

// Base Agent
import { BaseAgent, type AgentResult } from "./shared/base-agent";

// ============================================================
// INPUT/OUTPUT SCHEMAS
// ============================================================

export const PublisherInputSchema = z.object({
  scheduleId: z.string(),
  contentId: z.string(),
  socialAccountId: z.string(),
  platform: z.string(),
  content: z.object({
    caption: z.string(),
    hashtags: z.array(z.string()),
    mediaUrls: z.array(z.string()),
    mediaType: z.string().optional(),
    contentType: z.string(),
    linkUrl: z.string().optional(),
    altText: z.string().optional(),
  }),
});

export type PublisherInput = z.infer<typeof PublisherInputSchema>;

export const PublishResultSchema = z.object({
  published: z.boolean(),
  platformPostId: z.string().optional(),
  platformPostUrl: z.string().url().optional(),
  error: z.string().optional(),
  retryable: z.boolean().default(false),
  confidenceScore: z.literal(1),
});

export type PublishResult = z.infer<typeof PublishResultSchema>;

// ============================================================
// RETRY CONFIG
// ============================================================

const RETRY_CONFIG = {
  maxRetries: 3,
  backoff: [60, 300, 900],
  retryableCodes: [429, 500, 502, 503, 504],
};

// ============================================================
// OPTIMAL POSTING TIMES
// ============================================================

const DEFAULT_POSTING_TIMES: Record<string, { times: string[]; days: number[] }> = {
  INSTAGRAM: { times: ["11:00", "14:00", "17:00"], days: [2, 3, 5] },
  FACEBOOK: { times: ["09:00", "13:00", "16:00"], days: [3, 4, 5] },
  TIKTOK: { times: ["07:00", "12:00", "19:00"], days: [2, 4, 5] },
  TWITTER: { times: ["08:00", "12:00", "17:00"], days: [1, 2, 3] },
  LINKEDIN: { times: ["07:30", "12:00", "17:30"], days: [2, 3, 4] },
};

export function getOptimalPostingTimes(platform: string) {
  return DEFAULT_POSTING_TIMES[platform] || DEFAULT_POSTING_TIMES.INSTAGRAM;
}

// ============================================================
// PLATFORM FORMATTING
// ============================================================

export function formatForPlatform(platform: string, content: PublisherInput["content"]) {
  const baseCaption = content.caption;
  let caption = baseCaption;
  
  switch (platform) {
    case "TWITTER":
      const hashtags = content.hashtags.slice(0, 3).map(t => `#${t}`).join(" ");
      caption = baseCaption.length + hashtags.length + 1 <= 280 ? `${baseCaption} ${hashtags}`.trim() : baseCaption;
      break;
    case "TIKTOK":
      caption = baseCaption.length > 150 ? baseCaption.slice(0, 147) + "..." : baseCaption;
      break;
  }

  return { caption, hashtags: content.hashtags, linkUrl: content.linkUrl, altText: content.altText };
}

// ============================================================
// MEDIA DOWNLOAD
// ============================================================

async function downloadMedia(mediaUrls: string[]): Promise<Buffer[]> {
  if (!mediaUrls || mediaUrls.length === 0) return [];
  
  return Promise.all(
    mediaUrls.map(async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    })
  );
}

// ============================================================
// PUBLISHER AGENT
// ============================================================

export class PublisherAgent extends BaseAgent {
  constructor() {
    super("PUBLISHER" as any);
  }

  async execute(input: PublisherInput): Promise<AgentResult<PublishResult>> {
    try {
      const account = await prisma.socialAccount.findUnique({
        where: { id: input.socialAccountId },
      });

      if (!account) {
        return {
          success: false,
          data: { published: false, error: "Social account not found", retryable: false, confidenceScore: 1 as const },
          confidenceScore: 1,
          shouldEscalate: true,
          escalationReason: "Social account not found",
          tokensUsed: 0,
        };
      }

      let currentToken = account.accessToken;
      
      // Token refresh check
      if (account.tokenExpiresAt && account.tokenExpiresAt < new Date() && account.refreshToken) {
        try {
          const client = createSocialClient(account.platform as any, { ...account, accessToken: currentToken });
          const newTokens = await client.refreshToken(account.refreshToken);
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken, tokenExpiresAt: newTokens.expiresAt },
          });
          currentToken = newTokens.accessToken;
        } catch {
          return {
            success: false,
            data: { published: false, error: "Token refresh failed", retryable: true, confidenceScore: 1 as const },
            confidenceScore: 1,
            shouldEscalate: true,
            escalationReason: "Token refresh failed",
            tokensUsed: 0,
          };
        }
      }

      // Download media
      let mediaBuffers: Buffer[] = [];
      try {
        mediaBuffers = await downloadMedia(input.content.mediaUrls);
      } catch (e) {
        return {
          success: false,
          data: { published: false, error: `Media download failed: ${e}`, retryable: true, confidenceScore: 1 as const },
          confidenceScore: 1,
          shouldEscalate: false,
          tokensUsed: 0,
        };
      }

      // Format and publish
      const formatted = formatForPlatform(input.platform, input.content);
      const client = createSocialClient(input.platform as any, { ...account, accessToken: currentToken });
      
      let result;
      try {
      result = await client.publish({
        caption: formatted.caption,
        mediaUrls: input.content.mediaUrls,
        mediaType: input.content.mediaType as any,
        contentType: input.content.contentType as any,
        altText: formatted.altText,
        linkUrl: formatted.linkUrl,
      });
      } catch (e) {
        const isRetryable = RETRY_CONFIG.retryableCodes.some(code => String(code).includes(String(e)));
        return {
          success: false,
          data: { published: false, error: String(e), retryable: isRetryable, confidenceScore: 1 as const },
          confidenceScore: 1,
          shouldEscalate: !isRetryable,
          tokensUsed: 0,
        };
      }

      // Update records
      await prisma.$transaction([
        prisma.schedule.update({ where: { id: input.scheduleId }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
        prisma.content.update({ where: { id: input.contentId }, data: { status: "PUBLISHED", platformPostId: result.platformPostId, publishedAt: result.publishedAt } }),
      ]);

      return {
        success: true,
        data: { published: true, platformPostId: result.platformPostId, platformPostUrl: result.url, retryable: false, confidenceScore: 1 as const },
        confidenceScore: 1,
        shouldEscalate: false,
        tokensUsed: 0,
      };

    } catch (error) {
      return {
        success: false,
        data: { published: false, error: String(error), retryable: true, confidenceScore: 1 as const },
        confidenceScore: 1,
        shouldEscalate: true,
        escalationReason: String(error),
        tokensUsed: 0,
      };
    }
  }
}
