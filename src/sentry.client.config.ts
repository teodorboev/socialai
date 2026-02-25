import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",
    
    // Performance monitoring
    tracesSampleRate: 1.0,
    
    // Session replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Environment
    environment: process.env.NODE_ENV,
    
    // Ignore certain errors
    ignoreErrors: [
      "NetworkError when attempting to fetch resource",
      "Failed to fetch",
    ],
    
    // Before sending, can modify data
    beforeSend(event, hint) {
      // Don't capture certain errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Don't capture aborted requests
        if (error.message === "Aborted") {
          return null;
        }
      }
      return event;
    },
  });
}
