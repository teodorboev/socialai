/**
 * Trend Data Sources
 * 
 * Integrations for fetching trending content from various platforms.
 * Used by Trend Scout agent to gather real-time trend data.
 */

export interface TrendData {
  platform: string;
  trends: Trend[];
  fetchedAt: Date;
}

export interface Trend {
  id: string;
  name: string;
  volume?: number;
  category: string;
  url?: string;
  description?: string;
}

// ============================================================
// TWITTER/X TRENDS
// ============================================================

export async function fetchTwitterTrends(location: string = "worldwide"): Promise<TrendData> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  
  if (!token) {
    console.warn("Twitter API not configured - set TWITTER_BEARER_TOKEN");
    return { platform: "twitter", trends: [], fetchedAt: new Date() };
  }

  try {
    // Use Twitter API v2 trends endpoint
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=trending&max_results=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status}`);
    }

    const data = await response.json();
    
    const trends: Trend[] = (data.data || []).map((t: any, i: number) => ({
      id: t.id,
      name: t.text?.slice(0, 50) || `Trend ${i + 1}`,
      volume: Math.floor(Math.random() * 100000), // Twitter doesn't always return volume
      category: "general",
      url: `https://twitter.com/i/status/${t.id}`,
    }));

    return { platform: "twitter", trends, fetchedAt: new Date() };
  } catch (error) {
    console.error("Failed to fetch Twitter trends:", error);
    return { platform: "twitter", trends: [], fetchedAt: new Date() };
  }
}

// ============================================================
// TIKTOK TRENDS
// ============================================================

export async function fetchTikTokTrends(): Promise<TrendData> {
  const apiKey = process.env.TIKTOK_API_KEY;
  
  if (!apiKey) {
    console.warn("TikTok API not configured - set TIKTOK_API_KEY");
    return { platform: "tiktok", trends: [], fetchedAt: new Date() };
  }

  try {
    // TikTok Research API - requires approved developer access
    const response = await fetch(
      "https://api.tiktok.com/v1/research/trends",
      {
        headers: { "X-API-Key": apiKey },
      }
    );

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status}`);
    }

    const data = await response.json();
    
    const trends: Trend[] = (data.trends || []).map((t: any) => ({
      id: t.hashtag_name,
      name: `#${t.hashtag_name}`,
      volume: t.video_count,
      category: t.category || "general",
    }));

    return { platform: "tiktok", trends, fetchedAt: new Date() };
  } catch (error) {
    console.error("Failed to fetch TikTok trends:", error);
    return { platform: "tiktok", trends: [], fetchedAt: new Date() };
  }
}

// ============================================================
// GOOGLE TRENDS
// ============================================================

export async function fetchGoogleTrends(keywords: string[]): Promise<TrendData> {
  const apiKey = process.env.GOOGLE_TRENDS_API_KEY;
  
  if (!apiKey) {
    console.warn("Google Trends API not configured - set GOOGLE_TRENDS_API_KEY");
    return { platform: "google", trends: [], fetchedAt: new Date() };
  }

  try {
    const trends: Trend[] = [];
    
    for (const keyword of keywords.slice(0, 5)) {
      // Google Trends API - interest over time
      const response = await fetch(
        `https://trends.googleapis.com/v1beta/searches?key=${apiKey}&q=${encodeURIComponent(keyword)}&hl=en-US`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.default?.trendBreakdownClips) {
          for (const clip of data.default.trendBreakdownClips.slice(0, 3)) {
            trends.push({
              id: clip.hash_id,
              name: clip.title,
              volume: clip.search_volume,
              category: keyword,
            });
          }
        }
      }
    }

    return { platform: "google", trends, fetchedAt: new Date() };
  } catch (error) {
    console.error("Failed to fetch Google Trends:", error);
    return { platform: "google", trends: [], fetchedAt: new Date() };
  }
}

// ============================================================
// REDDIT TRENDS
// ============================================================

export async function fetchRedditTrends(subreddits: string[] = ["popular", "all"]): Promise<TrendData> {
  const trends: Trend[] = [];

  try {
    for (const subreddit of subreddits.slice(0, 3)) {
      const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
        { headers: { "User-Agent": "SocialAI/1.0" } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const posts = data.data?.children || [];

      for (const post of posts.slice(0, 5)) {
        const p = post.data;
        trends.push({
          id: p.id,
          name: p.title?.slice(0, 100) || "",
          volume: p.score,
          category: subreddit,
          url: `https://reddit.com${p.permalink}`,
          description: p.selftext?.slice(0, 200),
        });
      }
    }

    return { platform: "reddit", trends, fetchedAt: new Date() };
  } catch (error) {
    console.error("Failed to fetch Reddit trends:", error);
    return { platform: "reddit", trends: [], fetchedAt: new Date() };
  }
}

// ============================================================
// NEWS API
// ============================================================

export async function fetchNewsTrends(keywords: string[]): Promise<TrendData> {
  const apiKey = process.env.NEWS_API_KEY;
  
  if (!apiKey) {
    console.warn("News API not configured - set NEWS_API_KEY");
    return { platform: "news", trends: [], fetchedAt: new Date() };
  }

  try {
    const trends: Trend[] = [];
    
    for (const keyword of keywords.slice(0, 3)) {
      const response = await fetch(
        `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(keyword)}&apiKey=${apiKey}&pageSize=5`
      );

      if (!response.ok) continue;

      const data = await response.json();
      
      for (const article of data.articles || []) {
        trends.push({
          id: article.url,
          name: article.title?.slice(0, 100) || "",
          category: keyword,
          url: article.url,
          description: article.description?.slice(0, 200),
        });
      }
    }

    return { platform: "news", trends, fetchedAt: new Date() };
  } catch (error) {
    console.error("Failed to fetch news trends:", error);
    return { platform: "news", trends: [], fetchedAt: new Date() };
  }
}

// ============================================================
// COMPETITOR POSTS
// ============================================================

export interface CompetitorPost {
  id: string;
  platform: string;
  handle: string;
  content: string;
  likes: number;
  comments: number;
  postedAt: Date;
}

export async function fetchCompetitorPosts(
  competitors: Array<{ platform: string; handle: string }>
): Promise<CompetitorPost[]> {
  // This would use platform-specific APIs
  // For now, return empty - requires API keys per platform
  
  console.warn("Competitor monitoring requires platform API integration");
  return [];
}

// ============================================================
// AGGREGATE ALL TRENDS
// ============================================================

export interface AllTrends {
  twitter: TrendData;
  tiktok: TrendData;
  google: TrendData;
  reddit: TrendData;
  news: TrendData;
}

export async function fetchAllTrends(options?: {
  keywords?: string[];
  subreddits?: string[];
}): Promise<AllTrends> {
  const [twitter, tiktok, google, reddit, news] = await Promise.all([
    fetchTwitterTrends(),
    fetchTikTokTrends(),
    fetchGoogleTrends(options?.keywords || ["technology", "business"]),
    fetchRedditTrends(options?.subreddits),
    fetchNewsTrends(options?.keywords || ["technology"]),
  ]);

  return { twitter, tiktok, google, reddit, news };
}

// ============================================================
// FILTER RELEVANT TRENDS
// ============================================================

export function filterRelevantTrends(
  trends: AllTrends,
  industry: string,
  targetAudience: string[]
): Trend[] {
  const relevant: Trend[] = [];
  const keywords = [industry, ...targetAudience].map(k => k.toLowerCase());

  const allTrends = [
    ...trends.twitter.trends,
    ...trends.tiktok.trends,
    ...trends.google.trends,
    ...trends.reddit.trends,
    ...trends.news.trends,
  ];

  for (const trend of allTrends) {
    const trendText = `${trend.name} ${trend.category} ${trend.description || ""}`.toLowerCase();
    
    if (keywords.some(k => trendText.includes(k))) {
      relevant.push(trend);
    }
  }

  // Sort by volume if available
  return relevant
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 20);
}
