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
  GetRecentPostsParams,
  RecentPost,
} from "./types";
import { decrypt } from "./token-manager";

export class TikTokClient implements SocialPlatformClient {
  private accessToken: string;
  private baseUrl = "https://open.tiktokapis.com/v2";
  private openId: string;

  constructor(accessToken: string, openId: string) {
    this.accessToken = accessToken;
    this.openId = openId;
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
      throw new Error(error.error?.message || `TikTok API error: ${response.status}`);
    }

    return response.json();
  }

  async publish(params: PublishParams): Promise<PublishResult> {
    const { caption, mediaUrls } = params;

    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error("TikTok requires a video for publishing");
    }

    // Initialize upload
    const initResponse = await this.fetch<{ data: { upload_url: string; upload_id: string } }>(
      "/post/publish/video/init/",
      {
        method: "POST",
        body: JSON.stringify({
          upload_url: mediaUrls[0],
          caption,
        }),
      }
    );

    // Note: In a real implementation, you'd upload the video to the upload_url
    // For now, return a placeholder result
    return {
      platformPostId: initResponse.data.upload_id,
      url: `https://www.tiktok.com/@user/video/${initResponse.data.upload_id}`,
      publishedAt: new Date(),
    };
  }

  async deletePost(platformPostId: string): Promise<void> {
    // TikTok API doesn't support post deletion
    throw new Error("TikTok does not support post deletion via API");
  }

  async getComments(platformPostId: string): Promise<PlatformComment[]> {
    const response = await this.fetch<{ data: { comments: any[] } }>(
      `/comment/list/?post_id=${platformPostId}`
    );

    return response.data.comments.map((c) => ({
      id: c.comment_id,
      postId: platformPostId,
      authorId: c.user.open_id,
      authorName: c.user.display_name,
      authorUsername: c.user.unique_id,
      body: c.text,
      createdAt: new Date(c.create_time * 1000),
      likeCount: c.like_count,
    }));
  }

  async replyToComment(commentId: string, text: string): Promise<string> {
    const response = await this.fetch<{ data: { comment_id: string } }>("/comment/reply/", {
      method: "POST",
      body: JSON.stringify({
        comment_id: commentId,
        text,
      }),
    });

    return response.data.comment_id;
  }

  async getDirectMessages(): Promise<PlatformDM[]> {
    // Requires additional permissions
    return [];
  }

  async getMentions(): Promise<PlatformMention[]> {
    // Requires additional permissions
    return [];
  }

  async getAccountMetrics(): Promise<AccountMetrics> {
    const response = await this.fetch<{ data: any }>("/user/info/?fields=follower_count,following_count,likes_count");

    return {
      followers: response.data.follower_count || 0,
      followersChange: 0,
      impressions: 0,
      reach: 0,
      engagementRate: 0,
    };
  }

  async getPostMetrics(platformPostId: string): Promise<PostMetrics> {
    const response = await this.fetch<{ data: any }>(
      `/video/list/?fields=video_id,like_count,comment_count,share_count,view_count`
    );

    const video = response.data.videos?.[0] || {};

    return {
      impressions: video.view_count || 0,
      reach: video.view_count || 0,
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      saves: 0,
      clicks: 0,
      videoViews: video.view_count,
      engagementRate: 0,
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.fetch<{ data: any }>("/user/info/?fields=open_id,display_name,avatar_url,bio");

    return {
      id: response.data.open_id,
      username: response.data.unique_id || "",
      displayName: response.data.display_name,
      bio: response.data.bio,
      profileImageUrl: response.data.avatar_url,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      throw new Error("TikTok credentials not configured");
    }

    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_key: clientKey,
        client_secret: clientSecret,
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

  async getRecentPosts(params: GetRecentPostsParams): Promise<RecentPost[]> {
    // TikTok V2 API - video list endpoint
    // Docs: https://developers.tiktok.com/doc/video-list-api
    try {
      const maxCount = Math.min(params.limit || 30, 100);
      const fields = "id,caption,create_time,share_url,cover_image_url,like_count,comment_count,share_count";
      
      const response = await fetch(
        `${this.baseUrl}/v2/video/list/?open_id=${this.openId}&max_count=${maxCount}&fields=${fields}`,
        {
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("TikTok API error:", error);
        return [];
      }

      const data = await response.json();
      
      if (!data.data?.videos) {
        return [];
      }

      return data.data.videos.map((video: any) => ({
        id: video.id,
        caption: video.caption || "",
        mediaUrls: [video.cover_image_url || ""].filter(Boolean),
        mediaType: "VIDEO",
        postedAt: new Date(video.create_time * 1000),
        likes: video.like_count,
        comments: video.comment_count,
        shares: video.share_count,
        reach: video.share_count * 10, // Estimate reach as share * 10
        impressions: video.view_count || video.share_count * 15,
      }));
    } catch (error) {
      console.error("TikTok getRecentPosts error:", error);
      return [];
    }
  }
}

export function createTikTokClient(accessToken: string, openId: string): SocialPlatformClient {
  return new TikTokClient(accessToken, openId);
}
