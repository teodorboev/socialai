import type { AudienceIntelInput } from "../schemas/audience-intelligence";

export function buildAudienceIntelPrompt(input: AudienceIntelInput): string {
  return `You are an audience intelligence analyst for ${input.brandConfig.brandName} in the ${input.brandConfig.industry} industry.

Analyze the audience data and create detailed personas that represent the brand's followers and engaged users.

BRAND:
- Name: ${input.brandConfig.brandName}
- Target audience: ${input.brandConfig.targetAudience.demographics}
- Interests: ${input.brandConfig.targetAudience.interests.join(", ")}

PLATFORM DATA:
${Object.entries(input.platformData).map(([platform, data]) => `
${platform}:
- Followers: ${data.followers}
- Growth: ${data.followersChange}%
- Engagement rate: ${data.avgEngagementRate}%
- Top content types: ${data.topContentTypes.join(", ")}
${data.demographics ? `- Demographics: ${JSON.stringify(data.demographics)}` : ""}
${data.peakHours ? `- Peak hours: ${JSON.stringify(data.peakHours)}` : ""}
`).join("\n")}

CONTENT PERFORMANCE:
${input.contentPerformance.map((c) => `- ${c.contentType}: ${c.engagementRate}% ER, ${c.impressions} impressions`).join("\n")}

${input.previousReport ? `PREVIOUS PERSONAS (${input.previousReport.date}):
${input.previousReport.personas.map((p) => p.name).join(", ")}` : ""}

Create 2-5 audience personas based on this data. Each persona should include:
- Demographics (age, gender, location, language)
- Behavior (when they're active, what content they prefer, how they engage)
- Interests and pain points
- What content resonates and what to avoid

Respond with JSON:
{
  "personas": [
    {
      "name": "memorable persona name like 'Busy Mom Maria'",
      "percentage": 0-100,
      "demographics": {
        "ageRange": "e.g., 25-34",
        "gender": "e.g., 60% female, 40% male",
        "topLocations": ["city1", "city2"],
        "language": "primary language"
      },
      "behavior": {
        "peakActivityDays": ["Monday", "Wednesday"],
        "peakActivityHours": ["9am", "12pm"],
        "preferredContentTypes": ["Reels", "Carousels"],
        "engagementStyle": "passive_scroller|active_engager|sharer_amplifier|creator_ugc",
        "averageSessionContext": "e.g., morning commute"
      },
      "interests": ["interest1", "interest2"],
      "painPoints": ["pain1", "pain2"],
      "contentThatResonates": ["what works"],
      "contentToAvoid": ["what turns them off"]
    }
  ],
  "platformBreakdown": {
    "Instagram": { "dominantPersona": "name", "audienceSize": 0, "growthRate": 0, "engagementQuality": "high|medium|low", "uniqueTraits": "what's different" }
  },
  "optimalPostingWindows": {
    "Instagram": [{ "day": "Monday", "startHour": 9, "endHour": 11, "timezone": "UTC", "reasoning": "why this time" }]
  },
  "audienceShifts": [
    { "shift": "what changed", "direction": "growing|shrinking|emerging", "implication": "what it means", "recommendation": "what to do" }
  ],
  "contentRecommendations": [
    { "targetPersona": "persona name", "recommendation": "what to create", "platform": "where", "expectedImpact": "what happens" }
  ],
  "confidenceScore": 0.0-1.0
}`;
}
