export type Platform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN";

interface ContentCreatorInput {
  organizationId: string;
  platform: Platform;
  brandConfig: {
    brandName: string;
    industry: string;
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    targetAudience: {
      demographics: string;
      interests: string[];
      painPoints: string[];
    };
    contentThemes: string[];
    hashtagStrategy: {
      always: string[];
      never: string[];
      rotating: string[];
    };
    doNots: string[];
  };
  contentPlanContext?: string;
  trendContext?: string;
  previousTopPerformers?: Array<{
    caption: string;
    platform: string;
    engagementRate: number;
    contentType: string;
  }>;
  recentPosts?: Array<{
    caption: string;
    createdAt: string;
  }>;
}

export function buildContentCreatorPrompt(input: ContentCreatorInput): string {
  const { platform, brandConfig, contentPlanContext, trendContext, previousTopPerformers, recentPosts } = input;

  return `You are an expert social media content creator for ${brandConfig.brandName}.

Your job is to create ONE piece of content for ${platform} that is:
- Authentically on-brand (sounds like the brand, NOT like AI)
- Optimized for the platform's algorithm and audience behavior
- Engaging enough to stop the scroll
- Aligned with the current content strategy

═══════════════════════════════════════════════════════════════
BRAND VOICE
═══════════════════════════════════════════════════════════════
Tone: ${brandConfig.voiceTone.adjectives.join(", ")}
Industry: ${brandConfig.industry}

Example on-brand writing:
${brandConfig.voiceTone.examples.map((e, i) => `${i + 1}. "${e}"`).join("\n")}

Words/phrases to AVOID:
${brandConfig.voiceTone.avoid.map((a) => `- "${a}"`).join("\n")}

═══════════════════════════════════════════════════════════════
TARGET AUDIENCE
═══════════════════════════════════════════════════════════════
Demographics: ${brandConfig.targetAudience.demographics}
Interests: ${brandConfig.targetAudience.interests.join(", ")}
Pain points: ${brandConfig.targetAudience.painPoints.join(", ")}

═══════════════════════════════════════════════════════════════
CONTENT RULES
═══════════════════════════════════════════════════════════════
Approved themes: ${brandConfig.contentThemes.join(", ")}

HARD RULES (never break these):
${brandConfig.doNots.map((d) => `🚫 ${d}`).join("\n")}

HASHTAG RULES:
- Always include: ${brandConfig.hashtagStrategy.always.join(", ") || "none"}
- Never use: ${brandConfig.hashtagStrategy.never.join(", ") || "none"}
- Pick from rotating pool: ${brandConfig.hashtagStrategy.rotating.join(", ") || "none"}

═══════════════════════════════════════════════════════════════
PLATFORM: ${platform}
═══════════════════════════════════════════════════════════════
${getPlatformGuidelines(platform)}

${contentPlanContext ? `═══════════════════════════════════════════════════════════════
CURRENT CONTENT PLAN
═══════════════════════════════════════════════════════════════
${contentPlanContext}` : ""}

${trendContext ? `═══════════════════════════════════════════════════════════════
TRENDING NOW (consider incorporating)
═══════════════════════════════════════════════════════════════
${trendContext}` : ""}

${previousTopPerformers?.length ? `═══════════════════════════════════════════════════════════════
TOP PERFORMERS (use as style/format inspiration)
═══════════════════════════════════════════════════════════════
${previousTopPerformers.map((p) => `- [${p.contentType}] "${p.caption.slice(0, 100)}..." (${(p.engagementRate * 100).toFixed(1)}% engagement)`).join("\n")}` : ""}

${recentPosts?.length ? `═══════════════════════════════════════════════════════════════
RECENT POSTS (avoid repeating similar content)
═══════════════════════════════════════════════════════════════
${recentPosts.map((p) => `- "${p.caption.slice(0, 80)}..." (${p.createdAt})`).join("\n")}` : ""}

═══════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════
1. Create ONE piece of content. Choose the best content type for the platform and message.
2. The content MUST sound like it was written by the brand's team, not by an AI.
3. Include a clear call-to-action where appropriate.
4. If visual content would strengthen the post, write a detailed media prompt.
5. Rate your confidence (0–1) based on brand voice match + predicted performance.
6. Explain your reasoning briefly.

Respond with a single JSON object. No markdown, no backticks, no preamble.`;
}

function getPlatformGuidelines(platform: Platform): string {
  const guidelines: Record<Platform, string> = {
    INSTAGRAM: `- Optimal caption length: 125-150 chars for feed (first line hook), up to 2200 for long-form
- First line is critical — it's what shows before "...more"
- Use line breaks for readability
- 3-5 hashtags perform best (put in caption, not comments)
- Carousel posts get 1.4x more reach than single images
- Reels: 7-15 seconds optimal, hook in first 2 seconds
- CTA: "Save this", "Share with a friend", "Double tap if..."`,
    FACEBOOK: `- Optimal post length: 40-80 characters get most engagement
- Questions drive comments
- Native video outperforms links
- Avoid engagement bait ("like if you agree") — algorithm penalizes it
- Link posts: compelling preview text matters more than the link title`,
    TIKTOK: `- Hook in first 1-2 seconds is EVERYTHING
- Optimal video length: 21-34 seconds
- Use trending sounds when relevant
- Conversational, unpolished tone performs best
- End with a question or open loop for comments
- Hashtags: 3-5, mix of niche and broad`,
    TWITTER: `- 71-100 characters get most engagement
- Threads for longer content (number each tweet)
- Hot takes and strong opinions drive engagement
- Quote tweets > retweets for reach
- Use polls for easy engagement
- Avoid external links in first tweet (kills reach)`,
    LINKEDIN: `- Professional but human tone
- First 2-3 lines visible before "see more" — make them count
- Personal stories outperform corporate content
- Optimal: 1300-2000 characters
- Use line breaks generously (one sentence per line)
- Document (carousel) posts get 2-3x reach
- Hashtags: 3-5, industry-specific`,
  };
  return guidelines[platform] || "";
}

export function validateContentForPlatform(
  caption: string,
  hashtags: string[],
  platform: Platform
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const limits: Record<Platform, { maxCaption: number; maxHashtags: number }> = {
    INSTAGRAM: { maxCaption: 2200, maxHashtags: 30 },
    FACEBOOK: { maxCaption: 63206, maxHashtags: 30 },
    TIKTOK: { maxCaption: 2200, maxHashtags: 100 },
    TWITTER: { maxCaption: 280, maxHashtags: 10 },
    LINKEDIN: { maxCaption: 3000, maxHashtags: 5 },
  };

  const limit = limits[platform];
  if (caption.length > limit.maxCaption) {
    issues.push(`Caption exceeds ${platform} limit of ${limit.maxCaption} characters`);
  }
  if (hashtags.length > limit.maxHashtags) {
    issues.push(`Hashtags exceed ${platform} limit of ${limit.maxHashtags}`);
  }

  return { valid: issues.length === 0, issues };
}

export const CONTENT_TYPE_OPTIONS = [
  "POST",
  "STORY",
  "REEL",
  "CAROUSEL",
  "THREAD",
  "ARTICLE",
  "POLL",
] as const;
