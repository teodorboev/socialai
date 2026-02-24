---
name: social-platform
description: "Platform API abstraction: SocialPlatformClient interface, OAuth flow, API reference for Meta/TikTok/X/LinkedIn, token encryption, rate limits."
---

# SKILL: Social Platform Integration

> This skill covers the abstraction layer for all social media platform APIs. Read this before implementing any platform-specific code.

---

## Purpose

Provides a unified interface for interacting with Instagram, Facebook, TikTok, X (Twitter), and LinkedIn. Every platform interaction goes through this abstraction — publishing, fetching comments, pulling analytics, refreshing tokens. Adding a new platform should only require implementing the interface.

---

## File Location

```
lib/social/
├── types.ts              ← Shared interfaces and types
├── factory.ts            ← Platform client factory
├── meta.ts               ← Instagram + Facebook (shared Meta Graph API)
├── tiktok.ts             ← TikTok
├── twitter.ts            ← X / Twitter
├── linkedin.ts           ← LinkedIn
└── token-manager.ts      ← OAuth token refresh/encryption utilities
```

---

## Core Interface

```typescript
// lib/social/types.ts

export interface SocialPlatformClient {
  // Publishing
  publish(params: PublishParams): Promise<PublishResult>;
  deletePost(platformPostId: string): Promise<void>;

  // Engagement
  getComments(platformPostId: string, since?: Date): Promise<PlatformComment[]>;
  replyToComment(commentId: string, text: string): Promise<string>; // Returns reply ID
  getDirectMessages(since?: Date): Promise<PlatformDM[]>;
  sendDirectMessage(recipientId: string, text: string): Promise<string>;
  getMentions(since?: Date): Promise<PlatformMention[]>;

  // Analytics
  getAccountMetrics(dateRange: DateRange): Promise<AccountMetrics>;
  getPostMetrics(platformPostId: string): Promise<PostMetrics>;

  // Account
  getProfile(): Promise<PlatformProfile>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
}

export interface PublishParams {
  caption: string;
  mediaBuffers?: Buffer[];
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL";
  contentType: ContentType;
  scheduledFor?: Date;          // Platform-native scheduling (if supported)
  altText?: string;
  linkUrl?: string;
}

export interface PublishResult {
  platformPostId: string;
  url: string;
  publishedAt: Date;
}

export interface PlatformComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  body: string;
  createdAt: Date;
  parentCommentId?: string;     // For threaded replies
  likeCount?: number;
}

export interface PlatformDM {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  body: string;
  createdAt: Date;
  isFromBrand: boolean;
}

export interface PlatformMention {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  body: string;
  url: string;
  createdAt: Date;
  type: "post" | "comment" | "story";
}

export interface AccountMetrics {
  followers: number;
  followersChange: number;
  impressions: number;
  reach: number;
  engagementRate: number;
  profileViews?: number;
  websiteClicks?: number;
}

export interface PostMetrics {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  videoViews?: number;
  engagementRate: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}
```

---

## Factory

```typescript
// lib/social/factory.ts
import { Platform } from "@prisma/client";
import { MetaClient } from "./meta";
import { TikTokClient } from "./tiktok";
import { TwitterClient } from "./twitter";
import { LinkedInClient } from "./linkedin";
import { decrypt } from "./token-manager";

export function createSocialClient(
  platform: Platform,
  account: { accessToken: string; platformUserId: string; metadata?: any }
): SocialPlatformClient {
  const token = decrypt(account.accessToken);

  switch (platform) {
    case "INSTAGRAM":
      return new MetaClient(token, account.platformUserId, "instagram");
    case "FACEBOOK":
      return new MetaClient(token, account.platformUserId, "facebook");
    case "TIKTOK":
      return new TikTokClient(token, account.platformUserId);
    case "TWITTER":
      return new TwitterClient(token, account.platformUserId);
    case "LINKEDIN":
      return new LinkedInClient(token, account.platformUserId);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

---

## Platform API Quick Reference

### Meta (Instagram + Facebook)

| Action | Endpoint | Notes |
|--------|----------|-------|
| Publish image (IG) | `POST /{ig-user-id}/media` → `POST /{ig-user-id}/media_publish` | Two-step: create container, then publish |
| Publish carousel (IG) | Create items → create carousel container → publish | Each item is a separate media container |
| Publish (FB) | `POST /{page-id}/feed` or `POST /{page-id}/photos` | Single step |
| Get comments | `GET /{media-id}/comments` | Paginated |
| Reply to comment | `POST /{comment-id}/replies` | |
| Get insights (IG) | `GET /{ig-user-id}/insights` | Requires `instagram_manage_insights` scope |
| Get page insights (FB) | `GET /{page-id}/insights` | Requires `pages_read_engagement` scope |
| Refresh token | Long-lived tokens: `GET /oauth/access_token?grant_type=fb_exchange_token` | IG tokens via Facebook |

**OAuth scopes needed**: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_metadata`

### TikTok

| Action | Endpoint | Notes |
|--------|----------|-------|
| Upload video | `POST /v2/post/publish/video/init/` | Chunk upload for large files |
| Publish | `POST /v2/post/publish/status/fetch/` | Check upload status |
| Get comments | `GET /v2/comment/list/` | |
| Reply | `POST /v2/comment/reply/` | |
| Get user info | `GET /v2/user/info/` | Follower count, etc |

**OAuth scopes**: `user.info.basic`, `video.publish`, `video.list`, `comment.list`, `comment.list.manage`

### X / Twitter (API v2)

| Action | Endpoint | Notes |
|--------|----------|-------|
| Post tweet | `POST /2/tweets` | |
| Post thread | Multiple `POST /2/tweets` with `reply.in_reply_to_tweet_id` | |
| Upload media | `POST /1.1/media/upload.json` (v1.1 still needed) | Upload first, attach to tweet |
| Get mentions | `GET /2/users/{id}/mentions` | |
| Reply | `POST /2/tweets` with `reply` field | |
| Get metrics | `GET /2/tweets/{id}` with `tweet.fields=public_metrics` | |

**Tier needed**: Basic ($100/mo) for posting + reading, Pro ($5000/mo) for full analytics. Start with Basic.

### LinkedIn

| Action | Endpoint | Notes |
|--------|----------|-------|
| Share post | `POST /rest/posts` | V2 API |
| Upload image | `POST /rest/images?action=initializeUpload` → upload binary | |
| Get comments | `GET /rest/socialActions/{postUrn}/comments` | |
| Reply | `POST /rest/socialActions/{postUrn}/comments` | |
| Get analytics | `GET /rest/organizationalEntityShareStatistics` | Requires org admin access |

**OAuth scopes**: `w_member_social`, `r_organization_social`, `w_organization_social`, `r_organization_admin`

---

## Token Encryption

```typescript
// lib/social/token-manager.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, tagHex, content] = encrypted.split(":");
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(content, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

Generate the key: `openssl rand -hex 32` → store as `TOKEN_ENCRYPTION_KEY` in .env

---

## OAuth Flow (Shared Pattern)

```
1. User clicks "Connect Instagram" in dashboard
2. Redirect to: /api/social/meta/authorize
   → Builds OAuth URL with scopes
   → Redirects user to Meta login
3. Meta redirects back to: /api/social/meta/callback
   → Exchange code for token
   → Encrypt token
   → Store in social_accounts table
   → Redirect to dashboard with success message
4. Inngest event: "account/connected" fires
   → Orchestrator triggers historical analysis
```

All OAuth callbacks follow this pattern. Platform-specific differences are in the authorize URL and token exchange endpoint.

---

## Rate Limit Handling

Every platform client must implement rate limit awareness:

```typescript
abstract class BasePlatformClient {
  protected async rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") || "60", 10);
      // Log the rate limit hit
      // Throw a retryable error that Inngest will catch and retry
      throw new RetryableError(`Rate limited. Retry after ${retryAfter}s`, retryAfter);
    }

    return response;
  }
}
```

---

## Adding a New Platform — Checklist

1. [ ] Create `lib/social/<platform>.ts` implementing `SocialPlatformClient`
2. [ ] Add platform to `Platform` enum in Prisma schema, run migration
3. [ ] Add OAuth routes: `/api/social/<platform>/authorize` + `/callback`
4. [ ] Add to factory in `lib/social/factory.ts`
5. [ ] Add platform guidelines to Content Creator prompt (`getPlatformGuidelines`)
6. [ ] Add platform dimensions to Visual Agent (`getPlatformDimensions`)
7. [ ] Add to Publisher Agent formatting (`formatForPlatform`)
8. [ ] Update Analytics Agent metrics mapping
9. [ ] Test end-to-end: connect → generate content → publish → fetch metrics
