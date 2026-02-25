---
name: repurpose
description: "Transforms one piece of content into multiple platform-optimized formats. Turns blog posts, podcasts, videos into social content. Multiplies high-performing posts across platforms."
---

# SKILL: Repurpose Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Takes a single piece of content and transforms it into multiple platform-specific formats. Works in two modes:

1. **Cross-platform multiplication**: A viral Instagram carousel → Twitter thread + LinkedIn post + TikTok script + Facebook post
2. **Long-form extraction**: A blog post, podcast transcript, or YouTube video → a full week of social content

This agent is the content multiplier. One input, 5-15 outputs.

---

## File Location

```
agents/repurpose.ts
lib/ai/prompts/repurpose.ts
lib/ai/schemas/repurpose.ts
inngest/functions/repurpose-pipeline.ts
```

---

## Input Interface

```typescript
interface RepurposeInput {
  organizationId: string;
  sourceType: "social_post" | "blog_post" | "podcast_transcript" | "youtube_transcript" | "newsletter" | "press_release" | "custom_text";
  sourceContent: {
    title?: string;
    body: string;             // The full content to repurpose
    url?: string;             // Original URL
    platform?: Platform;      // If source is a social post
    contentType?: string;     // Original format
    engagementData?: {        // If repurposing a high performer
      impressions: number;
      engagementRate: number;
      topMetric: string;      // "saves", "shares", etc.
    };
  };
  targetPlatforms: Platform[];
  brandConfig: BrandConfig;
  excludeFormats?: string[];  // e.g. ["REEL"] if client doesn't do video
}
```

---

## Output Schema

```typescript
const RepurposeOutputSchema = z.object({
  sourceAnalysis: z.object({
    keyMessages: z.array(z.string()).min(1).max(5),
    targetAudience: z.string(),
    bestAngles: z.array(z.string()),
    contentPillars: z.array(z.string()),
  }),
  outputs: z.array(z.object({
    platform: z.string(),
    contentType: z.enum(["POST", "STORY", "REEL", "CAROUSEL", "THREAD", "ARTICLE", "POLL"]),
    caption: z.string(),
    hashtags: z.array(z.string()),
    mediaPrompt: z.string().optional(),
    altText: z.string().optional(),
    hook: z.string()
      .describe("The attention-grabbing first line or visual hook"),
    adaptationNotes: z.string()
      .describe("What was changed from the source and why — for the review queue"),
    confidenceScore: z.number().min(0).max(1),
  })),
  contentCalendarSuggestion: z.array(z.object({
    outputIndex: z.number(),
    suggestedDay: z.string(),      // "Monday", "Tuesday", etc.
    suggestedTime: z.string(),     // "morning", "afternoon", "evening"
    reasoning: z.string(),
  })),
  overallConfidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are a content repurposing expert for ${brandName}.

Your job is to take ONE piece of source content and create MULTIPLE unique, 
platform-optimized outputs. Each output must:

1. Stand alone — someone who never saw the original should understand it
2. Feel native to the target platform (not like a copy-paste)
3. Match the brand voice exactly
4. Have a unique hook — don't use the same opening across platforms
5. Be a DIFFERENT ANGLE or SLICE of the source — not the same content reformatted

REPURPOSING STRATEGIES BY PLATFORM:
- Instagram: Pull the most visual/emotional angle. Carousels for educational content, Reels for storytelling.
- Twitter/X: Extract hot takes, statistics, or counterintuitive insights. Thread for depth.
- LinkedIn: Professional angle, lessons learned, industry implications. Personal narrative tone.
- TikTok: Most entertaining/surprising element. Hook in 2 seconds. Conversational script.
- Facebook: Community-oriented angle. Questions that spark discussion.

FROM LONG-FORM CONTENT:
- Extract 5-8 standalone "atoms" of content (one stat, one story, one quote, one tip, etc.)
- Each atom becomes its own post on the best-fit platform
- Spread across the week so it doesn't feel repetitive
- The first post should NOT be "check out our new blog post" — lead with value

FROM HIGH-PERFORMING POSTS:
- Identify WHY it performed well (the hook? the topic? the format?)
- Replicate the winning element in a different format for other platforms
- Create a "part 2" or "deeper dive" variant for the same platform
- Do NOT simply copy — transform the angle
```

---

## Trigger Modes

```typescript
// Mode 1: Auto-trigger when analytics detects a top performer
export const repurposeTopContent = inngest.createFunction(
  { id: "repurpose-top-content" },
  { event: "content/top-performer-detected" },
  async ({ event, step }) => {
    // Analytics Agent fires this when a post hits top 10% engagement
    // Repurpose it across other platforms automatically
  }
);

// Mode 2: Manual trigger from dashboard ("Repurpose this post")
export const repurposeManual = inngest.createFunction(
  { id: "repurpose-manual" },
  { event: "content/repurpose-requested" },
  async ({ event, step }) => {
    // User clicks "Repurpose" on any content item in the dashboard
  }
);

// Mode 3: Long-form import (user pastes blog URL or transcript)
export const repurposeLongForm = inngest.createFunction(
  { id: "repurpose-long-form" },
  { event: "content/long-form-imported" },
  async ({ event, step }) => {
    // 1. Fetch/parse the long-form content
    // 2. Run Repurpose Agent
    // 3. Create content records for each output
    // 4. Route through confidence/review pipeline
  }
);
```

---

## Long-Form Parsing

```typescript
interface LongFormParser {
  parse(input: { url?: string; text?: string; type: string }): Promise<ParsedContent>;
}

interface ParsedContent {
  title: string;
  body: string;
  sections: Array<{ heading: string; content: string }>;
  keyStats: string[];
  quotes: string[];
  wordCount: number;
}

// Implementations:
// BlogParser — fetches URL, strips HTML, extracts structured content
// PodcastParser — transcribes audio or accepts transcript text
// YouTubeParser — fetches transcript via YouTube API
// NewsletterParser — parses email HTML content
```

---

## Dashboard UI

Add to the content dashboard:
- **"Repurpose" button** on every content item → opens modal to select target platforms → triggers repurpose
- **"Import Content" button** → paste URL or text → select source type → triggers long-form repurpose
- **Repurpose results** appear in the review queue grouped as a "batch" with a shared source reference

---

## Quality Rules

1. **Never duplicate**: Check cosine similarity against existing content — reject outputs >0.80 similar to anything published in last 60 days
2. **Platform-native**: Each output must use platform-specific features (threads for X, carousels for IG, documents for LinkedIn)
3. **Unique hooks**: The first sentence of each output must be different from all other outputs in the batch
4. **Stagger publishing**: Suggest a spread of 2-5 days between repurposed outputs to avoid flooding
5. **Source attribution**: If repurposing from an external source (blog, podcast), include appropriate credit
