import { prisma } from "@/lib/prisma";

export interface FingerprintData {
  // Hook DNA
  hookType: string;
  hookLength: number;
  hookUsesNumber: boolean;
  hookUsesEmoji: boolean;
  hookUsesYou: boolean;
  hookEmotionalTone: string;

  // Content DNA
  topic: string;
  subtopic?: string;
  angle: string;
  structure: string;
  captionLength: number;
  paragraphCount: number;
  usesLineBreaks: boolean;
  readabilityLevel: string;
  callToAction?: string;
  ctaPlacement?: string;

  // Visual DNA
  visualType?: string;
  visualProvider?: string;
  dominantColor?: string;
  brightness?: string;
  hasText: boolean;
  textAmount?: string;
  hasProduct: boolean;
  hasPerson: boolean;
  layout?: string;
  slideCount?: number;

  // Timing DNA
  dayOfWeek: number;
  hourOfDay: number;
  isWeekend: boolean;
  seasonalContext?: string;

  // Distribution DNA
  hashtagCount: number;
  hashtagMix?: string;
  mentionsCount: number;
  hasLocation: boolean;
}

interface ContentInput {
  caption: string | null;
  hashtags: string[];
  platform: string;
  publishedAt: Date | null;
}

/**
 * Extract fingerprint from content.
 * Analyzes the content and extracts DNA dimensions for performance tracking.
 */
export async function fingerprintContent(content: ContentInput): Promise<FingerprintData> {
  const caption = content.caption || "";
  const hashtags = content.hashtags || [];
  const platform = content.platform;

  // Extract hook from caption (first line or first 100 chars)
  const firstLine = caption.split("\n")[0] || caption.slice(0, 100);
  const hookType = detectHookType(firstLine);
  const hookLength = firstLine.length;
  const hookUsesNumber = /\d/.test(firstLine);
  const hookUsesEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(firstLine);
  const hookUsesYou = /\b(you|your|we|our|us)\b/i.test(firstLine);
  const hookEmotionalTone = detectEmotionalTone(firstLine);

  // Extract topic and angle (simplified - could use LLM for more accuracy)
  const { topic, subtopic, angle, structure } = extractTopicAndAngle(caption);

  // Content metrics
  const captionLength = caption.length;
  const paragraphCount = caption.split("\n\n").filter(p => p.trim()).length;
  const usesLineBreaks = caption.includes("\n");
  const readabilityLevel = calculateReadability(caption);
  const { callToAction, ctaPlacement } = extractCTA(caption);

  // Extract timing
  const publishedAt = content.publishedAt || new Date();
  const dayOfWeek = publishedAt.getDay();
  const hourOfDay = publishedAt.getHours();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const seasonalContext = detectSeasonalContext(publishedAt, caption);

  // Distribution metrics
  const hashtagCount = hashtags.length;
  const hashtagMix = analyzeHashtagMix(hashtags);
  const mentionsCount = (caption.match(/@\w+/g) || []).length;
  const hasLocation = /#\w+Location|#\w+City|#\w+Place/i.test(caption);

  return {
    hookType,
    hookLength,
    hookUsesNumber,
    hookUsesEmoji,
    hookUsesYou,
    hookEmotionalTone,
    topic,
    subtopic,
    angle,
    structure,
    captionLength,
    paragraphCount,
    usesLineBreaks,
    readabilityLevel,
    callToAction,
    ctaPlacement,
    // Visual - will be enriched from GeneratedVisual if available
    visualType: undefined,
    visualProvider: undefined,
    dominantColor: undefined,
    brightness: undefined,
    hasText: false,
    textAmount: undefined,
    hasProduct: false,
    hasPerson: false,
    layout: undefined,
    slideCount: undefined,
    // Timing
    dayOfWeek,
    hourOfDay,
    isWeekend,
    seasonalContext,
    // Distribution
    hashtagCount,
    hashtagMix,
    mentionsCount,
    hasLocation,
  };
}

/**
 * Detect the type of hook used in the content.
 */
function detectHookType(text: string): string {
  const lower = text.toLowerCase();
  
  if (/\d+\s+(things|tips|ways|reasons|steps|ideas|secrets|hacks)/i.test(text)) {
    return "list_number";
  }
  if (/\?/.test(text) && !lower.startsWith("how") && !lower.startsWith("what")) {
    return "question";
  }
  if (/\d+%|\d+\.\d+%|\$\d+|\d+K|\d+M/i.test(text)) {
    return "statistic";
  }
  if (/never|always|everyone|no one|you should|you must|i guarantee/i.test(text)) {
    return "bold_claim";
  }
  if (/story|told me|learned|discovered|found out/i.test(text)) {
    return "story_opener";
  }
  if (/how to|how i|learn how|discover how/i.test(text)) {
    return "how_to";
  }
  if (/wait till|you won't|can't believe|shocking|unbelievable/i.test(text)) {
    return "controversy";
  }
  if (/ever wondered|want to know|guess|thinking about/i.test(text)) {
    return "curiosity_gap";
  }
  
  return "statement";
}

/**
 * Detect emotional tone of the hook.
 */
function detectEmotionalTone(text: string): string {
  const urgency = /urgent|immediately|now|don't wait|limited|time|deadline/i.test(text);
  const surprise = /shocking|unbelievable|wait till|can't believe|amazing/i.test(text);
  const curiosity = /wonder|guess|want to know|curious|secret/i.test(text);
  const empathy = /understand|feel|struggle|know how|been there/i.test(text);
  const authority = /research|study|expert|science|proven|fact/i.test(text);
  
  if (urgency) return "urgency";
  if (surprise) return "surprise";
  if (curiosity) return "curiosity";
  if (empathy) return "empathy";
  if (authority) return "authority";
  
  return "neutral";
}

/**
 * Extract topic, subtopic, and angle from caption.
 * Simplified version - could use LLM for better accuracy.
 */
function extractTopicAndAngle(caption: string) {
  const lower = caption.toLowerCase();
  
  // Simple topic detection
  let topic = "general";
  let subtopic: string | undefined;
  let angle = "educational";
  
  const topicKeywords: Record<string, string[]> = {
    "skincare": ["skin", "skincare", "face", "acne", "moisturizer", "serum"],
    "wellness": ["wellness", "health", "healthy", "wellbeing", "self-care"],
    "business": ["business", "entrepreneur", "startup", "company", "brand"],
    "marketing": ["marketing", "social media", "content", "strategy", "growth"],
    "productivity": ["productivity", "time management", "efficiency", "organize"],
    "lifestyle": ["lifestyle", "daily", "routine", "morning", "evening"],
    "fitness": ["fitness", "workout", "exercise", "gym", "training"],
    "nutrition": ["nutrition", "food", "diet", "eating", "recipe", "meal"],
    "fashion": ["fashion", "style", "outfit", "clothing", "wear"],
    "technology": ["tech", "app", "software", "digital", "ai", "工具"],
  };
  
  for (const [t, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => lower.includes(k))) {
      topic = t;
      break;
    }
  }
  
  // Angle detection
  if (/tip|how to|guide|learn|strategy/i.test(caption)) {
    angle = "educational";
  } else if (/inspire|motivation|dream|goal|achieve/i.test(caption)) {
    angle = "inspirational";
  } else if (/funny|laugh|hilarious|comedy|meme/i.test(caption)) {
    angle = "entertaining";
  } else if (/sale|discount|buy|shop|offer|limited/i.test(caption)) {
    angle = "promotional";
  } else if (/behind the scenes|bts|day in|our story/i.test(caption)) {
    angle = "behind_scenes";
  }
  
  // Structure detection
  let structure = "paragraph";
  if (/\d+\.\s/.test(caption)) {
    structure = "tip_list";
  } else if (/first|then|next|finally|step/i.test(caption)) {
    structure = "how_to";
  } else if (/before|after|transform/i.test(caption)) {
    structure = "before_after";
  } else if (/myth|false|truth|real/i.test(caption)) {
    structure = "myth_bust";
  }
  
  return { topic, subtopic, angle, structure };
}

/**
 * Calculate readability level.
 */
function calculateReadability(text: string): string {
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).length;
  const avgWordsPerSentence = words / Math.max(sentences, 1);
  
  if (avgWordsPerSentence < 10) return "simple";
  if (avgWordsPerSentence < 18) return "moderate";
  return "complex";
}

/**
 * Extract call-to-action from caption.
 */
function extractCTA(caption: string) {
  const lower = caption.toLowerCase();
  
  let callToAction: string | undefined;
  let ctaPlacement: string | undefined;
  
  const ctaPatterns: Record<string, RegExp> = {
    save: /save|save this|save for later|bookmark/i,
    comment: /comment|let me know|share your|tell me/i,
    click_link: /link in bio|click the|check out|visit/i,
    follow: /follow|follow me|follow us|like and follow/i,
    share: /share|repost|tag|send to/i,
  };
  
  for (const [cta, pattern] of Object.entries(ctaPatterns)) {
    if (pattern.test(caption)) {
      callToAction = cta;
      break;
    }
  }
  
  // Find CTA placement
  const lines = caption.split("\n");
  const ctaLineIndex = lines.findIndex(line => 
    Object.values(ctaPatterns).some(p => p.test(line))
  );
  
  if (ctaLineIndex >= 0) {
    if (ctaLineIndex === 0) ctaPlacement = "beginning";
    else if (ctaLineIndex === lines.length - 1) ctaPlacement = "end";
    else ctaPlacement = "middle";
  }
  
  return { callToAction, ctaPlacement };
}

/**
 * Detect seasonal context.
 */
function detectSeasonalContext(date: Date, caption: string): string {
  const month = date.getMonth();
  const day = date.getDate();
  const lower = caption.toLowerCase();
  
  // Check for holidays
  if ((month === 11 && day >= 20) || (month === 0 && day <= 5)) {
    return "holiday_adjacent"; // Holiday season
  }
  if (month === 1 && day === 14) return "holiday_adjacent"; // Valentine's
  if (month === 2 && day >= 1 && day <= 31) return "seasonal_topic"; // Spring
  if (month === 6 && day >= 1 && day <= 31) return "seasonal_topic"; // Summer
  if (month === 9 && day >= 1 && day <= 30) return "seasonal_topic"; // Back to school
  
  // Check caption for trending topics
  const seasonalKeywords: Record<string, RegExp[]> = {
    "holiday_adjacent": [/christmas|holiday|new year|gift|season/i],
    "seasonal_topic": [/summer|spring|winter|fall|autumn|weather/i],
    "cultural_moment": [/trending|viral|challenge|news/i],
  };
  
  for (const [context, patterns] of Object.entries(seasonalKeywords)) {
    if (patterns.some(p => p.test(lower))) {
      return context;
    }
  }
  
  return "none";
}

/**
 * Analyze hashtag mix.
 */
function analyzeHashtagMix(hashtags: string[]): string {
  if (hashtags.length === 0) return "none";
  
  // Simple heuristic - could be enhanced with API data
  const brandedCount = hashtags.filter(h => h.startsWith("#")).length;
  const nicheCount = hashtags.length - brandedCount;
  
  if (brandedCount > nicheCount * 2) return "branded_heavy";
  if (nicheCount > brandedCount * 2) return "mostly_niche";
  if (nicheCount > 0) return "balanced";
  
  return "none";
}

/**
 * Save fingerprint to database.
 */
export async function saveFingerprint(
  contentId: string,
  organizationId: string,
  platform: string,
  data: FingerprintData
): Promise<void> {
  await prisma.contentFingerprint.create({
    data: {
      organizationId,
      contentId,
      platform: platform as any,
      ...data,
    },
  });
}

/**
 * Update fingerprint with performance data after 7 days.
 */
export async function updateFingerprintWithPerformance(
  contentId: string,
  performance: {
    engagementRate: number;
    reachRate: number;
    saveRate: number;
    shareRate: number;
    commentRate: number;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    percentileRank: number;
  }
): Promise<void> {
  await prisma.contentFingerprint.update({
    where: { contentId },
    data: {
      ...performance,
      evaluatedAt: new Date(),
    },
  });
}
