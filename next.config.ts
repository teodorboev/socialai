import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  reactCompiler: true,

  // PostHog reverse proxy — routes through Next.js to avoid tracking blockers
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  // Power-up production deployments with standalone output
  output: 'standalone',

  // Security enhancements
  poweredByHeader: false,

  // Experimental and modern features optimized for Vercel
  experimental: {
    // Partial Prerendering is now enabled via cacheComponents in Next.js 16
    cacheComponents: true,
    taint: true,
    // Increased for handling media assets (images/videos) in social workflows
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Optimize cold starts by pre-bundling common large packages
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@supabase/supabase-js",
      "framer-motion"
    ],
  },

  // Image optimization for external providers
  images: {
    // Enable AVIF for superior compression on Vercel's edge
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
      },
      {
        protocol: 'https',
        hostname: 'ideogram.ai',
      },
    ],
  },

  // Enhanced logging for development
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

// Sentry configuration for automatic instrumentation and source maps
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-javascript/blob/master/packages/nextjs/src/config/types.ts

  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Webpack-specific optimizations for Sentry (recommended for v10+)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    // Enables automatic instrumentation of Vercel Cron Monitors (moved to webpack in v10)
    automaticVercelMonitors: true,
  },

  // Upload a larger set of source maps for better stack traces
  widenClientFileUpload: true,

  // Route browser requests through a Next.js rewrite
  tunnelRoute: "/monitoring",
});
