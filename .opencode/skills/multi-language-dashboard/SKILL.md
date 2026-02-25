---
name: multi-language-dashboard
description: "Full i18n support for the dashboard UI. Spanish, Portuguese, French, German, Japanese, Arabic, and more. Unlocks international markets. Uses next-intl with DB-backed translation overrides."
---

# SKILL: Multi-Language Dashboard

> This is NOT an agent — it's a platform feature skill for internationalizing the entire UI.

---

## Purpose

The agents already support content localization. But if the dashboard itself is English-only, you're locked out of entire markets. This skill adds full internationalization (i18n) to every UI surface — dashboard, viewer portal, onboarding, emails, notifications, and error messages. Supports RTL languages (Arabic, Hebrew). Lets agencies and white-label partners override translations.

---

## File Location

```
lib/i18n/config.ts
lib/i18n/dictionaries/
lib/i18n/dictionaries/en.json
lib/i18n/dictionaries/es.json
lib/i18n/dictionaries/pt-BR.json
lib/i18n/dictionaries/fr.json
lib/i18n/dictionaries/de.json
lib/i18n/dictionaries/ja.json
lib/i18n/dictionaries/ar.json
lib/i18n/dictionaries/zh-CN.json
lib/i18n/dictionaries/ko.json
lib/i18n/dictionaries/it.json
lib/i18n/middleware.ts
app/[locale]/(dashboard)/layout.tsx
app/[locale]/(viewer)/layout.tsx
```

---

## Supported Languages (Phase 1)

| Language | Code | Direction | Market |
|----------|------|-----------|--------|
| English | en | LTR | Default, US/UK/AU |
| Spanish | es | LTR | Latin America, Spain (500M+ speakers) |
| Portuguese (BR) | pt-BR | LTR | Brazil (215M population) |
| French | fr | LTR | France, Canada, West Africa |
| German | de | LTR | DACH region |
| Japanese | ja | LTR | Japan |
| Arabic | ar | **RTL** | Middle East, North Africa |
| Simplified Chinese | zh-CN | LTR | China (limited social platforms) |
| Korean | ko | LTR | South Korea |
| Italian | it | LTR | Italy |

Phase 2: Hindi, Turkish, Dutch, Polish, Thai, Indonesian, Vietnamese

---

## Technical Architecture

### next-intl Setup

```typescript
// lib/i18n/config.ts
export const locales = ["en", "es", "pt-BR", "fr", "de", "ja", "ar", "zh-CN", "ko", "it"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ar: "العربية",
  "zh-CN": "简体中文",
  ko: "한국어",
  it: "Italiano",
};

export const rtlLocales: Locale[] = ["ar"];
```

### Routing with proxy.ts

```typescript
// proxy.ts — Next.js 16 replaces middleware.ts with proxy.ts
import { locales, defaultLocale } from "@/lib/i18n/config";

export function proxy(request: Request) {
  const pathname = new URL(request.url).pathname;

  // Check if pathname starts with a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return; // Already has locale, continue

  // Detect locale from:
  // 1. User preference (stored in cookie)
  // 2. Accept-Language header
  // 3. Default to "en"
  const cookieLocale = request.headers.get("cookie")?.match(/NEXT_LOCALE=([^;]+)/)?.[1];
  const acceptLanguage = request.headers.get("accept-language");
  const detectedLocale = cookieLocale || detectLocaleFromHeader(acceptLanguage) || defaultLocale;

  // Redirect to locale-prefixed path
  return Response.redirect(new URL(`/${detectedLocale}${pathname}`, request.url));
}

function detectLocaleFromHeader(header: string | null): Locale | null {
  if (!header) return null;
  // Parse Accept-Language and match to supported locales
  // "es-MX,es;q=0.9,en;q=0.8" → "es"
  for (const locale of locales) {
    if (header.includes(locale) || header.includes(locale.split("-")[0])) {
      return locale;
    }
  }
  return null;
}
```

### Layout with Direction Support

```typescript
// app/[locale]/(dashboard)/layout.tsx
import { rtlLocales, type Locale } from "@/lib/i18n/config";

export default function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const dir = rtlLocales.includes(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body className={dir === "rtl" ? "font-arabic" : "font-sans"}>
        <IntlProvider locale={locale}>
          {children}
        </IntlProvider>
      </body>
    </html>
  );
}
```

---

## Dictionary Structure

```json
// lib/i18n/dictionaries/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "error": "Something went wrong",
    "success": "Success",
    "confirm": "Are you sure?",
    "search": "Search...",
    "noResults": "No results found",
    "back": "Back",
    "next": "Next",
    "previous": "Previous",
    "viewAll": "View all",
    "learnMore": "Learn more"
  },
  "nav": {
    "dashboard": "Dashboard",
    "content": "Content",
    "calendar": "Calendar",
    "analytics": "Analytics",
    "engagement": "Engagement",
    "competitors": "Competitors",
    "influencers": "Influencers",
    "listening": "Listening",
    "reports": "Reports",
    "settings": "Settings",
    "aiTraining": "AI Training"
  },
  "dashboard": {
    "overview": "Overview",
    "welcomeBack": "Welcome back, {name}",
    "healthScore": "Brand Health Score",
    "followers": "Followers",
    "engagement": "Engagement Rate",
    "reach": "Reach",
    "scheduledPosts": "Scheduled Posts",
    "pendingReview": "Pending Review",
    "recentWins": "Recent Wins",
    "quickActions": "Quick Actions"
  },
  "content": {
    "createPost": "Create Post",
    "drafts": "Drafts",
    "scheduled": "Scheduled",
    "published": "Published",
    "rejected": "Rejected",
    "approve": "Approve",
    "reject": "Reject",
    "reschedule": "Reschedule",
    "repurpose": "Repurpose",
    "predictedPerformance": "Predicted Performance",
    "confidenceScore": "Confidence Score",
    "caption": "Caption",
    "hashtags": "Hashtags",
    "platform": "Platform",
    "scheduledFor": "Scheduled for {date}",
    "publishedOn": "Published on {date}",
    "engagementRate": "{rate}% engagement",
    "noContent": "No content yet. Create your first post!"
  },
  "analytics": {
    "title": "Analytics",
    "dateRange": "Date Range",
    "last7days": "Last 7 days",
    "last30days": "Last 30 days",
    "last90days": "Last 90 days",
    "custom": "Custom range",
    "followerGrowth": "Follower Growth",
    "engagementTrend": "Engagement Trend",
    "topPosts": "Top Performing Posts",
    "platformComparison": "Platform Comparison",
    "roi": "ROI Summary",
    "traffic": "Website Traffic from Social",
    "conversions": "Conversions",
    "revenue": "Revenue Attributed"
  },
  "engagement": {
    "title": "Engagement",
    "inbox": "Inbox",
    "comments": "Comments",
    "directMessages": "Direct Messages",
    "reviews": "Reviews",
    "reply": "Reply",
    "markResolved": "Mark as Resolved",
    "escalate": "Escalate",
    "sentiment": "Sentiment",
    "autoResponded": "Auto-responded",
    "awaitingReview": "Awaiting Review"
  },
  "settings": {
    "title": "Settings",
    "general": "General",
    "team": "Team",
    "billing": "Billing",
    "connectedAccounts": "Connected Accounts",
    "brandVoice": "Brand Voice",
    "aiPreferences": "AI Preferences",
    "notifications": "Notifications",
    "viewerDashboard": "Viewer Dashboard",
    "competitors": "Competitors",
    "compliance": "Compliance Rules",
    "locales": "Localization",
    "dangerZone": "Danger Zone"
  },
  "agents": {
    "contentCreator": "Content Creator",
    "engagement": "Engagement",
    "publisher": "Publisher",
    "analytics": "Analytics",
    "strategy": "Strategy",
    "trendScout": "Trend Scout",
    "visual": "Visual",
    "compliance": "Compliance",
    "crisisResponse": "Crisis Response",
    "confidenceLevel": "Confidence: {level}",
    "autoApproved": "Auto-approved",
    "needsReview": "Needs review",
    "escalated": "Escalated"
  },
  "crisis": {
    "title": "Crisis Detected",
    "severity": "Severity: {level}",
    "contentPaused": "All scheduled content has been paused",
    "responseTemplates": "Response Templates",
    "approve": "Approve & Send",
    "monitor": "Continue Monitoring",
    "resolve": "Mark as Resolved"
  },
  "onboarding": {
    "welcome": "Welcome to {appName}!",
    "connectAccount": "Connect your first social account",
    "analyzing": "Analyzing your social presence...",
    "reportReady": "Your brand intelligence report is ready",
    "viewReport": "View Report",
    "approveStrategy": "Approve & Start",
    "steps": {
      "connect": "Connect Accounts",
      "analyze": "AI Analysis",
      "review": "Review Strategy",
      "launch": "Launch"
    }
  },
  "errors": {
    "notFound": "Page not found",
    "unauthorized": "You don't have access to this page",
    "serverError": "Something went wrong on our end",
    "networkError": "Network error. Please check your connection.",
    "rateLimited": "Too many requests. Please try again in a moment.",
    "sessionExpired": "Your session has expired. Please log in again."
  },
  "notifications": {
    "contentApproved": "Content approved and scheduled",
    "contentRejected": "Content was rejected",
    "crisisDetected": "Crisis detected — content paused",
    "reportReady": "Your weekly report is ready",
    "newEscalation": "New escalation requires attention",
    "milestoneReached": "Congratulations! You reached {count} followers on {platform}"
  },
  "time": {
    "justNow": "Just now",
    "minutesAgo": "{count} minutes ago",
    "hoursAgo": "{count} hours ago",
    "daysAgo": "{count} days ago",
    "weeksAgo": "{count} weeks ago",
    "today": "Today",
    "yesterday": "Yesterday",
    "tomorrow": "Tomorrow"
  }
}
```

```json
// lib/i18n/dictionaries/es.json (example — Spanish)
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "loading": "Cargando...",
    "error": "Algo salió mal",
    "success": "Éxito",
    "confirm": "¿Estás seguro?",
    "search": "Buscar...",
    "noResults": "No se encontraron resultados",
    "back": "Atrás",
    "next": "Siguiente",
    "previous": "Anterior",
    "viewAll": "Ver todo",
    "learnMore": "Más información"
  },
  "nav": {
    "dashboard": "Panel",
    "content": "Contenido",
    "calendar": "Calendario",
    "analytics": "Analítica",
    "engagement": "Interacciones",
    "competitors": "Competidores",
    "influencers": "Influencers",
    "listening": "Escucha Social",
    "reports": "Informes",
    "settings": "Configuración",
    "aiTraining": "Entrenamiento IA"
  },
  "dashboard": {
    "overview": "Resumen",
    "welcomeBack": "Bienvenido de vuelta, {name}",
    "healthScore": "Puntuación de Salud de Marca",
    "followers": "Seguidores",
    "engagement": "Tasa de Interacción",
    "reach": "Alcance",
    "scheduledPosts": "Publicaciones Programadas",
    "pendingReview": "Pendiente de Revisión",
    "recentWins": "Logros Recientes",
    "quickActions": "Acciones Rápidas"
  },
  "content": {
    "createPost": "Crear Publicación",
    "drafts": "Borradores",
    "scheduled": "Programado",
    "published": "Publicado",
    "rejected": "Rechazado",
    "approve": "Aprobar",
    "reject": "Rechazar",
    "reschedule": "Reprogramar",
    "repurpose": "Reutilizar",
    "predictedPerformance": "Rendimiento Previsto",
    "confidenceScore": "Nivel de Confianza",
    "caption": "Texto",
    "hashtags": "Hashtags",
    "platform": "Plataforma",
    "scheduledFor": "Programado para {date}",
    "publishedOn": "Publicado el {date}",
    "engagementRate": "{rate}% de interacción",
    "noContent": "Sin contenido aún. ¡Crea tu primera publicación!"
  }
}
```

---

## Database

```prisma
model TranslationOverride {
  id              String   @id @default(uuid())
  organizationId  String?  // null = global override (Super Admin)
  locale          String
  key             String   // Dot notation: "nav.dashboard", "content.createPost"
  value           String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, locale, key])
  @@index([locale])
}

// User preference stored in the user's profile
// Add to existing User model or OrgMember model:
// preferredLocale  String?  @default("en")
```

---

## Translation Loading

```typescript
// lib/i18n/get-dictionary.ts
import type { Locale } from "./config";

const dictionaries: Record<Locale, () => Promise<Record<string, any>>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  es: () => import("./dictionaries/es.json").then((m) => m.default),
  "pt-BR": () => import("./dictionaries/pt-BR.json").then((m) => m.default),
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  de: () => import("./dictionaries/de.json").then((m) => m.default),
  ja: () => import("./dictionaries/ja.json").then((m) => m.default),
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
  "zh-CN": () => import("./dictionaries/zh-CN.json").then((m) => m.default),
  ko: () => import("./dictionaries/ko.json").then((m) => m.default),
  it: () => import("./dictionaries/it.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  const baseDictionary = await dictionaries[locale]();

  // Apply DB overrides (for white-label or org-specific tweaks)
  const overrides = await prisma.translationOverride.findMany({
    where: { locale, OR: [{ organizationId: null }, { organizationId: currentOrgId }] },
  });

  for (const override of overrides) {
    setNestedValue(baseDictionary, override.key, override.value);
  }

  return baseDictionary;
}
```

---

## Component Usage

```typescript
// In any component:
import { useTranslations } from "next-intl";

export function ContentHeader() {
  const t = useTranslations("content");

  return (
    <div>
      <h1>{t("createPost")}</h1>
      <p>{t("scheduledFor", { date: "March 15, 2026" })}</p>
    </div>
  );
}
```

---

## RTL Support

```css
/* globals.css — Tailwind v4 */
@theme {
  --font-arabic: "IBM Plex Arabic", "Noto Sans Arabic", sans-serif;
}

/* RTL-specific overrides */
[dir="rtl"] {
  /* Flip sidebar to right side */
  .sidebar { right: 0; left: auto; }

  /* Flip text alignment */
  .text-left { text-align: right; }
  .text-right { text-align: left; }

  /* Flip margins/paddings */
  .ml-auto { margin-right: auto; margin-left: 0; }
  .mr-auto { margin-left: auto; margin-right: 0; }
}
```

Use Tailwind's logical properties where possible:
- `ps-4` instead of `pl-4` (padding-inline-start)
- `pe-4` instead of `pr-4` (padding-inline-end)
- `ms-auto` instead of `ml-auto` (margin-inline-start)

---

## Email/Notification i18n

```typescript
// Notification emails also respect locale
async function sendNotificationEmail(userId: string, templateSlug: string, data: Record<string, any>) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const locale = user?.preferredLocale ?? "en";

  // Load email template for this locale
  const template = await prisma.emailTemplate.findFirst({
    where: { slug: templateSlug, locale },
  }) ?? await prisma.emailTemplate.findFirst({
    where: { slug: templateSlug, locale: "en" }, // Fallback to English
  });

  // Render and send
}
```

---

## Language Picker Component

```typescript
// components/language-picker.tsx
"use client";
import { locales, localeNames, type Locale } from "@/lib/i18n/config";
import { useRouter, usePathname } from "next/navigation";

export function LanguagePicker({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: Locale) {
    // Replace locale prefix in pathname
    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPath = segments.join("/");

    // Set cookie for persistence
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;

    // Save to user profile if logged in
    fetch("/api/user/locale", { method: "PATCH", body: JSON.stringify({ locale: newLocale }) });

    router.push(newPath);
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => switchLocale(e.target.value as Locale)}
      className="text-sm bg-transparent border rounded px-2 py-1"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeNames[locale]}
        </option>
      ))}
    </select>
  );
}
```

Placement: bottom of sidebar + settings page + onboarding page + viewer dashboard footer.

---

## Admin UI (Super Admin → Translations)

Super Admin can:
- View all translation keys across locales
- Override any translation globally
- Export/import translation files (for sending to professional translators)
- See translation coverage per locale (e.g., "Spanish: 94% translated")
- Mark keys as "needs review" after updates to English source

---

## Build Order

1. **Install next-intl**: `npm install next-intl`
2. **Create config + English dictionary**: The source of truth
3. **Set up routing**: proxy.ts locale detection + [locale] route group
4. **Migrate existing UI strings**: Replace hardcoded text with `t()` calls
5. **Add Spanish + Portuguese**: Highest-value markets
6. **Add RTL support**: CSS logical properties + Arabic dictionary
7. **Add remaining languages**: One at a time, with coverage tracking
8. **Add DB overrides**: For white-label customization
9. **Add language picker**: Sidebar, settings, onboarding
10. **Translate emails**: Notification templates per locale

---

## Rules

1. **Never hardcode UI strings.** Every user-visible string goes through the translation system.
2. **English is the source of truth.** All other dictionaries are translations of the English file.
3. **Use ICU message format** for plurals and interpolation: `{count, plural, one {# post} other {# posts}}`
4. **Fallback chain**: User preference → browser language → org default → English
5. **Date/number formatting**: Use `Intl.DateTimeFormat` and `Intl.NumberFormat` with the current locale — never format manually.
6. **Agent outputs are NOT translated by this system.** Content generation uses the Localization Agent. This skill handles only the UI.
7. **Track translation coverage.** Don't launch a locale until it's >90% translated.
