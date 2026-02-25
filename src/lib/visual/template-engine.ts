/**
 * Template Engine for text overlays, carousels, and infographics
 * Uses Satori + sharp for HTML/CSS to image conversion
 */

import { getDimensions } from "./platform-specs";

export interface TemplateElement {
  type: "heading" | "body" | "statistic" | "icon" | "logo" | "image" | "divider" | "badge";
  content: string;
  position: { x: string; y: string };
  style?: Record<string, string>;
}

export interface TemplateBackground {
  type: "solid_color" | "gradient" | "image" | "blur" | "pattern";
  value: string;
}

export interface TemplateRenderOptions {
  layout: string;
  dimensions: { width: number; height: number };
  brand: Record<string, unknown>;
  elements: TemplateElement[];
  backgroundImage?: string;
  backgroundColor?: string;
}

// Pre-built layout templates
export const LAYOUTS: Record<string, string> = {
  text_center: `
    <div style="display:flex; align-items:center; justify-content:center; 
         width:100%; height:100%; padding:80px; box-sizing:border-box;">
      <div style="text-align:center;">
        {{heading}}
        {{body}}
      </div>
    </div>
  `,

  text_left: `
    <div style="display:flex; align-items:center; 
         width:100%; height:100%; padding:60px; box-sizing:border-box;">
      <div style="flex:1;">
        {{heading}}
        {{body}}
      </div>
    </div>
  `,

  text_bottom: `
    <div style="display:flex; flex-direction:column; justify-content:flex-end;
         width:100%; height:100%; padding:60px; box-sizing:border-box;">
      {{image}}
      {{heading}}
      {{body}}
    </div>
  `,

  text_top: `
    <div style="display:flex; flex-direction:column; justify-content:flex-start;
         width:100%; height:100%; padding:60px; box-sizing:border-box;">
      {{heading}}
      {{body}}
      {{image}}
    </div>
  `,

  split_horizontal: `
    <div style="display:flex; width:100%; height:100%;">
      <div style="flex:1; display:flex; align-items:center; justify-content:center; padding:40px;">
        {{heading}}
      </div>
      <div style="flex:1; display:flex; align-items:center; justify-content:center;">
        {{image}}
      </div>
    </div>
  `,

  split_vertical: `
    <div style="display:flex; flex-direction:column; width:100%; height:100%;">
      <div style="flex:1; display:flex; align-items:center; justify-content:center;">
        {{image}}
      </div>
      <div style="flex:1; display:flex; align-items:center; justify-content:center; padding:40px;">
        {{body}}
      </div>
    </div>
  `,

  full_bleed: `
    <div style="width:100%; height:100%; position:relative;">
      <div style="position:absolute; inset:0; z-index:0;">
        {{background}}
      </div>
      <div style="position:absolute; inset:0; z-index:1; display:flex; align-items:center; justify-content:center; padding:60px;">
        {{content}}
      </div>
    </div>
  `,

  grid_2x2: `
    <div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; 
         width:100%; height:100%; gap:4px;">
      {{slides}}
    </div>
  `,

  quote: `
    <div style="display:flex; align-items:center; justify-content:center;
         width:100%; height:100%; padding:80px; box-sizing:border-box;">
      <div style="text-align:center; max-width:800px;">
        <div style="font-size:80px; color:{{accentColor}}; line-height:0.5;">"</div>
        {{body}}
        <div style="margin-top:40px; font-weight:bold;">{{heading}}</div>
      </div>
    </div>
  `,

  statistic: `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
         width:100%; height:100%; padding:60px; box-sizing:border-box;">
      {{statistic}}
      {{context}}
    </div>
  `,

  step_by_step: `
    <div style="display:flex; flex-direction:column; width:100%; height:100%; padding:40px; box-sizing:border-box;">
      {{steps}}
    </div>
  `,

  comparison: `
    <div style="display:flex; width:100%; height:100%;">
      <div style="flex:1; padding:30px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        {{leftSide}}
      </div>
      <div style="width:4px; background:{{accentColor}};"></div>
      <div style="flex:1; padding:30px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        {{rightSide}}
      </div>
    </div>
  `,

  carousel_hook: `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
         width:100%; height:100%; padding:60px; box-sizing:border-box;">
      <div style="font-size:24px; color:{{accentColor}}; margin-bottom:20px;">{{slideNumber}}</div>
      {{heading}}
      {{body}}
    </div>
  `,

  carousel_cta: `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
         width:100%; height:100%; padding:60px; box-sizing:border-box;">
      {{heading}}
      {{body}}
      <div style="margin-top:30px; padding:15px 30px; background:{{primaryColor}}; color:white; 
           border-radius:30px; font-weight:bold;">{{cta}}</div>
    </div>
  `,
};

/**
 * Render a template to HTML string
 */
export function renderTemplateHTML(options: TemplateRenderOptions): string {
  const { layout, dimensions, brand, elements, backgroundImage } = options;
  
  let html = LAYOUTS[layout] || LAYOUTS.text_center;

  // Replace brand variables
  const b = brand as Record<string, unknown>;
  html = html.replace(/\{\{primaryColor\}\}/g, (b.primaryColor as string) || "#000000");
  html = html.replace(/\{\{secondaryColor\}\}/g, (b.secondaryColor as string) || "#FFFFFF");
  html = html.replace(/\{\{accentColor\}\}/g, (b.accentColor as string) || "#808080");
  html = html.replace(/\{\{textColor\}\}/g, (b.textColor as string) || "#000000");
  html = html.replace(/\{\{backgroundColor\}\}/g, (b.backgroundColor as string) || "#FFFFFF");

  // Replace fonts
  html = html.replace(/\{\{headingFont\}\}/g, (b.headingFont as string) || "Inter");
  html = html.replace(/\{\{bodyFont\}\}/g, (b.bodyFont as string) || "Inter");

  // Replace elements
  const headingEl = elements.find(e => e.type === "heading");
  const bodyEl = elements.find(e => e.type === "body");
  const imageEl = elements.find(e => e.type === "image");
  const statisticEl = elements.find(e => e.type === "statistic");

  const headingSize = dimensions.width > 1000 ? "64px" : dimensions.width > 500 ? "48px" : "32px";
  const bodySize = dimensions.width > 1000 ? "28px" : dimensions.width > 500 ? "22px" : "18px";
  const statSize = dimensions.width > 1000 ? "120px" : dimensions.width > 500 ? "80px" : "56px";

  html = html.replace(/\{\{heading\}\}/g, headingEl ? `
    <h1 style="font-family:${(b.headingFont as string) || 'Inter'}; 
                color:${(b.primaryColor as string) || '#000'}; 
                font-size:${headingSize}; font-weight:bold; margin:0;">
      ${headingEl.content}
    </h1>
  ` : "");

  html = html.replace(/\{\{body\}\}/g, bodyEl ? `
    <p style="font-family:${(b.bodyFont as string) || 'Inter'}; 
              color:${(b.textColor as string) || '#333'}; 
              font-size:${bodySize}; margin-top:20px; line-height:1.5;">
      ${bodyEl.content}
    </p>
  ` : "");

  html = html.replace(/\{\{image\}\}/g, imageEl ? `
    <img src="${imageEl.content}" style="max-width:100%; max-height:400px; object-fit:contain;" />
  ` : "");

  html = html.replace(/\{\{statistic\}\}/g, statisticEl ? `
    <span style="font-family:${(b.headingFont as string) || 'Inter'}; 
                 color:${(b.accentColor as string) || '#E8A87C'}; 
                 font-size:${statSize}; font-weight:bold;">
      ${statisticEl.content}
    </span>
  ` : "");

  // Handle background
  if (backgroundImage) {
    html = html.replace(/\{\{background\}\}/g, `
      <img src="${backgroundImage}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" />
    `);
  }

  // Wrap in container
  const backgroundColor = (b.backgroundColor as string) || "#FFFFFF";
  return `
    <div style="width:${dimensions.width}px; height:${dimensions.height}px; 
                background:${backgroundColor}; 
                font-family:${(b.bodyFont as string) || 'Inter'}; 
                overflow:hidden; box-sizing:border-box;">
      ${html}
    </div>
  `;
}

/**
 * Satori-based template rendering
 * Converts HTML templates to images using Satori + sharp
 */
import satori from "satori";
import { html } from "satori-html";
import sharp from "sharp";
import { fetchFont } from "./font-loader";

// Cache for loaded fonts
const fontCache = new Map<string, Buffer>();

/**
 * Load font with caching
 */
async function getFont(fontFamily: string, weight: number = 400): Promise<Buffer> {
  const key = `${fontFamily}-${weight}`;
  
  if (fontCache.has(key)) {
    return fontCache.get(key)!;
  }

  try {
    const fontBuffer = await fetchFont(fontFamily, weight);
    fontCache.set(key, fontBuffer);
    return fontBuffer;
  } catch (error) {
    console.warn(`Failed to load font ${fontFamily}, using default`);
    // Return a default font or throw
    throw error;
  }
}

/**
 * Render template to image buffer using Satori + sharp
 */
export async function renderTemplate(options: TemplateRenderOptions): Promise<Buffer> {
  const { layout, dimensions, brand, elements, backgroundImage, backgroundColor } = options;
  
  const b = brand as Record<string, unknown>;
  
  // Get brand colors
  const primaryColor = (b.primaryColor as string) || "#000000";
  const secondaryColor = (b.secondaryColor as string) || "#FFFFFF";
  const accentColor = (b.accentColor as string) || "#808080";
  const textColor = (b.textColor as string) || "#000000";
  const headingFont = (b.headingFont as string) || "Inter";
  const bodyFont = (b.bodyFont as string) || "Inter";

  // Get the layout template
  const layoutTemplate = LAYOUTS[layout] || LAYOUTS.text_center;
  
  // Process elements
  const headingEl = elements.find(e => e.type === "heading");
  const bodyEl = elements.find(e => e.type === "body");
  const imageEl = elements.find(e => e.type === "image");
  const statisticEl = elements.find(e => e.type === "statistic");

  // Calculate font sizes based on dimensions
  const scale = Math.min(dimensions.width / 1080, dimensions.height / 1080);
  const headingSize = Math.round(64 * scale);
  const bodySize = Math.round(28 * scale);
  const statSize = Math.round(120 * scale);

  // Build the HTML
  const bgColor = backgroundColor || (b.backgroundColor as string) || "#FFFFFF";
  
  let htmlContent = layoutTemplate
    .replace(/\{\{primaryColor\}\}/g, primaryColor)
    .replace(/\{\{secondaryColor\}\}/g, secondaryColor)
    .replace(/\{\{accentColor\}\}/g, accentColor)
    .replace(/\{\{textColor\}\}/g, textColor)
    .replace(/\{\{backgroundColor\}\}/g, bgColor)
    .replace(/\{\{headingFont\}\}/g, headingFont)
    .replace(/\{\{bodyFont\}\}/g, bodyFont);

  // Replace heading
  if (headingEl) {
    htmlContent = htmlContent.replace(/\{\{heading\}\}/g, `
      <div style="font-family: ${headingFont}; font-size: ${headingSize}px; font-weight: bold; color: ${primaryColor}; margin: 0; text-align: center;">
        ${escapeHtml(headingEl.content)}
      </div>
    `);
  } else {
    htmlContent = htmlContent.replace(/\{\{heading\}\}/g, "");
  }

  // Replace body
  if (bodyEl) {
    htmlContent = htmlContent.replace(/\{\{body\}\}/g, `
      <div style="font-family: ${bodyFont}; font-size: ${bodySize}px; color: ${textColor}; margin-top: 20px; line-height: 1.5; text-align: center;">
        ${escapeHtml(bodyEl.content)}
      </div>
    `);
  } else {
    htmlContent = htmlContent.replace(/\{\{body\}\}/g, "");
  }

  // Replace image
  if (imageEl) {
    htmlContent = htmlContent.replace(/\{\{image\}\}/g, `
      <img src="${escapeHtml(imageEl.content)}" style="max-width: 100%; max-height: 400px; object-fit: contain;" />
    `);
  } else {
    htmlContent = htmlContent.replace(/\{\{image\}\}/g, "");
  }

  // Replace statistic
  if (statisticEl) {
    htmlContent = htmlContent.replace(/\{\{statistic\}\}/g, `
      <span style="font-family: ${headingFont}; font-size: ${statSize}px; font-weight: bold; color: ${accentColor};">
        ${escapeHtml(statisticEl.content)}
      </span>
    `);
  } else {
    htmlContent = htmlContent.replace(/\{\{statistic\}\}/g, "");
  }

  // Handle background
  if (backgroundImage) {
    htmlContent = htmlContent.replace(/\{\{background\}\}/g, `
      <img src="${escapeHtml(backgroundImage)}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;" />
    `);
  } else {
    htmlContent = htmlContent.replace(/\{\{background\}\}/g, "");
  }

  // Wrap in container
  const finalHtml = `
    <div style="width: ${dimensions.width}px; height: ${dimensions.height}px; background: ${bgColor}; font-family: ${bodyFont}; overflow: hidden; position: relative;">
      ${htmlContent}
    </div>
  `;

  // Parse HTML with satori-html (use any to bypass strict React types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const satoriHtml = html(finalHtml) as any;

  // Load fonts
  let headingFontData: Buffer;
  let bodyFontData: Buffer;
  
  try {
    headingFontData = await getFont(headingFont, 700);
  } catch {
    // Fallback to system font
    headingFontData = await getFont("Inter", 700);
  }
  
  try {
    bodyFontData = await getFont(bodyFont, 400);
  } catch {
    bodyFontData = await getFont("Inter", 400);
  }

  // Render to SVG using Satori
  const svg = await satori(satoriHtml, {
    width: dimensions.width,
    height: dimensions.height,
    fonts: [
      {
        name: headingFont,
        data: headingFontData,
        weight: 700,
        style: "normal",
      },
      {
        name: bodyFont,
        data: bodyFontData,
        weight: 400,
        style: "normal",
      },
    ],
  });

  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

/**
 * Render multiple slides for carousel
 */
export async function renderCarousel(
  slides: CarouselSlide[],
  brand: Record<string, unknown>,
  platform: string = "instagram"
): Promise<Buffer[]> {
  const dims = getDimensions(platform, "carousel") || { width: 1080, height: 1080 };
  
  const results = await Promise.all(
    slides.map(async (slide) => {
      const elements: TemplateElement[] = [];
      
      if (slide.heading) {
        elements.push({
          type: "heading",
          content: slide.heading,
          position: { x: "50%", y: "30%" },
        });
      }
      
      if (slide.body) {
        elements.push({
          type: "body",
          content: slide.body,
          position: { x: "50%", y: "60%" },
        });
      }

      return renderTemplate({
        layout: slide.layout,
        dimensions: dims,
        brand,
        elements,
      });
    })
  );

  return results;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate carousel slides
 */
export interface CarouselSlide {
  slideNumber: number;
  totalSlides: number;
  role: "hook" | "content" | "transition" | "cta";
  heading?: string;
  body?: string;
  image?: string;
  layout: string;
}

export function generateCarouselSlides(
  caption: string,
  totalSlides: number,
  brand: Record<string, unknown>
): CarouselSlide[] {
  const slides: CarouselSlide[] = [];

  // Slide 1: Hook
  slides.push({
    slideNumber: 1,
    totalSlides,
    role: "hook",
    heading: caption.substring(0, 50) + (caption.length > 50 ? "..." : ""),
    layout: "carousel_hook",
  });

  // Slides 2-(n-1): Content
  for (let i = 2; i < totalSlides; i++) {
    slides.push({
      slideNumber: i,
      totalSlides,
      role: "content",
      body: `Point ${i - 1} about ${caption.substring(0, 30)}...`,
      layout: "text_center",
    });
  }

  // Last slide: CTA
  slides.push({
    slideNumber: totalSlides,
    totalSlides,
    role: "cta",
    heading: "Save this! 🔖",
    body: "Follow for more tips",
    layout: "carousel_cta",
  });

  return slides;
}

/**
 * Generate infographic layout for data
 */
export function generateInfographicLayout(
  data: { label: string; value: string }[],
  brand: Record<string, unknown>
): TemplateRenderOptions {
  const dimensions = getDimensions("instagram", "feed_square") || { width: 1080, height: 1080 };

  const elements: TemplateElement[] = data.map((item, i) => ({
    type: "statistic" as const,
    content: item.value,
    position: { x: "50%", y: `${30 + i * 20}%` },
    style: { textAlign: "center" },
  }));

  return {
    layout: "statistic",
    dimensions: { width: dimensions.width, height: dimensions.height },
    brand,
    elements,
  };
}
