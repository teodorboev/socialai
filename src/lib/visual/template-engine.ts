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
 * Convert HTML to image buffer
 * Note: This requires Satori + sharp to be implemented
 */
export async function renderTemplate(_options: TemplateRenderOptions): Promise<Buffer> {
  // TODO: Implement with Satori (React to SVG) + sharp (SVG to PNG)
  // const html = renderTemplateHTML(options);
  // const svg = satori(html, { width, height, fonts: [...] });
  // const png = sharp(Buffer.from(svg)).png().toBuffer();
  throw new Error("Template rendering not implemented - requires satori and sharp");
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
