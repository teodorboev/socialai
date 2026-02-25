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

export class TwitterClient implements SocialPlatformClient {
  private accessToken: string;
  private baseUrl = "https://api.twitter.com/2";
  private userId: string;

  constructor(accessToken: string, userId: string) {
    this.accessToken = accessToken;
    this.userId = userId;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Twitter API error: ${response.status}`);
    }

    return response.json();
  }

  async publish(params: PublishParams): Promise<PublishResult> {
    const { caption, mediaUrls, linkUrl } = params;

    // Build tweet text
    let tweetText = caption.slice(0, 280);

    // Add link if provided
    if (linkUrl && tweetText.length + linkUrl.length < 280) {
      tweetText += ` ${linkUrl}`;
    }

    const response = await this.fetch<{ data: { id: string; text: string } }>("/tweets", {
      method: "POST",
      body: JSON.stringify({
        text: tweetText,
      }),
    });

    return {
      platformPostId: response.data.id,
      url: `https://twitter.com/i/status/${response.data.id}`,
      publishedAt: new Date(),
    };
  }

  async deletePost(platformPostId: string): Promise<void> {
    await this.fetch(`/tweets/${platformPostId}`, {
      method: "DELETE",
    });
  }

  async getComments(platformPostId: string): Promise<PlatformComment[]> {
    const response = await this.fetch<{ data: any[] }>(
      `/tweets/search/recent?query=conversation_id:${platformPostId}`
    );

    return response.data.map((c) => ({
      id: c.id,
      postId: platformPostId,
      authorId: c.author_id,
      authorName: "",
      authorUsername: "",
      body: c.text,
      createdAt: new Date(c.created_at),
    }));
  }

  async replyToComment(commentId: string, text: string): Promise<string> {
    const response = await this.fetch<{ data: { id: string } }>("/tweets", {
      method: "POST",
      body: JSON.stringify({
        text: text.slice(0, 280),
        reply: { in_reply_to_tweet_id: commentId },
      }),
    });

    return response.data.id;
  }

  async getDirectMessages(): Promise<PlatformDM[]> {
    // Requires additional permissions (DM API)
    return [];
  }

  async getMentions(): Promise<PlatformMention[]> {
    const response = await this.fetch<{ data: any[] }>(`/users/${this.userId}/mentions`);

    return response.data.map((m) => ({
      id: m.id,
      authorId: m.author_id,
      authorName: "",
      authorUsername: m.text.split(" ")[0] || "",
      body: m.text,
      url: `https://twitter.com/i/status/${m.id}`,
      createdAt: new Date(m.created_at),
      type: "post",
    }));
  }

  async getAccountMetrics(): Promise<AccountMetrics> {
    const response = await this.fetch<{ data: any }>(
      `/users/${this.userId}?user.fields=public_metrics`
    );

    const metrics = response.data.public_metrics || {};

    return {
      followers: metrics.followers_count || 0,
      followersChange: 0,
      impressions: 0,
      reach: 0,
      engagementRate: 0,
    };
  }

  async getPostMetrics(platformPostId: string): Promise<PostMetrics> {
    const response = await this.fetch<{ data: any }>(
      `/tweets/${platformPostId}?tweet.fields=public_metrics`
    );

    const metrics = response.data.public_metrics || {};

    return {
      impressions: metrics.impression_count || 0,
      reach: metrics.impression_count || 0,
      likes: metrics.like_count || 0,
      comments: metrics.reply_count || 0,
      shares: metrics.retweet_count || 0,
      saves: 0,
      clicks: metrics.url_link_clicks || 0,
      engagementRate: 0,
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.fetch<{ data: any }>(
      `/users/${this.userId}?user.fields=description,profile_image_url,public_metrics`
    );

    const metrics = response.data.public_metrics || {};

    return {
      id: response.data.id,
      username: response.data.username,
      displayName: response.data.name,
      bio: response.data.description,
      profileImageUrl: response.data.profile_image_url,
      followersCount: metrics.followers_count || 0,
      followingCount: metrics.following_count || 0,
      postsCount: metrics.tweet_count || 0,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Twitter credentials not configured");
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }
}

export function createTwitterClient(accessToken: string, userId: string): SocialPlatformClient {
  return new TwitterClient(accessToken, userId);
}
