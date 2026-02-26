import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { MediaPitchSchema, MediaPitchInputSchema, type MediaPitchInput, type MediaPitch } from "@/lib/ai/schemas/media-pitch";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class MediaPitchAgent extends BaseAgent {
  constructor() {
    super("MEDIA_PITCH");
    this.setTaskType("generation");
  }

  async execute(input: MediaPitchInput): Promise<AgentResult<MediaPitch>> {
    const parsedInput = MediaPitchInputSchema.parse(input);

    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("MEDIA_PITCH", "main", {
        brandName: parsedInput.brandName,
        newsHooks: parsedInput.newsHooks.join(", "),
        recentWins: parsedInput.recentWins?.join(", ") || "None",
        targetPublications: parsedInput.targetPublications?.join(", ") || "Not specified",
      }, parsedInput.organizationId);
    } catch {
      systemPrompt = `You are a Media Relations Expert specializing in crafting compelling PR pitches.

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
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<MediaPitch>({
      system: systemPrompt,
      userMessage: `Create media pitch for ${parsedInput.brandName}.`,
      maxTokens: 2500,
      organizationId: parsedInput.organizationId,
      schema: MediaPitchSchema,
    });

    if (!data) throw new Error("Failed to parse media pitch response");

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate: data.confidenceScore < 0.5,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
