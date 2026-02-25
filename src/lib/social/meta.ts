import type { Platform } from "@prisma/client";
import type {
  SocialPlatformClient,
  PublishParams,
  PublishResult,
  PlatformComment,
  PlatformDM,
  PlatformMention,
  AccountMetrics,
  PostMetrics,
  PlatformProfile,
  TokenPair,
} from "./types";
import { decrypt } from "./token-manager";

export class MetaClient implements SocialPlatformClient {
  private accessToken: string;
  private pageId: string;
  private igUserId?: string;
  private baseUrl = "https://graph.facebook.com/v18.0";

  constructor(accessToken: string, pageId: string, igUserId?: string) {
    this.accessToken = accessToken;
    this.pageId = pageId;
    this.igUserId = igUserId;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Meta API error: ${response.status}`);
    }

    return response.json();
  }

  async publish(params: PublishParams): Promise<PublishResult> {
    const { caption, mediaUrls, contentType, altText, linkUrl } = params;

    // For Instagram, we need to create media container first
    if (this.igUserId) {
      return this.publishToInstagram(params);
    }

    // For Facebook, post directly to feed
    return this.publishToFacebook(params);
  }

  private async publishToInstagram(params: PublishParams): Promise<PublishResult> {
    const { caption, mediaUrls, contentType, altText } = params;
    
    if (!this.igUserId) {
      throw new Error("Instagram user ID required");
    }

    // Create media container
    const mediaContainerId = await this.createInstagramMedia({
      caption,
      mediaUrl: mediaUrls?.[0],
      contentType,
      altText,
    });

    // Publish the container
    const result = await this.fetch<{ id: string }>(`/${this.igUserId}/media_publish`, {
      method: "POST",
      body: JSON.stringify({
        creation_id: mediaContainerId,
        access_token: this.accessToken,
      }),
    });

    // Get the permalink
    const mediaInfo = await this.fetch<{ permalink: string }>(`/${result.id}?fields=permalink`, {
      method: "GET",
    });

    return {
      platformPostId: result.id,
      url: mediaInfo.permalink,
      publishedAt: new Date(),
    };
  }

  private async createInstagramMedia(params: {
    caption: string;
    mediaUrl?: string;
    contentType: string;
    altText?: string;
  }): Promise<string> {
    const { caption, mediaUrl, contentType, altText } = params;

    const mediaData: Record<string, string> = {
      caption: caption.slice(0, 2200),
      access_token: this.accessToken,
    };

    if (mediaUrl) {
      mediaData.image_url = mediaUrl;
      mediaData.media_type = contentType === "VIDEO" ? "VIDEO" : "IMAGE";
    }

    if (altText) {
      mediaData.alt_text = altText;
    }

    const result = await this.fetch<{ id: string }>(`/${this.igUserId}/media`, {
      method: "POST",
      body: JSON.stringify(mediaData),
    });

    return result.id;
  }

  private async publishToFacebook(params: PublishParams): Promise<PublishResult> {
    const { caption, linkUrl } = params;

    const postData: Record<string, string> = {
      message: caption,
      access_token: this.accessToken,
    };

    if (linkUrl) {
      postData.link = linkUrl;
    }

    const result = await this.fetch<{ id: string }>(`/${this.pageId}/feed`, {
      method: "POST",
      body: JSON.stringify(postData),
    });

    // Get the permalink
    const postInfo = await this.fetch<{ permalink_url: string }>(`/${result.id}?fields=permalink_url`, {
      method: "GET",
    });

    return {
      platformPostId: result.id,
      url: postInfo.permalink_url,
      publishedAt: new Date(),
    };
  }

  async deletePost(platformPostId: string): Promise<void> {
    await this.fetch(`/${platformPostId}`, {
      method: "DELETE",
    });
  }

  async getComments(platformPostId: string): Promise<PlatformComment[]> {
    const result = await this.fetch<{ data: any[] }>(
      `/${platformPostId}/comments?access_token=${this.accessToken}`
    );

    return result.data.map((c) => ({
      id: c.id,
      postId: platformPostId,
      authorId: c.from?.id || "",
      authorName: c.from?.name || "",
      authorUsername: c.from?.id || "",
      body: c.message,
      createdAt: new Date(c.created_time),
      likeCount: c.like_count,
    }));
  }

  async replyToComment(commentId: string, text: string): Promise<string> {
    const result = await this.fetch<{ id: string }>(`/${commentId}/replies`, {
      method: "POST",
      body: JSON.stringify({
        message: text,
        access_token: this.accessToken,
      }),
    });

    return result.id;
  }

  async getDirectMessages(): Promise<PlatformDM[]> {
    // Note: Requires proper permissions for Instagram Messaging API
    return [];
  }

  async getMentions(): Promise<PlatformMention[]> {
    if (!this.igUserId) return [];
    
    const result = await this.fetch<{ data: any[] }>(
      `/${this.igUserId}/tags?access_token=${this.accessToken}`
    );

    return result.data.map((m) => ({
      id: m.id,
      authorId: m.from?.id || "",
      authorName: m.from?.name || "",
      authorUsername: m.from?.id || "",
      body: m.caption || "",
      url: m.permalink || "",
      createdAt: new Date(m.timestamp),
      type: "post" as const,
    }));
  }

  async getAccountMetrics(): Promise<AccountMetrics> {
    const fields = "followers_count,follows_count,media_count";
    const result = await this.fetch<any>(`/${this.igUserId}?fields=${fields}&access_token=${this.accessToken}`);

    return {
      followers: result.followers_count || 0,
      followersChange: 0,
      impressions: 0,
      reach: 0,
      engagementRate: 0,
    };
  }

  async getPostMetrics(platformPostId: string): Promise<PostMetrics> {
    const fields = "impressions,reach,likes,comments,shares,saves";
    const result = await this.fetch<any>(
      `/${platformPostId}?fields=${fields}&access_token=${this.accessToken}`
    );

    return {
      impressions: result.impressions || 0,
      reach: result.reach || 0,
      likes: result.likes || 0,
      comments: result.comments || 0,
      shares: result.shares || 0,
      saves: result.saves || 0,
      clicks: 0,
      engagementRate: 0,
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const fields = "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count";
    const result = await this.fetch<any>(`/${this.igUserId}?fields=${fields}&access_token=${this.accessToken}`);

    return {
      id: result.id,
      username: result.username,
      displayName: result.name,
      bio: result.biography,
      profileImageUrl: result.profile_picture_url,
      followersCount: result.followers_count || 0,
      followingCount: result.follows_count || 0,
      postsCount: result.media_count || 0,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error("Meta app credentials not configured");
    }

    const result = await this.fetch<{
      access_token: string;
      expires_in: number;
    }>(`/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${refreshToken}`);

    return {
      accessToken: result.access_token,
      expiresAt: new Date(Date.now() + result.expires_in * 1000),
    };
  }
}

export function createMetaClient(
  accessToken: string,
  pageId: string,
  igUserId?: string
): SocialPlatformClient {
  return new MetaClient(accessToken, pageId, igUserId);
}
