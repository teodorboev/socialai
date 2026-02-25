import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding vector for the given text using OpenAI's text-embedding-3-small.
 * 
 * This model is:
 * - 5x cheaper than ada-002 ($0.02/1M tokens vs $0.10/1M)
 * - Better performance on benchmarks
 * - 1536 dimensions
 * 
 * @param text - The text to generate an embedding for
 * @returns Promise resolving to a number array (embedding vector)
 * @throws Error if the API call fails
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      dimensions: EMBEDDING_DIMENSIONS,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No embedding returned from OpenAI");
    }

    return response.data[0].embedding;
  } catch (error) {
    // Log the error but don't expose internal details
    console.error("Failed to generate embedding:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to generate embedding for text");
  }
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * More efficient than calling generateEmbedding multiple times.
 * 
 * @param texts - Array of texts to generate embeddings for
 * @returns Promise resolving to an array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Filter out empty texts
  const nonEmptyTexts = texts.filter(t => t && t.trim().length > 0);
  
  if (nonEmptyTexts.length === 0) {
    throw new Error("No valid texts provided for embedding generation");
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: nonEmptyTexts.map(t => t.trim()),
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Sort by index to maintain order (API may reorder)
    const embeddings = new Array(nonEmptyTexts.length);
    response.data.forEach((item) => {
      embeddings[item.index] = item.embedding;
    });

    return embeddings;
  } catch (error) {
    console.error("Failed to generate embeddings:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to generate embeddings for texts");
  }
}

/**
 * Get the configuration for embedding generation.
 * Useful for documentation and validation.
 */
export function getEmbeddingConfig() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    provider: "OpenAI",
    pricing: "$0.02 per 1M tokens (input)",
  };
}

/**
 * Estimate token count for text (rough approximation).
 * OpenAI uses ~4 characters per token on average.
 * 
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a maximum token limit.
 * Useful for limiting memory context size.
 * 
 * @param text - The text to truncate
 * @param maxTokens - Maximum tokens allowed
 * @returns Truncated text
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + "...";
}

export type { };
