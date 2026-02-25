import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { MediaPitchSchema, MediaPitchInputSchema, type MediaPitchInput, type MediaPitch } from "@/lib/ai/schemas/media-pitch";

export class MediaPitchAgent extends BaseAgent {
  constructor() {
    super("MEDIA_PITCH", "claude-sonnet-4-20250514");
  }

  async execute(input: MediaPitchInput): Promise<AgentResult<MediaPitch>> {
    const parsedInput = MediaPitchInputSchema.parse(input);

    const systemPrompt = `You are a Media Relations Expert specializing in crafting compelling PR pitches.

Your role is to identify newsworthy angles and create targeted pitches for media outlets.

BRAND: ${parsedInput.brandName}
NEWS HOOKS: ${parsedInput.newsHooks.join(", ")}
RECENT WINS: ${parsedInput.recentWins?.join(", ") || "None"}
TARGET PUBLICATIONS: ${parsedInput.targetPublications?.join(", ") || "Not specified"}

ANALYSIS FRAMEWORK:
1. Identify compelling story angles
2. Research and prioritize target outlets
3. Craft tailored pitch drafts
4. Estimate earned media value
5. Create actionable timeline

Respond with a JSON object matching this schema:
${JSON.stringify(MediaPitchSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Create media pitch for ${parsedInput.brandName}.` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = MediaPitchSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.5,
      tokensUsed,
    };
  }
}
