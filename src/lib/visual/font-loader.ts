/**
 * Font Loader
 * 
 * Fetches fonts for Satori rendering.
 * Uses Google Fonts API or local fonts.
 */

import { readFile } from "fs/promises";
import { join } from "path";

// Common Google Fonts to preload
const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Merriweather",
  "Source Sans Pro",
  "Oswald",
  "Raleway",
  "PT Sans",
  "Noto Sans",
  "Work Sans",
  "Nunito",
  "Quicksand",
];

// Fallback system fonts
const SYSTEM_FONTS: Record<string, Buffer[]> = {};

/**
 * Fetch font from Google Fonts or use fallback
 */
export async function fetchFont(fontFamily: string, weight: number = 400): Promise<Buffer> {
  const fontName = fontFamily.toLowerCase().replace(/\s+/g, "+");
  const fontWeight = weight >= 700 ? "700" : weight >= 500 ? "500" : "400";
  
  // Try to fetch from Google Fonts
  try {
    const url = `https://fonts.gstatic.com/s/${fontName}/v${getFontVersion(fontName)}/H4ciBXKAlscrwNWeXjQbFumRhQ.woff2`;
    
    const response = await fetch(url);
    
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    }
  } catch (error) {
    console.warn(`Failed to fetch Google Font ${fontFamily}:`, error);
  }

  // Fallback: Try common alternatives
  const fallbacks = getFontFallbacks(fontFamily);
  
  for (const fallback of fallbacks) {
    try {
      const url = `https://fonts.gstatic.com/s/${fallback.toLowerCase().replace(/\s+/g, "+")}/v${getFontVersion(fallback)}/H4ciBXKAlscrwNWeXjQbFumRhQ.woff2`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer;
      }
    } catch {
      // Continue to next fallback
    }
  }

  // Last resort: Return Inter from a CDN or throw
  throw new Error(`Could not load font: ${fontFamily}`);
}

/**
 * Get font version (simplified - would need updating)
 */
function getFontVersion(fontName: string): string {
  // Common versions - in production, this would be fetched dynamically
  const versions: Record<string, string> = {
    inter: "21",
    roboto: "30",
    "open sans": "35",
    lato: "23",
    montserrat: "24",
    poppins: "19",
    "playfair display": "33",
    merriweather: "31",
  };
  
  return versions[fontName.toLowerCase()] || "21";
}

/**
 * Get fallback fonts for common families
 */
function getFontFallbacks(fontFamily: string): string[] {
  const fallbacks: Record<string, string[]> = {
    "playfair display": ["merriweather", "georgia"],
    "inter": ["roboto", "system-ui"],
    "montserrat": ["lato", "open sans"],
    "poppins": ["nunito", "quicksand"],
    "roboto": ["open sans", "system-ui"],
    "source sans": ["work sans", "noto sans"],
    "work sans": ["nunito", "quicksand"],
  };

  const lower = fontFamily.toLowerCase();
  return fallbacks[lower] || ["inter", "roboto", "system-ui"];
}

/**
 * Preload common fonts for better performance
 */
export async function preloadFonts(): Promise<void> {
  // This could be called at startup to cache common fonts
  console.log("Font preloading not implemented - using on-demand loading");
}

/**
 * Get available font families
 */
export function getAvailableFonts(): string[] {
  return [...GOOGLE_FONTS];
}
