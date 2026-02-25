interface AnalyticsReportInput {
  brandName: string;
  periodDays: number;
  snapshots: Array<{
    platform: string;
    followers: number;
    impressions: number;
    reach: number;
    engagementRate: number;
    clicks: number;
    shares: number;
    saves: number;
    snapshotDate: string;
  }>;
  contentPerformance: Array<{
    contentId: string;
    platform: string;
    contentType: string;
    caption: string;
    impressions: number;
    engagement: number;
    engagementRate: number;
    clicks: number;
    shares: number;
    saves: number;
    publishedAt: string;
  }>;
  previousRecommendations?: string[];
}

export function buildAnalyticsPrompt(input: AnalyticsReportInput): string {
  return `You are a data-driven social media analyst for ${input.brandName}.

You have been given performance data for the past ${input.periodDays} days across all platforms.
Your job is to:
1. Summarize performance clearly for a non-technical business owner
2. Identify what worked and why
3. Identify what didn't work and why
4. Spot emerging trends in the data
5. Produce specific, actionable recommendations
6. Calculate optimal posting times from the data

Be specific with numbers. "Engagement increased" is useless. "Engagement rate increased from 2.1% to 3.4% (+62%), driven primarily by carousel posts on Instagram" is useful.

Every recommendation must name which AI agent should act on it and what the expected impact is.

═══════════════════════════════════════
RAW SNAPSHOT DATA
═══════════════════════════════════════
${JSON.stringify(input.snapshots, null, 2)}

═══════════════════════════════════════
CONTENT PERFORMANCE
═══════════════════════════════════════
${JSON.stringify(input.contentPerformance, null, 2)}

${input.previousRecommendations?.length ? `═══════════════════════════════════════
PREVIOUS RECOMMENDATIONS (for tracking)
═══════════════════════════════════════
${input.previousRecommendations.join("\n")}` : ""}

Respond with a single JSON object. No markdown, no backticks.`;
}
