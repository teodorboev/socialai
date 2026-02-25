import type { Platform, SocialAccount } from "@prisma/client";
import type { SocialPlatformClient } from "./types";
import { MetaClient } from "./meta";
import { TikTokClient } from "./tiktok";
import { TwitterClient } from "./twitter";
import { LinkedInClient } from "./linkedin";
import { decrypt } from "./token-manager";

export function createSocialClient(
  platform: Platform,
  account: SocialAccount
): SocialPlatformClient {
  const token = decrypt(account.accessToken);

  switch (platform) {
    case "INSTAGRAM":
    case "FACEBOOK": {
      const metadata = account.metadata as Record<string, string> | null;
      const pageId = account.platformUserId;
      const igUserId = metadata?.igUserId;
      return new MetaClient(token, pageId, igUserId);
    }
    case "TIKTOK": {
      const metadata = account.metadata as Record<string, string> | null;
      const openId = metadata?.openId || account.platformUserId;
      return new TikTokClient(token, openId);
    }
    case "TWITTER": {
      return new TwitterClient(token, account.platformUserId);
    }
    case "LINKEDIN": {
      return new LinkedInClient(token, account.platformUserId);
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
