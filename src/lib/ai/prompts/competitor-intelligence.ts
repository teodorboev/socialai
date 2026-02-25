import type { CompetitorIntelInput } from "../schemas/competitor-intelligence";

export function buildCompetitorIntelPrompt(input: CompetitorIntelInput): string {
  const competitorData = input.competitors.map((comp) => ({
    name: comp.name,
    platforms: comp.platforms.map((p) => `${p.platform}: @${p.handle}`).join(", "),
  }));

  return `You are a competitive intelligence analyst for ${input.brandConfig.brandName} in the ${input.brandConfig.industry} industry.

You have data on ${input.competitors.length} competitors across social media platforms:
${competitorData.map((c) => `- ${c.name}: ${c.platforms}`).join("\n")}

YOUR JOB:
1. Identify what competitors are doing well and why
2. Find gaps they're missing that ${input.brandConfig.brandName} can fill
3. Spot content ideas worth adapting (NOT copying)
4. Benchmark ${input.brandConfig.brandName}'s performance against the competitive set
5. Provide actionable recommendations

${input.previousReport ? `PREVIOUS REPORT (${input.previousReport.date}):
${input.previousReport.summary}
Key findings: ${input.previousReport.keyFindings.join(", ")}` : ""}

YOUR CLIENT'S METRICS:
${JSON.stringify(input.clientMetrics, null, 2)}

CONTENT THEMES: ${input.brandConfig.contentThemes.join(", ")}
TARGET AUDIENCE: ${input.brandConfig.targetAudience.demographics}

CRITICAL RULES:
- Never recommend copying content directly. Always adapt with the client's unique voice.
- Focus on patterns, not individual posts (unless a post went significantly viral).
- Compare like-for-like: same platform, similar follower counts where possible.
- Flag if a competitor is running paid promotion (unusually high engagement on specific posts).
- Be specific with numbers. "They're doing better" is useless. "Their Instagram Reels avg 4.2% engagement vs your 1.8%" is useful.

Respond with a JSON object matching this schema:
{
  "summary": "2-3 sentence executive summary",
  "competitors": [
    {
      "name": "competitor name",
      "overallThreatLevel": "low|medium|high",
      "strengths": ["up to 3 strengths"],
      "weaknesses": ["up to 3 weaknesses"],
      "notableActivity": "what they did this week",
      "topPerformingPost": {
        "platform": "Instagram/Twitter/etc",
        "description": "what the post was about",
        "engagementRate": 0.0,
        "whyItWorked": "reason",
        "canWeAdapt": true|false,
        "adaptationIdea": "how we could adapt (optional)"
      }
    }
  ],
  "gaps": [
    {
      "gap": "what they're not doing",
      "opportunity": "how we can exploit it",
      "platform": "which platform",
      "priority": "high|medium|low",
      "suggestedContentType": "what type of content to create"
    }
  ],
  "contentInspirations": [
    {
      "inspiration": "what they did",
      "sourceCompetitor": "who did it",
      "adaptedIdea": "how we make it our own",
      "platform": "target platform"
    }
  ],
  "benchmarks": {
    "clientVsAvgEngagement": 0.0,
    "clientVsAvgPostFrequency": 0.0,
    "clientVsAvgFollowerGrowth": 0.0
  },
  "confidenceScore": 0.0-1.0
}

Today's date: ${new Date().toISOString().split("T")[0]}`;
}
