import type { Platform, ContentType, MediaType } from "@prisma/client";

export interface SocialPlatformClient {
  publish(params: PublishParams): Promise<PublishResult>;
  deletePost(platformPostId: string): Promise<void>;
  getComments(platformPostId: string): Promise<PlatformComment[]>;
  replyToComment(commentId: string, text: string): Promise<string>;
  getDirectMessages(): Promise<PlatformDM[]>;
  getMentions(): Promise<PlatformMention[]>;
  getAccountMetrics(): Promise<AccountMetrics>;
  getPostMetrics(platformPostId: string): Promise<PostMetrics>;
  getProfile(): Promise<PlatformProfile>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
}

export interface PublishParams {
  caption: string;
  mediaUrls?: string[];
  mediaType?: MediaType;
  contentType: ContentType;
  scheduledFor?: Date;
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
  parentCommentId?: string;
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

export interface PlatformProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
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
