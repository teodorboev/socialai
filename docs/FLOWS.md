# SocialAI Platform - Flow Documentation

> Comprehensive documentation of all major data flows and agent interactions in the SocialAI platform.

---

## Table of Contents

1. [Content Pipeline](#content-pipeline)
2. [Publishing Flow](#publishing-flow)
3. [Engagement Flow](#engagement-flow)
4. [Analytics Flow](#analytics-flow)
5. [Agent Orchestration](#agent-orchestration)
6. [Onboarding Flow](#onboarding-flow)
7. [Billing Flow](#billing-flow)
8. [Crisis Response Flow](#crisis-response-flow)

---

## Content Pipeline

### Overview

The content pipeline handles the end-to-end creation, approval, and scheduling of social media content.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Strategy       │───▶│  Content         │───▶│  Compliance    │───▶│  Review       │
│  Agent          │    │  Creator         │    │  Agent         │    │  Queue        │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └────────────────┘
                                                                              │
                              ┌──────────────────────────────────────────────┘
                              ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Published      │◀───│  Publisher       │◀───│  Scheduled      │◀───│  Calendar      │
│                 │    │  Agent           │    │  Queue          │    │  Optimizer     │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └────────────────┘
```

### Step-by-Step Flow

#### 1. Strategy Agent (Monthly)

**Trigger**: Cron job monthly or manual trigger

**Input**:
- Organization ID
- Brand configuration
- Previous content performance
- Competitor analysis
- Business goals

**Output**: `ContentPlan`
```typescript
{
  periodStart: Date,
  periodEnd: Date,
  themes: string[],
  platformMix: { [platform]: percentage },
  postsPerWeek: { [platform]: count },
  strategy: string // Full strategy document
}
```

**Database**: Creates `ContentPlan` record with status `DRAFT` or `ACTIVE`

---

#### 2. Content Creator Agent (On-Demand)

**Trigger**: 
- Scheduled (every 6 hours via Inngest)
- Manual trigger from dashboard
- Content replenishment agent

**Input**:
```typescript
{
  organizationId: string,
  platform: Platform,
  brandConfig: {
    brandName: string,
    voiceTone: VoiceTone,
    contentThemes: string[],
    doNots: string[],
    targetAudience: Audience,
    hashtagStrategy: HashtagStrategy
  },
  contentPlanContext?: string,    // From Strategy Agent
  trendContext?: string,           // From Trend Scout Agent
  previousTopPerformers?: Content[] // For inspiration
}
```

**Process**:
1. Loads brand voice from database
2. Calls SmartRouter for LLM classification (tier: mid)
3. Generates content using Claude Sonnet
4. Parses response against Zod schema
5. Calculates confidence score

**Output**:
```typescript
{
  caption: string,
  hashtags: string[],
  contentType: ContentType,
  mediaPrompt?: string,     // For Visual Agent
  altText?: string,
  confidenceScore: number,  // 0-1
  reasoning: string
}
```

**Database**: Creates `Content` record
- Status: `PENDING_REVIEW` (default) or `APPROVED` (if confidence ≥ auto-publish threshold)

**Confidence Thresholds** (configurable per org):
```typescript
const DEFAULT_THRESHOLDS = {
  autoPublish: 0.90,    // Auto-approve and schedule
  flagForReview: 0.75, // Approve but flag for visibility
  requireReview: 0.50   // Must be reviewed by human
};
```

---

#### 3. Compliance Agent

**Trigger**: After Content Creator, before publishing

**Input**:
- Content ID
- Platform
- Brand configuration

**Process**:
1. Checks against safety config (blocked words, crisis keywords)
2. Validates against platform-specific guidelines
3. Checks FTC compliance for claims
4. Validates hashtag usage

**Output**:
```typescript
{
  isCompliant: boolean,
  issues: ComplianceIssue[],
  confidenceScore: number
}
```

**Database**: Updates `Content` record if issues found

---

#### 4. Review Queue

**Trigger**: Human intervention

**Dashboard**: `/dashboard/review`

**Actions**:
- **Approve**: Content moves to `APPROVED` status
- **Reject**: Content moves to `REJECTED` with rejection reason
- **Edit**: Human can modify before approving

---

#### 5. Calendar Optimizer

**Trigger**: Before scheduling, or manual trigger

**Input**:
- Current schedule
- Engagement data (last 30 days)
- Audience activity patterns

**Output**:
```typescript
{
  optimizedSchedule: [{
    platform: string,
    dayOfWeek: number,
    timeUtc: string,
    contentTypes: string[],
    frequency: { postsPerWeek: number },
    confidence: number
  }],
  expectedImprovement: {
    engagementIncrease: number,
    reachIncrease: number
  }
}
```

---

#### 6. Scheduling

**Trigger**: Content approved, scheduled time reached

**Database**: Creates `Schedule` record
```typescript
{
  contentId: string,
  socialAccountId: string,
  scheduledFor: DateTime,
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED"
}
```

---

## Publishing Flow

### Overview

```
┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Inngest       │───▶│  Publisher      │───▶│  Platform API  │
│  Cron          │    │  Agent          │    │  (Meta/TikTok)│
└────────────────┘    └─────────────────┘    └────────────────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │  Update Status  │
                    │  + Log Result   │
                    └─────────────────┘
```

### Step-by-Step Flow

#### 1. Scheduled Job (Inngest)

**Cron**: Every 5 minutes

**Process**:
1. Query `Schedule` table for due items:
   ```sql
   SELECT * FROM schedules 
   WHERE status = 'PENDING' 
   AND scheduled_for <= NOW()
   LIMIT 50
   ```

2. For each scheduled item:
   - Update status to `PUBLISHING`
   - Call Publisher Agent

---

#### 2. Publisher Agent

**Input**:
```typescript
{
  contentId: string,
  socialAccountId: string,
  platform: Platform,
  accessToken: string
}
```

**Process**:
1. Fetch content from database
2. Get platform-specific client (Meta/TikTok/Twitter/LinkedIn)
3. Format content for platform
4. Upload media if present
5. Publish via platform API
6. Handle rate limits and retries

**Platform Support**:
| Platform | API | Upload Method |
|----------|-----|---------------|
| Instagram | Meta Graph API | `POST /{ig-user-id}/media` |
| Facebook | Meta Graph API | `POST /{page-id}/feed` |
| TikTok | TikTok API | `POST /v2/post/publish/video/` |
| Twitter/X | Twitter API v2 | `POST /tweets` |
| LinkedIn | LinkedIn API | `POST /ugcPosts` |

**Retry Strategy**:
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: [60000, 300000, 900000] // 1min, 5min, 15min
};
```

---

#### 3. Post-Publish

**Success**:
1. Update `Schedule` status to `PUBLISHED`
2. Update `Content` status to `PUBLISHED`
3. Set `publishedAt` timestamp
4. Log success to `AgentLog`

**Failure**:
1. Update `Schedule` status to `FAILED`
2. Increment `retryCount`
3. Store error message
4. If retries remaining, reschedule
5. Log failure to `AgentLog`

---

## Engagement Flow

### Overview

```
┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Platform      │───▶│  Engagement     │───▶│  Response      │
│  Webhooks      │    │  Monitor        │    │  Decision     │
└────────────────┘    └─────────────────┘    └────────────────┘
                                                      │
                         ┌───────────────────────────┼───────────────────────────┐
                         ▼                           ▼                           ▼
                  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
                  │  Auto       │            │  Queue for  │            │  Escalate   │
                  │  Respond    │            │  Review     │            │  to Human   │
                  └─────────────┘            └─────────────┘            └─────────────┘
```

### Step-by-Step Flow

#### 1. Engagement Monitor (Inngest)

**Cron**: Every 15 minutes

**Process**:
1. For each active social account:
   - Poll platform API for new comments/DMs
   - Store new engagements in database

**Database**: Creates `Engagement` records
```typescript
{
  organizationId: string,
  socialAccountId: string,
  platformEngagementId: string,
  engagementType: "COMMENT" | "DIRECT_MESSAGE" | "MENTION",
  authorName: string,
  authorUsername: string,
  body: string,
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "URGENT",
  aiResponseStatus: "PENDING"
}
```

---

#### 2. Engagement Agent

**Trigger**: New engagement detected

**Input**:
```typescript
{
  organizationId: string,
  platform: Platform,
  brandConfig: {
    brandName: string,
    voiceTone: VoiceTone,
    faqKnowledge: FAQ[],
    doNots: string[]
  },
  engagementType: string,
  authorName: string,
  body: string,
  contentContext?: string,  // Original post being commented on
  conversationHistory?: Message[]
}
```

**Process**:
1. Analyze sentiment
2. Check against FAQ knowledge base
3. Determine if response needed
4. Generate response if appropriate
5. Calculate confidence score

**Output**:
```typescript
{
  response: string,
  sentiment: Sentiment,
  confidenceScore: number,
  shouldRespond: boolean,
  reasoning: string
}
```

**Decision Matrix**:
| Sentiment | Confidence | Action |
|-----------|------------|--------|
| URGENT | Any | Escalate |
| NEGATIVE | < 0.7 | Escalate |
| NEGATIVE | ≥ 0.7 | Respond (helpful, not defensive) |
| NEUTRAL | ≥ 0.7 | Respond if valuable |
| POSITIVE | Any | Respond (appreciate) |
| SPAM/TROLL | Any | Skip + Flag |

---

#### 3. Response Handling

**Auto-Respond** (confidence ≥ 0.85):
1. Post response via platform API
2. Update `Engagement` record with response
3. Set `aiResponseStatus` to `AUTO_RESPONDED`
4. Log to `AgentLog`

**Queue for Review** (0.7 ≤ confidence < 0.85):
1. Add to review queue
2. Set `aiResponseStatus` to `PENDING_REVIEW`

**Escalate** (confidence < 0.7 or URGENT):
1. Create `Escalation` record
2. Set `aiResponseStatus` to `PENDING_REVIEW`
3. Send notification (Supabase Realtime + email)

---

## Analytics Flow

### Overview

```
┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Platform      │───▶│  Analytics      │───▶│  Reporting     │
│  APIs          │    │  Agent          │    │  Narrator      │
└────────────────┘    └─────────────────┘    └────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Snapshots      │
                       │  + Trends       │
                       └─────────────────┘
```

### Step-by-Step Flow

#### 1. Data Collection (Inngest)

**Cron**: Daily at midnight UTC

**Process**:
1. For each active social account:
   - Fetch metrics from platform API
   - Store in `AnalyticsSnapshot`

**Metrics Collected**:
```typescript
{
  snapshotDate: Date,
  followers: number,
  followersChange: number,
  impressions: number,
  reach: number,
  engagementRate: number,
  clicks: number,
  shares: number,
  saves: number,
  topContent: Content[]  // Top 5 performing posts
}
```

---

#### 2. Analytics Agent

**Trigger**: Weekly (or manual)

**Input**:
```typescript
{
  organizationId: string,
  dateRange: { start: Date, end: Date },
  platforms: Platform[],
  includeCompetitors: boolean
}
```

**Process**:
1. Aggregate data from `AnalyticsSnapshot`
2. Calculate trends (week-over-week)
3. Identify top/bottom performing content
4. Generate insights

**Output**:
```typescript
{
  summary: {
    totalPosts: number,
    avgEngagement: number,
    totalReach: number,
    followerGrowth: number
  },
  byPlatform: PlatformMetrics[],
  topContent: ContentPerformance[],
  trends: Trend[],
  recommendations: string[]
}
```

---

#### 3. Reporting Narrator

**Trigger**: After Analytics Agent

**Process**:
1. Takes raw metrics
2. Generates narrative explanation
3. Creates charts/visualizations

**Output**: Markdown/HTML report

**Example**:
> Your engagement rate increased 23% this week compared to last week. This was driven primarily by your Reels content, which averaged 4.2% engagement vs. 1.8% for static posts. Your audience is most active between 6-8 PM EST...

---

## Agent Orchestration

### Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Orchestrator                                    │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  Cron Jobs   │  │  Webhooks    │  │  Manual      │                │
│  │  (Inngest)   │  │  (Platform)  │  │  Triggers    │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│          │                │                │                            │
│          └────────────────┼────────────────┘                            │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    Decision Engine                                 │ │
│  │                                                                   │ │
│  │  1. Check entitlements (canRunAgent)                            │ │
│  │  2. Check confidence thresholds                                   │ │
│  │  3. Determine action (auto/review/escalate)                      │ │
│  │  4. Log to AgentLog                                              │ │
│  │  5. Create Escalation if needed                                  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                           │                                             │
│           ┌──────────────┼──────────────┐                             │
│           ▼              ▼              ▼                             │
│    ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│    │  Execute   │  │   Queue    │  │  Escalate  │                    │
│    │  Agent     │  │  for       │  │  to        │                    │
│    │            │  │  Review    │  │  Human     │                    │
│    └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Priority System

| Priority | Agents | Queue |
|----------|--------|-------|
| CRITICAL | Crisis Response, Review Response | Immediate |
| HIGH | Content Creator, Engagement | Every 6 hours |
| MEDIUM | Analytics, Trend Scout | Daily |
| LOW | Strategy, Reporting | Weekly |

---

### Circuit Breaker

If an agent fails 3 times in a row:
1. Pause the agent
2. Log error
3. Create escalation
4. Notify via email

---

## Onboarding Flow

### Overview

```
┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Sign Up       │───▶│  Brand          │───▶│  Connect       │
│                │    │  Questionnaire  │    │  Accounts      │
└────────────────┘    └─────────────────┘    └────────────────┘
                                                    │
                         ┌───────────────────────────┘
                         ▼
                  ┌─────────────────┐    ┌────────────────┐
                  │  Onboarding     │───▶│  Strategy      │
                  │  Intelligence   │    │  Agent         │
                  └─────────────────┘    └────────────────┘
                                                 │
                         ┌───────────────────────────┘
                         ▼
                  ┌─────────────────┐
                  │  First Content  │
                  │  Ready!         │
                  └─────────────────┘
```

### Step-by-Step Flow

#### 1. Sign Up

**Process**:
1. User signs up via Supabase Auth
2. Creates Organization record
3. Sets up billing (Stripe)
4. Assigns owner role

#### 2. Brand Questionnaire

**Questions**:
- Brand name
- Industry
- Target audience demographics
- Voice/tone preferences
- Content themes
- Competitors
- Do's and don'ts
- FAQ knowledge base

**Database**: Creates `BrandConfig` record

#### 3. Connect Accounts

**OAuth Flow**:
1. User clicks "Connect Instagram"
2. Redirect to platform OAuth
3. User authorizes
4. Callback stores tokens (encrypted)
5. Creates `SocialAccount` record

#### 4. Onboarding Intelligence Agent

**Trigger**: After accounts connected

**Process**:
1. Analyzes existing content (last 90 days)
2. Identifies what worked/didn't
3. Generates brand profile
4. Creates initial content strategy

**Output**: Full brand profile + first month plan

---

## Billing Flow

### Overview

```
┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Plan          │───▶│  Subscription   │───▶│  Usage         │
│  Selection     │    │  Created        │    │  Tracking      │
└────────────────┘    └─────────────────┘    └────────────────┘
                              │                        │
                              │                        ▼
                              │               ┌────────────────┐
                              │               │  Alerts +      │
                              │               │  Limits        │
                              │               └────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Webhooks       │
                       │  (Stripe)       │
                       └─────────────────┘
```

### Step-by-Step Flow

#### 1. Plan Selection

**Plans**:
| Plan | Price | Platforms | Features |
|------|-------|-----------|----------|
| STARTER | $29/mo | 2 | Core agents |
| GROWTH | $79/mo | 5 | + Growth agents |
| PRO | $199/mo | Unlimited | All agents |
| ENTERPRISE | Custom | Unlimited | White label |

#### 2. Subscription Creation

**Process**:
1. User selects plan
2. Stripe Checkout session created
3. User pays
4. Webhook receives `checkout.session.completed`
5. Creates subscription record

#### 3. Usage Tracking

**Events Tracked**:
- Posts published
- AI agent calls
- Storage used

**Database**: `OrganizationUsage` record per month

#### 4. Limits Enforcement

**Check before action**:
```typescript
const entitlements = await getEntitlements(orgId);
if (!entitlements.canPublish) {
  return { allowed: false, reason: "plan_limit_reached" };
}
```

#### 5. Billing Webhooks

| Event | Action |
|-------|--------|
| `invoice.payment_succeeded` | Continue service |
| `invoice.payment_failed` | Send dunning email, pause after 7 days |
| `customer.subscription.deleted` | Downgrade to free, notify |
| `usage_threshold.exceeded` | Notify, upgrade prompt |

---

## Crisis Response Flow

### Overview

```
┌────────────────┐    ┌─────────────────┐    ┌────────────────┐
│  Detection     │───▶│  Crisis         │───▶│  Human         │
│  (Auto/Manual) │    │  Response       │    │  Notification  │
└────────────────┘    └─────────────────┘    └────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Pause          │
                       │  Publishing     │
                       └─────────────────┘
```

### Triggers

**Automatic**:
- Viral negative post
- Crisis keyword detected
- Sentiment drops > 30% in 1 hour

**Manual**:
- User marks as crisis

### Response Actions

1. **Pause all scheduled content**
2. **Create escalation** (CRITICAL priority)
3. **Generate holding statement** template
4. **Notify all org members**
5. **Log to AgentLog**

---

## Data Models

### Key Tables

| Table | Purpose |
|-------|---------|
| `Organization` | Tenant record |
| `OrgMember` | User-org mapping with roles |
| `SocialAccount` | Connected platform accounts |
| `BrandConfig` | Brand voice, tone, preferences |
| `Content` | Posts, drafts, scheduled items |
| `Schedule` | Publishing schedule |
| `Engagement` | Comments, DMs, mentions |
| `ContentPlan` | Monthly content strategy |
| `AnalyticsSnapshot` | Daily metrics |
| `AgentLog` | Audit trail |
| `Escalation` | Items needing human attention |

---

## Error Handling

### Agent Error Recovery

```
Agent Execution
      │
      ▼
┌─────────────┐
│   Success   │────▶ Log + Return result
└─────────────┘
      │
      ▼
┌─────────────┐
│   Error     │────▶ Log error + Create Escalation
└─────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Retry Logic (3 attempts)           │
│  - Exponential backoff               │
│  - If all fail: Escalate             │
└─────────────────────────────────────┘
```

---

## Monitoring

### Key Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Content Pipeline Success | > 95% | < 90% |
| Publishing Success | > 98% | < 95% |
| Auto-Response Rate | > 80% | < 70% |
| Escalation Rate | < 10% | > 15% |
| AI Cost per Post | < $0.50 | > $1.00 |

---

*Last updated: February 2026*
