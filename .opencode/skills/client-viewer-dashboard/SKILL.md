---
name: client-viewer-dashboard
description: "Read-only branded dashboard for managed service clients to share with stakeholders. CEO sees metrics, calendar, reports — no agent controls. Makes clients look professional, increases stickiness."
---

# SKILL: Client Viewer Dashboard

> This is NOT an agent — it's a feature skill for building the client-facing viewer mode.

---

## Purpose

A read-only, branded dashboard that managed service clients can share with their stakeholders (CEO, CMO, board members, business partners). Shows performance metrics, content calendar, AI-generated reports, and upcoming content — without exposing any agent controls, settings, or internal operations. Makes the client's social media operation look polished and professional, which makes them sticky.

---

## File Location

```
app/(viewer)/layout.tsx
app/(viewer)/[orgSlug]/page.tsx
app/(viewer)/[orgSlug]/analytics/page.tsx
app/(viewer)/[orgSlug]/calendar/page.tsx
app/(viewer)/[orgSlug]/reports/page.tsx
app/(viewer)/[orgSlug]/content/page.tsx
lib/viewer/access.ts
lib/viewer/branding.ts
```

---

## Access Model

```typescript
// Three access levels:
// 1. Org Admin — full dashboard (existing)
// 2. Org Member — can review/approve content (existing)
// 3. Viewer — read-only, no controls, branded view (NEW)

interface ViewerAccess {
  type: "link" | "password" | "email_invite";

  // Link-based: anyone with the link can view (simple sharing)
  // Password: link + password protection
  // Email invite: specific email addresses get access via magic link
}
```

---

## Database

```prisma
model ViewerConfig {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Access
  isEnabled       Boolean  @default(false)
  accessType      String   @default("password") // "link", "password", "email_invite"
  password        String?  // Hashed, for password mode
  allowedEmails   String[] // For email_invite mode
  slug            String   @unique // URL-friendly org identifier: /view/acme-corp

  // Branding
  customLogo      String?  // Supabase Storage URL
  primaryColor    String   @default("#4A90D9")
  accentColor     String   @default("#50C878")
  headerText      String?  // "Acme Corp Social Media Dashboard"
  footerText      String?  // "Managed by [Agency Name]" or custom
  hideAgencyBranding Boolean @default(false) // For white-label agencies

  // Content visibility
  showAnalytics       Boolean @default(true)
  showContentCalendar Boolean @default(true)
  showReports         Boolean @default(true)
  showUpcomingContent Boolean @default(true)
  showCompetitorData  Boolean @default(false)
  showROIData         Boolean @default(true)
  showCommunityMetrics Boolean @default(false)

  // Reporting
  autoShareReports Boolean @default(false) // Auto-email reports to viewers
  reportRecipients String[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ViewerSession {
  id              String   @id @default(uuid())
  viewerConfigId  String
  viewerConfig    ViewerConfig @relation(fields: [viewerConfigId], references: [id], onDelete: Cascade)
  email           String?
  ipAddress       String?
  accessedAt      DateTime @default(now())
  lastActiveAt    DateTime @default(now())

  @@index([viewerConfigId, accessedAt])
}
```

---

## Routes

```
/view/[slug]                    → Overview: key metrics, recent wins, health score
/view/[slug]/analytics          → Charts: engagement, reach, follower growth, ROI
/view/[slug]/calendar           → Content calendar: past + upcoming, read-only
/view/[slug]/reports            → Narrative reports archive (PDF downloads)
/view/[slug]/content            → Published content gallery with performance data
```

No `/view/[slug]/settings`, no agent controls, no escalation queue, no prompt editor.

---

## Authentication Flow

```typescript
// proxy.ts — handle viewer auth separately from main dashboard auth
export default function proxy(request: NextRequest) {
  const isViewerRoute = request.nextUrl.pathname.startsWith("/view/");

  if (isViewerRoute) {
    // Check viewer-specific auth:
    // 1. "link" mode: allow all
    // 2. "password" mode: check viewer_session cookie
    // 3. "email_invite" mode: check magic link token
    return handleViewerAuth(request);
  }

  // Regular dashboard auth...
}
```

---

## Viewer Pages

### Overview Page
```typescript
// Shows at a glance:
// - Brand health score (from Sentiment Intelligence)
// - Key metrics cards: followers, engagement rate, reach, ROI
// - "Wins this week" section (from Reporting Narrator)
// - Content performance heatmap (by day/time)
// - Next 5 scheduled posts (titles only, no edit controls)
```

### Analytics Page
```typescript
// Charts (read-only):
// - Engagement rate over time (line chart, per platform)
// - Follower growth (area chart)
// - Content type performance (bar chart)
// - Platform comparison (radar chart)
// - ROI summary (if enabled): traffic, conversions, revenue
// - Best performing posts gallery
//
// Date range picker: last 7d, 30d, 90d, custom
// Platform filter
// Export as PDF button
```

### Calendar Page
```typescript
// Monthly calendar view:
// - Published posts: shown with green indicator + engagement metrics
// - Scheduled posts: shown with blue indicator + platform icon
// - Click any post: modal showing caption, image preview, metrics
// - NO edit, approve, reject, or reschedule controls
```

### Reports Page
```typescript
// Archive of all Reporting Narrator outputs:
// - Weekly performance reports
// - Monthly deep dives
// - Campaign reports
// - Each with: executive summary preview, full PDF download
// - Auto-generated, no manual work needed
```

---

## Branding System

```typescript
// lib/viewer/branding.ts
interface ViewerBranding {
  logo: string | null;
  primaryColor: string;
  accentColor: string;
  headerText: string;
  footerText: string;
  favicon?: string;
}

// Apply branding via CSS variables:
// <div style={{
//   '--primary': config.primaryColor,
//   '--accent': config.accentColor,
// }}>

// Tailwind: use CSS variable references
// className="bg-[var(--primary)] text-white"
```

---

## Admin UI (Dashboard → Settings → Viewer Dashboard)

```
┌─────────────────────────────────────────┐
│ Viewer Dashboard Settings               │
├─────────────────────────────────────────┤
│ ☑ Enable viewer dashboard               │
│                                         │
│ Access: ○ Anyone with link              │
│         ● Password protected            │
│         ○ Email invite only             │
│                                         │
│ Password: [••••••••]                    │
│                                         │
│ Your viewer link:                       │
│ https://app.socialai.com/view/acme-corp │
│ [Copy Link]                             │
│                                         │
│ Branding:                               │
│ Logo: [Upload]                          │
│ Primary color: [#4A90D9] [picker]       │
│ Header text: [Acme Corp Dashboard]      │
│ Footer text: [Managed by MarketPro]     │
│                                         │
│ Visible sections:                       │
│ ☑ Analytics  ☑ Calendar  ☑ Reports      │
│ ☑ Upcoming content  ☑ ROI data          │
│ ☐ Competitor data  ☐ Community metrics  │
│                                         │
│ Auto-share reports: ☐                   │
│ Report recipients: [emails...]          │
│                                         │
│ [Save Settings]                         │
└─────────────────────────────────────────┘
```

---

## Rules

1. **Strictly read-only.** No mutations, no approvals, no settings changes from viewer routes.
2. **No internal data leaks.** Viewer never sees: agent logs, confidence scores, escalations, system prompts, cost data, or internal notes.
3. **Sensitive data filtered.** Strip engagement agent conversations, DMs, and any PII from viewer-visible data.
4. **Session tracking.** Log viewer access for the org admin to see who's viewing and when.
5. **Mobile responsive.** CEOs check this on their phones. Must work perfectly on mobile.
6. **Fast loading.** Cache aggressively — viewer data only needs to refresh every 15-30 minutes.
