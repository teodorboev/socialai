---
name: publisher
description: "Publishing agent: platform API calls, token refresh, retry strategy, rate limits per platform, optimal posting times, platform-specific formatting."
---

# SKILL: Publisher Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` and `skills/social-platform/SKILL.md` first.

---

## Purpose

Takes approved content and publishes it to the correct social platform at the optimal time. Handles scheduling, retry logic, rate limits, token refresh, and publishing confirmation. This agent does NOT generate content — it only executes publishing.

---

## File Location

```
agents/publisher.ts
inngest/functions/publish-scheduled.ts
lib/social/                           ← Platform SDK wrappers (see social-platform skill)
```

---

## Input Interface

```typescript
interface PublisherInput {
  scheduleId: string;
  contentId: string;
  socialAccountId: string;
  platform: Platform;
  content: {
    caption: string;
    hashtags: string[];
    mediaUrls: string[];            // Supabase Storage URLs
    mediaType: MediaType | null;
    contentType: ContentType;
    linkUrl?: string;
    altText?: string;
  };
}
```

---

## Output Schema

```typescript
const PublishResultSchema = z.object({
  published: z.boolean(),
  platformPostId: z.string().optional(),
  platformPostUrl: z.string().url().optional(),
  error: z.string().optional(),
  retryable: z.boolean().default(false),
  confidenceScore: z.literal(1),    // Publisher is deterministic — always 1.0
});
```

---

## Publishing Flow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│ Check token  │ ──▶ │ Download     │ ──▶ │ Format for    │ ──▶ │ Call platform│
│ validity     │     │ media from   │     │ platform      │     │ API          │
│              │     │ Supabase     │     │ (resize, etc) │     │              │
└──────┬───────┘     └──────────────┘     └───────────────┘     └──────┬───────┘
       │                                                                │
       │ expired                                                        │
       ▼                                                                ▼
┌─────────────┐                                                ┌──────────────┐
│ Refresh      │                                                │ Verify post  │
│ OAuth token  │                                                │ published    │
└─────────────┘                                                └──────┬───────┘
                                                                       │
                                                                       ▼
                                                                ┌──────────────┐
                                                                │ Update DB:   │
                                                                │ schedule +   │
                                                                │ content      │
                                                                └──────────────┘
```

---

## Implementation

```typescript
export class PublisherAgent extends BaseAgent {
  constructor() {
    super("PUBLISHER");
  }

  async execute(input: PublisherInput): Promise<AgentResult<PublishResult>> {
    // 1. Get social account and check token
    const account = await prisma.socialAccount.findUniqueOrThrow({
      where: { id: input.socialAccountId },
    });

    // 2. Refresh token if expired
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      const client = createSocialClient(input.platform, account);
      const newTokens = await client.refreshToken(account.refreshToken!);
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(newTokens.accessToken),
          refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : undefined,
          tokenExpiresAt: newTokens.expiresAt,
        },
      });
      account.accessToken = newTokens.accessToken;
    }

    // 3. Download media from Supabase Storage
    const mediaBuffers = await Promise.all(
      input.content.mediaUrls.map(url => downloadFromStorage(url))
    );

    // 4. Format content for platform
    const formatted = formatForPlatform(input.platform, input.content);

    // 5. Publish
    const client = createSocialClient(input.platform, account);
    const result = await client.publish({
      caption: formatted.caption,
      mediaBuffers,
      mediaType: input.content.mediaType,
      contentType: input.content.contentType,
    });

    // 6. Update records
    await prisma.$transaction([
      prisma.schedule.update({
        where: { id: input.scheduleId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      }),
      prisma.content.update({
        where: { id: input.contentId },
        data: {
          status: "PUBLISHED",
          platformPostId: result.platformPostId,
          publishedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      data: { published: true, platformPostId: result.platformPostId, platformPostUrl: result.url },
      confidenceScore: 1, // Deterministic operation
      shouldEscalate: false,
      tokensUsed: 0,      // No LLM calls
    };
  }
}
```

---

## Optimal Posting Times

Default schedule per platform (override with analytics data when available):

| Platform | Best Times (UTC) | Best Days |
|----------|-----------------|-----------|
| Instagram | 11:00, 14:00, 17:00 | Tue, Wed, Fri |
| Facebook | 09:00, 13:00, 16:00 | Wed, Thu, Fri |
| TikTok | 07:00, 12:00, 19:00 | Tue, Thu, Fri |
| Twitter | 08:00, 12:00, 17:00 | Mon, Tue, Wed |
| LinkedIn | 07:30, 12:00, 17:30 | Tue, Wed, Thu |

The Analytics Agent should override these with org-specific optimal times after 2+ weeks of data.

---

## Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoff: [60, 300, 900],  // 1min, 5min, 15min
  retryableCodes: [429, 500, 502, 503, 504],  // Rate limit + server errors
  nonRetryable: [400, 401, 403, 404],          // Bad request, auth, not found
};
```

After 3 failed attempts → set schedule status to FAILED, create escalation with error context.

---

## Platform-Specific Formatting

```typescript
function formatForPlatform(platform: Platform, content: ContentInput) {
  switch (platform) {
    case "INSTAGRAM":
      // Combine caption + hashtags (hashtags at end, separated by line breaks)
      // Truncate to 2200 chars
      // First line must be the hook (before "...more")
      break;
    case "TWITTER":
      // If caption > 280 chars, split into thread
      // First tweet = hook, no hashtags
      // Last tweet = hashtags + CTA
      break;
    case "TIKTOK":
      // Caption ≤ 2200 chars
      // Hashtags inline at end
      break;
    case "LINKEDIN":
      // Caption ≤ 3000 chars
      // Add line breaks for readability
      // Hashtags at end
      break;
    case "FACEBOOK":
      // Caption up to 63,206 chars
      // Keep concise — short posts perform better
      break;
  }
}
```

---

## Rate Limits to Respect

| Platform | Limit | Window |
|----------|-------|--------|
| Instagram | 25 posts/day per account | 24 hours |
| Facebook | 50 posts/day per page | 24 hours |
| TikTok | 15 videos/day per account | 24 hours |
| Twitter | 300 tweets/day per account | 24 hours (but 50/hr practical limit) |
| LinkedIn | 150 posts/day per account | 24 hours |

Implement a per-account rate limiter using Redis/Supabase to track daily counts.

---

## Common Failure Modes

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Token expired, refresh failed | Re-trigger OAuth flow, escalate to user |
| 400 Bad Request | Image wrong format/size for platform | Pre-validate and resize media |
| 429 Rate Limit | Too many posts | Queue with backoff, respect daily limits |
| Post published but DB not updated | Transaction failed | Inngest retry will catch it; idempotency key prevents double-post |
| Media upload timeout | Large video file | Implement chunked upload, increase timeout |
