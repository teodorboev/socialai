---
name: ai-first-ux
description: "Complete UX redesign: AI-guided conversational onboarding (5 min) + mission control dashboard. No menus, no manual management. The AI runs everything. Humans monitor and intervene only when asked. This skill overrides all previous dashboard/UI assumptions."
---

# SKILL: AI-First UX — Onboarding & Mission Control

> **This skill overrides all previous UI/dashboard assumptions across all other skills.**
> The platform is NOT a tool the human operates. It's an autonomous AI system the human monitors.

---

## Core Philosophy

```
OLD THINKING: "Here are 15 menus to manage your social media with AI assistance."
NEW THINKING: "Your AI is running your social media. Here's what it's doing."

OLD: Human drives, AI assists.
NEW: AI drives, human supervises.
```

The entire interface has THREE modes:
1. **Onboarding** — AI-guided conversation (happens once, ~5 minutes)
2. **Mission Control** — Single-screen monitoring dashboard (daily use)
3. **Intervention** — AI asks human for input when needed (notifications)

That's it. No settings pages. No content editors. No calendar managers. No analytics tabs.

---

## File Structure

```
app/(onboarding)/onboard/page.tsx          → AI conversation onboarding
app/(onboarding)/onboard/review/page.tsx   → Review AI's proposed plan
app/(mission-control)/layout.tsx           → Mission control shell
app/(mission-control)/page.tsx             → The ONE main screen
app/(mission-control)/feed/page.tsx        → Activity feed (deep dive)
app/(mission-control)/ask/page.tsx         → Talk to your AI
lib/onboarding/conversation-engine.ts      → Manages onboarding chat flow
lib/mission-control/feed.ts                → Real-time activity aggregation
components/mission-control/               → All MC components
```

---

## PART 1: ONBOARDING (AI-Guided Conversation)

The onboarding is NOT a form. It's a conversation with the AI. The AI asks questions, the human responds naturally, and the AI extracts everything it needs.

### The Conversation Flow

```
PHASE 1: CONNECT (30 seconds)
─────────────────────────────
AI: "Let's get your social media running on autopilot. First, connect
    your social accounts so I can see what you've been doing."

    [Connect Instagram] [Connect Facebook] [Connect LinkedIn]
    [Connect TikTok] [Connect X/Twitter] [Connect Pinterest]

    (OAuth flows — each takes 10 seconds)

AI: "Great, I can see your Instagram (2,340 followers) and LinkedIn
    (890 followers). I'm analyzing your last 90 days of content now.
    While I do that, let me ask you a few questions..."


PHASE 2: UNDERSTAND THE BUSINESS (2 minutes)
─────────────────────────────────────────────
AI: "What does your business do? Just tell me in your own words."
Human: "We make organic skincare products for sensitive skin"

AI: "Got it — organic skincare for sensitive skin. Who's your ideal
    customer? Age, lifestyle, what matters to them?"
Human: "Women 25-45 who care about clean ingredients and sustainability"

AI: "Makes sense. What are 2-3 brands you see as competitors?"
Human: "Drunk Elephant, Herbivore Botanicals, and Youth to the People"

AI: "Good competitors to watch. What's your main goal with social media
    right now?"
    [Grow followers] [Drive website sales] [Build brand awareness]
    [Launch a new product] [All of the above]
Human: taps "Drive website sales"

AI: "What's your website URL? I'll set up conversion tracking."
Human: "www.pureglow.com"

AI: "Do you have any absolute no-gos? Things I should never post about
    or styles you hate?"
Human: "Never compare us to competitors directly. No clickbait. No
    excessive emojis."

AI: "Last question — how involved do you want to be?"
    [Fully autonomous — just send me weekly reports]
    [Light touch — let me approve content before it goes live]
    [Hands on — I want to review everything]
Human: taps "Light touch"


PHASE 3: AI ANALYSIS (1 minute — shown as real-time progress)
──────────────────────────────────────────────────────────────
AI: "I'm analyzing everything now. Give me about 60 seconds..."

    ✅ Analyzed 127 Instagram posts from the last 90 days
    ✅ Analyzed 43 LinkedIn posts
    ✅ Identified your brand voice: warm, educational, nature-inspired
    ✅ Found your best content: skincare tips get 3x more engagement
    ✅ Mapped your audience: 78% women, 25-40, US + UK
    ✅ Scanned 3 competitors: you're behind on Reels but ahead on carousels
    ✅ Identified optimal posting times for your audience
    ✅ Set up conversion tracking for pureglow.com

    "Done! Here's what I'm proposing..."


PHASE 4: REVIEW THE PLAN (2 minutes)
─────────────────────────────────────
AI presents a visual plan — NOT a wall of text:

┌─────────────────────────────────────────────────────┐
│ YOUR AI SOCIAL MEDIA PLAN                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📱 Platforms: Instagram (primary), LinkedIn         │
│                                                     │
│ 📅 Posting Schedule:                                │
│    Instagram: 5x/week (Mon-Fri, 9am & 6pm)        │
│    LinkedIn: 3x/week (Tue, Wed, Thu, 8am)          │
│                                                     │
│ 🎨 Content Mix:                                     │
│    40% Educational (skincare tips, ingredient       │
│        spotlights)                                  │
│    30% Product (lifestyle shots, reviews, UGC)      │
│    20% Behind the scenes (making process, team)     │
│    10% Trending (seasonal, cultural moments)        │
│                                                     │
│ 🗣️ Brand Voice:                                     │
│    Warm, knowledgeable, nature-inspired             │
│    "Like a trusted friend who happens to be a       │
│     skincare expert"                                │
│                                                     │
│ 🎯 Goal: Drive website sales                        │
│    Every post will have a strategic path to         │
│    pureglow.com — some direct, some through         │
│    building trust first.                            │
│                                                     │
│ 🤖 Automation Level: Light Touch                    │
│    I'll generate content and show you a preview     │
│    24 hours before publishing. Approve with one     │
│    tap, or I'll adjust.                             │
│                                                     │
│ 📊 Reporting: Weekly summary every Monday 9am      │
│                                                     │
│ [Looks good — launch it!]  [Let me tweak a few things] │
└─────────────────────────────────────────────────────┘

If they tap "tweak":
AI: "What would you change?"
Human: "Can we do more Reels? And post on weekends too."
AI: "Done — I've added 2 Reels per week and Saturday posts.
    Updated plan: [shows revised version]"

Human taps "Launch it!"

AI: "🚀 Your AI is now live. I'm generating your first week of content
    right now. You'll see previews in your mission control within the
    hour. I'll send you a notification when the first batch is ready
    for review."

    [Go to Mission Control →]
```

### Onboarding Database

```prisma
model OnboardingConversation {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  messages        Json     // Full conversation history
  extractedData   Json     // Structured data extracted from conversation
  phase           String   @default("connect") // connect, understand, analyzing, review, complete
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Data Extraction

The AI conversation is backed by structured extraction. Every human response gets parsed:

```typescript
interface ExtractedOnboardingData {
  business: {
    description: string;
    industry: string;        // AI-classified from description
    products: string[];      // Extracted from description
    website: string;
    uniqueSellingPoints: string[];
  };
  audience: {
    demographics: string;
    ageRange: string;
    interests: string[];
    locations: string[];
  };
  competitors: Array<{
    name: string;
    handles: Record<string, string>; // AI looks these up automatically
  }>;
  goals: string[];
  brandVoice: {
    detected: string[];      // From account analysis
    confirmed: boolean;
    adjustments: string[];
  };
  doNots: string[];          // Explicit restrictions
  automationLevel: "autonomous" | "light_touch" | "hands_on";
  connectedAccounts: Array<{
    platform: string;
    handle: string;
    followers: number;
  }>;
  approvedPlan: {
    platforms: string[];
    postingSchedule: Record<string, any>;
    contentMix: Record<string, number>;
    reportingFrequency: string;
  };
}

// This data auto-populates:
// → OrgSettings (thresholds based on automation level)
// → BrandVoiceProfile (from detected + confirmed voice)
// → Competitor table (from competitor names)
// → PostingSchedule (from approved plan)
// → SafetyConfig (from do-nots)
// → Strategy Agent's first content plan
// → Content Creator's first batch
```

---

## PART 2: MISSION CONTROL (The Only Screen)

After onboarding, the user sees ONE screen. Not a sidebar with 15 items. One screen with everything they need.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  🟢 PureGlow AI is running                    [Talk to AI] [👤] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │
│  │  FOLLOWERS   │  │ ENGAGEMENT  │  │   REACH     │  │  ROI   │ │
│  │  3,230       │  │   4.2%      │  │   45.2K     │  │ $2,340 │ │
│  │  ↑ +127      │  │   ↑ +0.8%   │  │   ↑ +12K    │  │ ↑ +$890│ │
│  │  this week   │  │  this week  │  │  this week  │  │ weekly │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ⚡ NEEDS YOUR ATTENTION (2)                                │  │
│  │                                                           │  │
│  │ 📝 3 posts ready for review — publishing tomorrow 9am    │  │
│  │    [Preview & Approve All]  [Review individually]         │  │
│  │                                                           │  │
│  │ 💬 Customer complaint getting traction (23 replies)       │  │
│  │    AI drafted a response. [See response & approve]        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🤖 AI ACTIVITY (live)                                     │  │
│  │                                                           │  │
│  │ 2 min ago   Published "5 ingredients to avoid..." on IG   │  │
│  │ 15 min ago  Replied to 4 comments on yesterday's post     │  │
│  │ 1 hour ago  Generated 5 posts for next week               │  │
│  │ 3 hours ago Detected trending topic: #CleanBeautyWeek     │  │
│  │             → Creating a themed post for Thursday         │  │
│  │ Yesterday   Weekly report sent to your email              │  │
│  │ Yesterday   Competitor "Herbivore" launched new campaign   │  │
│  │             → Adjusting this week's content angle         │  │
│  │                                                           │  │
│  │ [View full activity feed →]                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │ 📅 COMING UP         │  │ 🏆 WINS THIS WEEK              │  │
│  │                      │  │                                │  │
│  │ Today 6pm            │  │ 🔥 Reel hit 12K views          │  │
│  │  IG Reel: skincare   │  │ 💛 127 new followers            │  │
│  │  routine tips        │  │ 🛒 34 website clicks from      │  │
│  │                      │  │    Tuesday's carousel          │  │
│  │ Tomorrow 9am         │  │ ⭐ 5-star review on Google      │  │
│  │  IG Carousel: top 5  │  │    → AI responded              │  │
│  │  ingredients         │  │                                │  │
│  │                      │  │                                │  │
│  │ Tomorrow 8am         │  │                                │  │
│  │  LinkedIn: industry  │  │                                │  │
│  │  trend analysis      │  │                                │  │
│  │                      │  │                                │  │
│  │ [See full calendar]  │  │                                │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📊 WEEKLY PULSE                                           │  │
│  │                                                           │  │
│  │ [engagement sparkline chart ────────/\──── ]              │  │
│  │                                                           │  │
│  │ "Strong week overall. Your ingredient spotlight posts     │  │
│  │  continue to outperform — I'm creating more of those.    │  │
│  │  LinkedIn engagement dipped slightly, likely due to the   │  │
│  │  holiday. Adjusting next week's schedule to compensate."  │  │
│  │                                                           │  │
│  │ [Read full report →]                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Mission Control Sections

| Section | What It Shows | Updates |
|---------|--------------|---------|
| **Status Bar** | AI running status (🟢 running, 🟡 needs attention, 🔴 paused/crisis) | Real-time |
| **Metrics Strip** | 4 key numbers: followers, engagement, reach, ROI | Every 15 min |
| **Needs Attention** | Things ONLY a human can decide. Disappears when empty. | Real-time push |
| **AI Activity** | Live feed of what the AI is doing. Scrollable. | Real-time |
| **Coming Up** | Next 5 scheduled posts with preview thumbnails | Every hour |
| **Wins** | Positive things that happened this week | Daily |
| **Weekly Pulse** | Sparkline + AI narrative summary | Weekly |

### "Needs Attention" — The Only Action Center

This is the ONLY place the human needs to do anything. Everything else is informational.

```typescript
type AttentionItem =
  | { type: "content_review"; posts: ContentPreview[]; deadline: Date }
  | { type: "escalated_comment"; comment: Comment; aiDraftResponse: string }
  | { type: "crisis_detected"; severity: string; briefUrl: string }
  | { type: "strategy_proposal"; proposal: string; approveUrl: string }
  | { type: "influencer_candidate"; candidate: Influencer; approveUrl: string }
  | { type: "budget_approval"; campaign: AdCampaign; estimatedCost: number }
  | { type: "media_pitch"; pitch: MediaPitch; approveUrl: string }
  | { type: "monthly_strategy"; plan: StrategyPlan; reviewUrl: string }
  | { type: "onboarding_question"; question: string }; // AI needs more info

// Display rules:
// - Max 5 items shown. If more, show count: "and 3 more items"
// - Each item has a ONE-TAP primary action: [Approve] [Send] [Dismiss]
// - Deadlines shown: "Publishing in 4 hours — approve or I'll hold it"
// - If zero items: section hides entirely, replaced by "✨ Nothing needs your attention"
```

### Content Review (One-Tap Approval)

When the AI generates content for review (based on automation level):

```
┌─────────────────────────────────────────────────────────────┐
│ 📝 3 posts ready for review                                │
│    Publishing tomorrow starting 9am. Approve by tonight.    │
│                                                             │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│ │ [image] │  │ [image] │  │ [image] │                      │
│ │         │  │         │  │         │                      │
│ │ IG Post │  │IG Reel  │  │LinkedIn │                      │
│ │ 9am     │  │ 6pm     │  │ 8am     │                      │
│ └─────────┘  └─────────┘  └─────────┘                     │
│                                                             │
│ [✅ Approve All]  [Review individually]  [⏸️ Hold all]      │
└─────────────────────────────────────────────────────────────┘
```

Tapping a post shows:
- Full caption preview
- Image/video preview
- Platform + scheduled time
- Predicted performance score
- [✅ Approve] [✏️ Edit] [🔄 Regenerate] [❌ Skip]

Edit opens a minimal editor — just the caption text. Not a full CMS. The human tweaks a few words and taps save. The AI learns from the edit.

---

## PART 3: "TALK TO YOUR AI" (The Command Interface)

Instead of settings pages, the human TALKS to the AI to change anything:

```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Talk to your AI                                          │
│                                                             │
│ You: "Post more Reels, they seem to be working"             │
│ AI:  "Agreed — your Reels are getting 3.2x more reach than  │
│       static posts. I've updated the content mix to include  │
│       3 Reels per week instead of 1. You'll see the first   │
│       new ones in tomorrow's review batch."                  │
│                                                             │
│ You: "Stop posting on weekends"                              │
│ AI:  "Done. I've removed Saturday and Sunday from your       │
│       posting schedule. Your weekend content will be         │
│       redistributed to weekdays. Note: your audience is      │
│       actually 15% more active on Sundays — want me to keep │
│       Sundays and just remove Saturdays?"                    │
│                                                             │
│ You: "What's working best right now?"                        │
│ AI:  "Your top performers this month are ingredient          │
│       spotlight carousels (avg 5.1% engagement) and          │
│       skincare routine Reels (avg 4.8%). Product-only posts  │
│       are your weakest at 1.9%. I've been shifting the mix   │
│       toward educational content because of this."           │
│                                                             │
│ You: "We're launching a new product next month"              │
│ AI:  "Exciting! Tell me about the product and the launch     │
│       date, and I'll build a pre-launch, launch, and         │
│       post-launch content campaign for it."                  │
│                                                             │
│ [Type a message...]                                          │
└─────────────────────────────────────────────────────────────┘
```

This replaces:
- Settings pages → "change my posting schedule to..."
- Strategy planning → "we're launching a new product..."
- Brand voice editing → "be more casual on Instagram"
- Competitor management → "also watch Glow Recipe as a competitor"
- Content requests → "create a post about our holiday sale"
- Analytics deep dives → "why did engagement drop last week?"
- Feature discovery → "what can you do that I'm not using?"

### Implementation

```typescript
// The "Talk to AI" is a Claude-powered chat with tool use
// It has access to ALL agent capabilities as tools:

const tools = [
  { name: "update_posting_schedule", description: "Change posting times/frequency" },
  { name: "update_content_mix", description: "Change content type ratios" },
  { name: "update_brand_voice", description: "Adjust tone, vocabulary, style" },
  { name: "add_competitor", description: "Start tracking a new competitor" },
  { name: "create_content_request", description: "Request specific content" },
  { name: "create_campaign", description: "Build a content campaign for an event/launch" },
  { name: "get_analytics", description: "Pull performance data" },
  { name: "get_competitor_report", description: "Get competitor intelligence" },
  { name: "update_automation_level", description: "Change human involvement level" },
  { name: "update_do_nots", description: "Add/remove content restrictions" },
  { name: "explain_decision", description: "Explain why the AI made a specific choice" },
  { name: "get_recommendations", description: "Get AI's suggestions for improvement" },
  { name: "pause_publishing", description: "Pause all scheduled content" },
  { name: "resume_publishing", description: "Resume publishing" },
];

// Every conversation message is stored and also fed to the AI Training system
// as implicit preferences. "Post more Reels" → AIPreference: "prefer Reels"
```

---

## PART 4: NOTIFICATIONS (AI Reaches Out)

The AI proactively notifies the human. The human doesn't need to check the dashboard.

### Notification Channels

| Channel | When Used |
|---------|-----------|
| Push notification (mobile) | Content ready for review, escalated comment, crisis |
| Email | Weekly report, monthly strategy proposal, milestone |
| Dashboard badge | Everything |
| SMS (optional) | Crisis only |

### Notification Types

```typescript
type Notification =
  // Daily
  | { type: "content_ready"; message: "3 posts ready for review. Publishing at 9am." }
  | { type: "daily_digest"; message: "Yesterday: 3 posts published, 47 comments handled, +23 followers" }

  // Event-driven
  | { type: "escalation"; message: "Customer complaint needs your response" }
  | { type: "crisis"; message: "⚠️ Negative mention spike detected — content paused" }
  | { type: "viral_content"; message: "🔥 Your Reel just hit 50K views!" }
  | { type: "milestone"; message: "🎉 You just hit 5,000 Instagram followers!" }
  | { type: "competitor_alert"; message: "Herbivore just launched a major campaign" }

  // Weekly
  | { type: "weekly_report"; message: "Your weekly performance report is ready" }

  // Monthly
  | { type: "strategy_review"; message: "Monthly strategy update ready for review" }
  | { type: "roi_report"; message: "This month: social drove $8,340 in revenue" }

  // AI asking for help
  | { type: "ai_question"; message: "Quick question: you mentioned a product launch — when is it?" }
```

---

## PART 5: AUTOMATION LEVELS

The onboarding question "how involved do you want to be?" maps to real system behavior:

### Fully Autonomous
```
- AI generates, approves, and publishes everything
- AI responds to all comments and DMs
- Human gets weekly email report only
- "Needs Attention" only appears for: crises, major strategy changes, budget approvals
- Dashboard is purely informational
```

### Light Touch (Default for most clients)
```
- AI generates content and queues for review 24h before publish
- Human gets push notification: "3 posts ready" → one-tap approve
- If human doesn't review by deadline: AI holds (doesn't auto-publish)
- AI handles routine comments; escalates sensitive ones
- Human gets daily digest + weekly report
```

### Hands On
```
- AI generates content as drafts only
- Human must explicitly approve each post
- AI suggests comment responses; human must approve
- Human gets real-time notifications for everything
- More items appear in "Needs Attention"
```

### Database

```prisma
// Simplified — replaces the sprawling OrgSettings with clear levels

model OrganizationConfig {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Automation
  automationLevel   String  @default("light_touch") // "autonomous", "light_touch", "hands_on"
  reviewWindowHours Int     @default(24) // How long before publish to send for review
  autoPublishOnNoReview Boolean @default(false) // Publish anyway if not reviewed

  // These are all SET BY THE AI during onboarding, adjustable via "Talk to AI"
  // Humans never see a settings form for these
  postingSchedule   Json    // Set by AI from onboarding analysis
  contentMix        Json    // Set by AI
  brandVoice        Json    // Set by AI from account analysis
  competitors       Json    // Set by AI from conversation
  doNots            String[] // From conversation
  goals             String[] // From conversation
  targetAudience    Json    // From conversation
  connectedPlatforms String[]

  // AI-managed (human never touches)
  confidenceThreshold Float @default(0.75) // AI adjusts this based on approval rate
  currentStrategy   Json?   // Active strategy plan
  lastStrategyUpdate DateTime?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## PART 6: ADAPTIVE CONFIDENCE

The AI automatically adjusts its confidence threshold based on the human's behavior:

```typescript
// If the human approves 95% of content without edits:
//   → AI raises confidence threshold → more content auto-publishes
//   → Fewer items in "Needs Attention"
//   → AI message: "You've approved 47 posts in a row without changes.
//      Want me to just publish directly and send you a daily summary?"

// If the human edits 40% of content:
//   → AI lowers confidence threshold → more content sent for review
//   → AI studies the edits → learns what to change
//   → Over time, edit rate drops as AI improves

// If the human rejects content:
//   → AI analyzes why → adjusts future output
//   → Asks: "I noticed you rejected the last 3 posts with questions in
//      the hook. Want me to stop using questions as hooks?"

async function adaptConfidence(organizationId: string) {
  const last30 = await prisma.contentReview.findMany({
    where: {
      organizationId,
      createdAt: { gte: subDays(new Date(), 30) },
    },
  });

  const approvalRate = last30.filter(r => r.approved).length / last30.length;
  const editRate = last30.filter(r => r.wasEdited).length / last30.length;

  if (approvalRate > 0.95 && editRate < 0.05) {
    // Suggest upgrading to autonomous
    await createAttentionItem(organizationId, {
      type: "ai_suggestion",
      message: "You've approved 95% of my content without changes. Want to switch to fully autonomous mode?",
      actions: ["Yes, go autonomous", "No, keep reviewing"],
    });
  }

  // Adjust threshold continuously
  const newThreshold = calculateOptimalThreshold(approvalRate, editRate);
  await prisma.organizationConfig.update({
    where: { organizationId },
    data: { confidenceThreshold: newThreshold },
  });
}
```

---

## PART 7: WHAT HAPPENS TO ALL THOSE MENUS?

Everything that was a menu/settings page becomes either:
- **Automatic** (AI handles it, no human input needed)
- **Conversational** (human tells the AI via "Talk to AI")
- **Mission Control** (shown as information, not controls)

| Old Menu Item | New Approach |
|--------------|-------------|
| Content Editor | AI generates. Human approves/edits inline. No CMS. |
| Content Calendar | "Coming Up" section in Mission Control. Read-only. |
| Analytics Dashboard | Metrics strip + Weekly Pulse + "Talk to AI: what's working?" |
| Settings > Posting Schedule | Set by AI in onboarding. Change via "Talk to AI". |
| Settings > Brand Voice | Detected by AI. Refined through corrections. Change via "Talk to AI". |
| Settings > Competitors | Set in onboarding conversation. Add via "Talk to AI". |
| Settings > Compliance | Automatic based on industry. AI manages rules. |
| Settings > Team | Invite link in profile menu. Minimal. |
| Settings > Billing | Stripe customer portal. One link. |
| Reports | Emailed automatically. Archive accessible from Weekly Pulse. |
| Influencer Pipeline | AI handles. Surfaces candidates in "Needs Attention" when found. |
| UGC Pipeline | AI handles. Shows UGC wins in "Wins" section. |
| Review Responses | AI handles. Escalates if needed. |
| Crisis Management | AI handles. Full-screen takeover if crisis detected. |
| A/B Testing | AI handles automatically. Reports results in Weekly Pulse. |
| Hashtag Strategy | AI handles. Invisible to human. |
| SEO Optimization | AI handles. Invisible to human. |
| Calendar Optimization | AI handles. Invisible to human. |
| Competitor Ad Monitoring | AI handles. Alerts in Activity feed if noteworthy. |

---

## PART 8: CRISIS MODE — FULL-SCREEN TAKEOVER

When the AI detects a crisis, Mission Control transforms:

```
┌──────────────────────────────────────────────────────────────────┐
│  🔴 CRISIS MODE — Content paused                   [Talk to AI] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  Negative mention spike detected                             │
│                                                                  │
│  What's happening:                                               │
│  "A customer posted a video claiming your moisturizer caused     │
│   a skin reaction. The video has 15K views and 200+ comments    │
│   in the last 2 hours. Sentiment is 78% negative."              │
│                                                                  │
│  What I've done:                                                 │
│  ✅ Paused all scheduled content                                 │
│  ✅ Paused auto-replies on all platforms                         │
│  ✅ Drafted 3 response options below                             │
│                                                                  │
│  Recommended response:                                           │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ "We're sorry to hear about your experience. Your     │       │
│  │  skin's comfort is our top priority. We'd love to    │       │
│  │  learn more — please DM us so we can help directly   │       │
│  │  and make this right."                                │       │
│  │                                                       │       │
│  │  [✅ Approve & Post]  [✏️ Edit]  [See other options]  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  📈 Live monitoring (updates every 5 min):                       │
│  Mentions: 47 → 52 → 58 (still rising)                          │
│  Sentiment: 78% negative (stable)                                │
│                                                                  │
│  [Resume normal operations]                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## PART 9: MOBILE-FIRST

The mission control is designed for mobile as the PRIMARY device:

- Metrics strip: horizontal scroll on mobile
- Needs Attention: full-width cards with large tap targets
- Approve All: massive button, easy one-thumb tap
- Activity feed: vertical scroll, natural mobile pattern
- Talk to AI: full-screen chat, keyboard-first
- Push notifications drive all actions — user doesn't need to open the app to check

---

## Build Order

1. **Onboarding conversation engine** — the AI chat flow with structured extraction
2. **Mission Control layout** — the single screen with all sections
3. **Needs Attention system** — the only action center
4. **Content review flow** — inline preview + one-tap approve
5. **AI Activity feed** — real-time agent activity aggregation
6. **Talk to AI** — Claude-powered command interface with tools
7. **Notification system** — push + email + in-app
8. **Adaptive confidence** — auto-adjusting based on behavior
9. **Crisis mode overlay** — full-screen takeover
10. **Mobile optimization** — responsive + PWA

---

## Rules

1. **The human should NEVER need to navigate.** Everything comes to them via notifications or Mission Control.
2. **Every interaction should be one tap or one sentence.** No multi-step workflows.
3. **The AI explains itself.** Activity feed shows what it's doing and why.
4. **No jargon.** "Engagement rate" is fine. "Confidence threshold" is not. Speak human.
5. **Celebrate wins.** The human should feel good about what the AI is doing for them.
6. **Admit mistakes.** If a post underperforms, the AI says "that one didn't land — here's what I'm changing."
7. **Progressive trust.** Start with more human involvement, earn autonomy through good performance.
8. **ZERO settings pages.** Everything is conversational or automatic.
