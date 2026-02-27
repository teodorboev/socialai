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

export class LinkedInClient implements SocialPlatformClient {
  private accessToken: string;
  private baseUrl = "https://api.linkedin.com/v2";
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
        "X-Restli-Protocol-Version": "2.0.0",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `LinkedIn API error: ${response.status}`);
    }

    return response.json();
  }

  async publish(params: PublishParams): Promise<PublishResult> {
    const { caption, linkUrl, mediaUrls } = params;

    const postData: any = {
      author: `urn:li:person:${this.userId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: caption,
          },
          shareMediaCategory: linkUrl ? "ARTICLE" : mediaUrls?.length ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    if (linkUrl) {
      postData.specificContent["com.linkedin.ugc.ShareContent"].media = [{
        status: "READY",
        originalUrl: linkUrl,
      }];
    }

    if (mediaUrls?.length) {
      // For images, you need to upload first
      postData.specificContent["com.linkedin.ugc.ShareContent"].media = mediaUrls.map((url) => ({
        status: "READY",
        media: url,
      }));
    }

    const response = await this.fetch<{ id: string }>("/ugcPosts", {
      method: "POST",
      body: JSON.stringify(postData),
    });

    return {
      platformPostId: response.id,
      url: `https://www.linkedin.com/feed/update/${response.id}`,
      publishedAt: new Date(),
    };
  }

  async deletePost(platformPostId: string): Promise<void> {
    await this.fetch(`/ugcPosts/${platformPostId}`, {
      method: "DELETE",
    });
  }

  async getComments(platformPostId: string): Promise<PlatformComment[]> {
    const response = await this.fetch<{ elements: any[] }>(
      `/socialActions/${platformPostId}/comments`
    );

    return response.elements?.map((c) => ({
      id: c.id,
      postId: platformPostId,
      authorId: c.actor,
      authorName: "",
      authorUsername: "",
      body: c.message?.text || "",
      createdAt: new Date(c.created?.time || Date.now()),
    })) || [];
  }

  async replyToComment(commentId: string, text: string): Promise<string> {
    const response = await this.fetch<{ id: string }>(`/ugcComments`, {
      method: "POST",
      body: JSON.stringify({
        actor: `urn:li:person:${this.userId}`,
        message: { text },
        parentComment: commentId,
      }),
    });

    return response.id;
  }

  async getDirectMessages(): Promise<PlatformDM[]> {
    // Requires additional permissions
    return [];
  }

  async getMentions(): Promise<PlatformMention[]> {
    return [];
  }

  async getAccountMetrics(): Promise<AccountMetrics> {
    const response = await this.fetch<{ elements: any[] }>(
      "/networkUpdates"
    );

    return {
      followers: 0,
      followersChange: 0,
      impressions: 0,
      reach: 0,
      engagementRate: 0,
    };
  }

  async getPostMetrics(platformPostId: string): Promise<PostMetrics> {
    const response = await this.fetch<{ elements: any[] }>(
      `/socialActions/${platformPostId}`
    );

    const engagement = response.elements?.[0] || {};

    return {
      impressions: 0,
      reach: 0,
      likes: engagement.likesSummary?.totalLikes || 0,
      comments: engagement.commentsSummary?.totalComments || 0,
      shares: 0,
      saves: 0,
      clicks: 0,
      engagementRate: 0,
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.fetch<{ id: string; localizedFirstName: string; localizedLastName: string }>(
      `/people/${this.userId}`
    );

    return {
      id: response.id,
      username: "",
      displayName: `${response.localizedFirstName} ${response.localizedLastName}`,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("LinkedIn credentials not configured");
    }

    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
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
    // LinkedIn API - ugcPosts endpoint
    // Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/ugc/ugcPosts
    try {
      const maxCount = Math.min(params.limit || 30, 50);
      
      // LinkedIn uses the author URN to filter posts
      const authorUrn = `urn:li:person:${this.userId}`;
      
      const response = await fetch(
        `${this.baseUrl}/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=${maxCount}&sortBy=CREATED`,
        {
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("LinkedIn API error:", error);
        return [];
      }

      const data = await response.json();
      
      if (!data.elements) {
        return [];
      }

      return data.elements.map((post: any) => {
        // Extract text content
        let caption = "";
        if (post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text) {
          caption = post.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text;
        }

        // Extract media (images)
        const mediaUrls: string[] = [];
        const media = post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareMediaCategory;
        if (media === "IMAGE" && post.specificContent?.["com.linkedin.ugc.ShareContent"]?.media) {
          for (const m of post.specificContent["com.linkedin.ugc.ShareContent"].media) {
            if (m.media) {
              mediaUrls.push(m.media);
            }
          }
        }

        // Get engagement metrics
        const socialMetadata = post.socialMetadata || {};
        
        return {
          id: post.id,
          caption,
          mediaUrls,
          mediaType: mediaUrls.length > 1 ? "CAROUSEL_IMAGES" : (mediaUrls.length === 1 ? "IMAGE" : undefined),
          postedAt: new Date(post.created?.time || Date.now()),
          likes: socialMetadata.totalLikes || 0,
          comments: socialMetadata.totalComments || 0,
          shares: socialMetadata.totalShares || 0,
          // LinkedIn doesn't provide reach/impressions in the posts API
          reach: undefined,
          impressions: undefined,
        };
      });
    } catch (error) {
      console.error("LinkedIn getRecentPosts error:", error);
      return [];
    }
  }
}

export function createLinkedInClient(accessToken: string, userId: string): SocialPlatformClient {
  return new LinkedInClient(accessToken, userId);
}
