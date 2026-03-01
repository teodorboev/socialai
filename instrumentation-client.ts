import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Only initialize PostHog if key is present and valid
if (POSTHOG_KEY && POSTHOG_KEY.startsWith("phc_")) {
  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
    // Include the defaults option as required by PostHog
    defaults: "2026-01-30",
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Turn on debug in development mode
    debug: process.env.NODE_ENV === "development",
  });
} else {
  // PostHog not configured - skip initialization
  console.warn("PostHog not initialized: missing or invalid API key");
}

// IMPORTANT: Never combine this approach with other client-side PostHog initialization
// approaches, especially components like a PostHogProvider. instrumentation-client.ts
// is the correct solution for initializing client-side PostHog in Next.js 15.3+ apps.
