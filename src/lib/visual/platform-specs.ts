/**
 * Platform Specifications
 * All visual dimensions, aspect ratios, and safe zones for each platform
 */

export interface VisualSpec {
  width: number;
  height: number;
  ratio: string;
  maxFileSize?: string;
  maxSlides?: number;
  maxPages?: number;
  safeZone?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

export interface PlatformSpecs {
  [format: string]: VisualSpec;
}

export const PLATFORM_SPECS: Record<string, PlatformSpecs> = {
  instagram: {
    feed_square: {
      width: 1080,
      height: 1080,
      ratio: "1:1",
      maxFileSize: "30MB",
    },
    feed_portrait: {
      width: 1080,
      height: 1350,
      ratio: "4:5",
      maxFileSize: "30MB",
    },
    feed_landscape: {
      width: 1080,
      height: 566,
      ratio: "1.91:1",
      maxFileSize: "30MB",
    },
    story: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
      safeZone: { top: 250, bottom: 300 },
    },
    reel: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
      safeZone: { top: 200, bottom: 350 },
    },
    carousel: {
      width: 1080,
      height: 1080,
      ratio: "1:1",
      maxSlides: 10,
      maxFileSize: "30MB",
    },
    reel_cover: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
    },
    profile_picture: {
      width: 320,
      height: 320,
      ratio: "1:1",
    },
  },
  tiktok: {
    video: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
      safeZone: { top: 150, bottom: 400, right: 100 },
    },
    thumbnail: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
    },
    profile_picture: {
      width: 200,
      height: 200,
      ratio: "1:1",
    },
  },
  linkedin: {
    feed: {
      width: 1200,
      height: 627,
      ratio: "1.91:1",
      maxFileSize: "10MB",
    },
    feed_square: {
      width: 1080,
      height: 1080,
      ratio: "1:1",
      maxFileSize: "10MB",
    },
    article_cover: {
      width: 1200,
      height: 644,
      ratio: "1.86:1",
    },
    document: {
      width: 1080,
      height: 1080,
      ratio: "1:1",
      maxPages: 300,
    },
    cover: {
      width: 1128,
      height: 191,
      ratio: "5.91:1",
    },
    profile_picture: {
      width: 400,
      height: 400,
      ratio: "1:1",
    },
  },
  facebook: {
    feed: {
      width: 1200,
      height: 630,
      ratio: "1.91:1",
    },
    feed_square: {
      width: 1080,
      height: 1080,
      ratio: "1:1",
    },
    story: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
    },
    cover: {
      width: 820,
      height: 312,
      ratio: "2.63:1",
    },
    event_cover: {
      width: 1920,
      height: 1005,
      ratio: "1.91:1",
    },
    profile_picture: {
      width: 170,
      height: 170,
      ratio: "1:1",
    },
  },
  twitter: {
    feed: {
      width: 1200,
      height: 675,
      ratio: "16:9",
    },
    feed_square: {
      width: 1080,
      height: 1080,
      ratio: "1:1",
    },
    header: {
      width: 1500,
      height: 500,
      ratio: "3:1",
    },
    profile_picture: {
      width: 400,
      height: 400,
      ratio: "1:1",
    },
  },
  pinterest: {
    pin: {
      width: 1000,
      height: 1500,
      ratio: "2:3",
    },
    pin_long: {
      width: 1000,
      height: 2100,
      ratio: "1:2.1",
    },
    pin_square: {
      width: 1000,
      height: 1000,
      ratio: "1:1",
    },
    profile_picture: {
      width: 165,
      height: 165,
      ratio: "1:1",
    },
  },
  youtube: {
    thumbnail: {
      width: 1280,
      height: 720,
      ratio: "16:9",
    },
    channel_banner: {
      width: 2560,
      height: 1440,
      ratio: "16:9",
    },
    profile_picture: {
      width: 800,
      height: 800,
      ratio: "1:1",
    },
    short: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
    },
  },
};

/**
 * Get the default format for a content type on a platform
 */
export function getDefaultFormat(platform: string, contentType: string): string {
  const formatMap: Record<string, Record<string, string>> = {
    instagram: {
      POST: "feed_square",
      CAROUSEL: "carousel",
      STORY: "story",
      REEL: "reel",
    },
    facebook: {
      POST: "feed",
      STORY: "story",
    },
    linkedin: {
      POST: "feed",
      ARTICLE: "article_cover",
      DOCUMENT: "document",
    },
    tiktok: {
      VIDEO: "video",
    },
    twitter: {
      POST: "feed",
    },
    pinterest: {
      POST: "pin",
    },
  };

  return formatMap[platform]?.[contentType] || "feed_square";
}

/**
 * Get dimensions for a specific format
 */
export function getDimensions(platform: string, format: string): VisualSpec | undefined {
  return PLATFORM_SPECS[platform]?.[format];
}

/**
 * Get all formats available for a platform
 */
export function getPlatformFormats(platform: string): string[] {
  return Object.keys(PLATFORM_SPECS[platform] || {});
}

/**
 * Check if a format supports safe zones
 */
export function hasSafeZone(platform: string, format: string): boolean {
  const spec = getDimensions(platform, format);
  return !!spec?.safeZone;
}
