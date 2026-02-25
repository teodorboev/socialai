/**
 * Daily Self-Evaluation Inngest Function
 * 
 * Scans for posts published 7 days ago and runs post-mortem evaluation.
 * Based on the self-evaluation skill specification.
 */

import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { findPostsForEvaluation, evaluatePost } from "@/lib/content-dna/evaluator";

export const dailySelfEvaluation = inngest.createFunction(
  { id: "daily-self-evaluation", retries: 2 },
  { cron: "0 5 * * *" }, // Daily at 5am
  async ({ step }) => {
    // Find posts that need evaluation (published 7 days ago)
    const postsToEvaluate = await step.run("find-posts", async () => {
      return findPostsForEvaluation();
    });

    if (!postsToEvaluate || postsToEvaluate.length === 0) {
      return { evaluated: 0, message: "No posts to evaluate" };
    }

    const results = {
      evaluated: 0,
      hits: 0,
      misses: 0,
      average: 0,
      errors: 0,
    };

    // Evaluate each post
    for (const contentId of postsToEvaluate) {
      try {
        const result = await step.run(`evaluate-${contentId}`, async () => {
          return evaluatePost(contentId);
        });

        if (result) {
          results.evaluated++;
          
          if (result.overallVerdict === "hit") {
            results.hits++;
          } else if (result.overallVerdict === "miss") {
            results.misses++;
          } else {
            results.average++;
          }
        }
      } catch (error) {
        console.error(`Error evaluating post ${contentId}:`, error);
        results.errors++;
      }
    }

    // Log summary
    await step.run("log-summary", async () => {
      console.log(`Self-evaluation complete: ${results.evaluated} posts evaluated`);
      console.log(`Hits: ${results.hits}, Misses: ${results.misses}, Average: ${results.average}`);
    });

    return results;
  }
);
