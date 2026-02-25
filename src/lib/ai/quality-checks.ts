/**
 * Content Quality Checks
 * 
 * Validates generated content against platform limits, brand guidelines,
 * safety rules, and performs deduplication checks.
 */

import { z } from "zod";

export interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: "error" | "warning";
  category: string;
  message: string;
  severity: "high" | "medium" | "low";
}

// ============================================================
// PLATFORM LIMITS
// ============================================================

const PLATFORM_LIMITS: Record<string, { caption: number; hashtags: number }> = {
  INSTAGRAM: { caption: 2200, hashtags: 30 },
  FACEBOOK: { caption: 63206, hashtags: 30 },
  TIKTOK: { caption: 2200, hashtags: 100 },
  TWITTER: { caption: 280, hashtags: 10 },
  LINKEDIN: { caption: 3000, hashtags: 5 },
};

// ============================================================
// SAFETY CHECKS
// ============================================================

const BLOCKED_PATTERNS = [
  /\b(buy now|order now|click here)\b/i,
  /\b(free money|no risk|guaranteed)\b/i,
  /\b(act now|limited time|don't miss)\b/i,
];

const CRISIS_KEYWORDS = [
  "suicide", "self-harm", "violence", "abuse",
  "scam", "fraud", "illegal", "lawsuit",
];

// ============================================================
// AI TELL PATTERNS
// ============================================================

const AI_TELLS = [
  /as an AI/i,
  /i cannot/i,
  /i'm sorry/i,
  /here's a/i,
  /here is a/i,
  /please note/i,
  /it's important to note/i,
  /keep in mind/i,
  /in conclusion/i,
  /to summarize/i,
];

// ============================================================
// MAIN QUALITY CHECK
// ============================================================

export async function performQualityChecks(
  content: {
    caption: string;
    hashtags: string[];
    platform: string;
  },
  options?: {
    brandDoNots?: string[];
    hashtagNever?: string[];
    previousCaptions?: string[];
  }
): Promise<QualityCheckResult> {
  const issues: QualityIssue[] = [];
  
  // 1. Platform limits
  const platformIssues = checkPlatformLimits(content.platform, content.caption, content.hashtags);
  issues.push(...platformIssues);
  
  // 2. Safety check
  const safetyIssues = checkSafety(content.caption);
  issues.push(...safetyIssues);
  
  // 3. AI tells
  const aiTellIssues = checkAITells(content.caption);
  issues.push(...aiTellIssues);
  
  // 4. Hashtag validation
  const hashtagIssues = checkHashtags(content.hashtags, options?.hashtagNever || []);
  issues.push(...hashtagIssues);
  
  // 5. Deduplication (if previous captions provided)
  if (options?.previousCaptions && options.previousCaptions.length > 0) {
    const dupIssues = await checkDeduplication(content.caption, options.previousCaptions);
    issues.push(...dupIssues);
  }

  const hasErrors = issues.some(i => i.type === "error");
  
  return {
    passed: !hasErrors,
    issues,
  };
}

// ============================================================
// INDIVIDUAL CHECKS
// ============================================================

function checkPlatformLimits(platform: string, caption: string, hashtags: string[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const limits = PLATFORM_LIMITS[platform];
  
  if (limits) {
    if (caption.length > limits.caption) {
      issues.push({
        type: "error",
        category: "length",
        message: `Caption exceeds ${platform} limit of ${limits.caption} characters`,
        severity: "high",
      });
    }
    
    if (hashtags.length > limits.hashtags) {
      issues.push({
        type: "warning",
        category: "hashtags",
        message: `Hashtags exceed ${platform} recommended limit of ${limits.hashtags}`,
        severity: "medium",
      });
    }
  }
  
  return issues;
}

function checkSafety(caption: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lowerCaption = caption.toLowerCase();
  
  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(caption)) {
      issues.push({
        type: "error",
        category: "safety",
        message: "Content contains disallowed marketing language",
        severity: "high",
      });
    }
  }
  
  // Check crisis keywords
  for (const keyword of CRISIS_KEYWORDS) {
    if (lowerCaption.includes(keyword)) {
      issues.push({
        type: "warning",
        category: "safety",
        message: `Content mentions "${keyword}" - review for sensitivity`,
        severity: "medium",
      });
    }
  }
  
  return issues;
}

function checkAITells(caption: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  for (const pattern of AI_TELLS) {
    if (pattern.test(caption)) {
      issues.push({
        type: "warning",
        category: "ai_tells",
        message: "Content may contain AI-generated language patterns",
        severity: "low",
      });
    }
  }
  
  return issues;
}

function checkHashtags(hashtags: string[], neverList: string[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  
  for (const tag of hashtags) {
    if (neverList.includes(tag.toLowerCase())) {
      issues.push({
        type: "error",
        category: "hashtags",
        message: `Hashtag #${tag} is on the brand's never-use list`,
        severity: "high",
      });
    }
  }
  
  return issues;
}

async function checkDeduplication(caption: string, previousCaptions: string[]): Promise<QualityIssue[]> {
  const issues: QualityIssue[] = [];
  
  // Simple string similarity using word overlap
  const captionWords = new Set(caption.toLowerCase().split(/\s+/));
  
  for (const prev of previousCaptions) {
    const prevWords = new Set(prev.toLowerCase().split(/\s+/));
    
    // Calculate Jaccard similarity
    const intersection = [...captionWords].filter(w => prevWords.has(w));
    const union = new Set([...captionWords, ...prevWords]);
    const similarity = intersection.length / union.size;
    
    if (similarity > 0.7) {
      issues.push({
        type: "warning",
        category: "duplication",
        message: `Content is similar to previous post (${Math.round(similarity * 100)}% word overlap)`,
        severity: "medium",
      });
      break;
    }
  }
  
  return issues;
}

// ============================================================
// BRAND VOICE CHECK
// ============================================================

export function checkBrandVoice(
  caption: string,
  brandVoice: {
    adjectives: string[];
    examples: string[];
    avoid: string[];
  }
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lowerCaption = caption.toLowerCase();
  
  // Check for avoid terms
  for (const term of brandVoice.avoid) {
    if (lowerCaption.includes(term.toLowerCase())) {
      issues.push({
        type: "error",
        category: "brand_voice",
        message: `Content contains term "${term}" that brand wants to avoid`,
        severity: "high",
      });
    }
  }
  
  return issues;
}

// ============================================================
// VALIDATE FOR PLATFORM
// ============================================================

export function validateForPlatform(
  platform: string,
  content: { caption: string; hashtags: string[] }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const limits = PLATFORM_LIMITS[platform];
  
  if (limits) {
    if (content.caption.length > limits.caption) {
      errors.push(`Caption too long: ${content.caption.length}/${limits.caption} chars`);
    }
    
    if (content.hashtags.length > limits.hashtags) {
      errors.push(`Too many hashtags: ${content.hashtags.length}/${limits.hashtags}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
