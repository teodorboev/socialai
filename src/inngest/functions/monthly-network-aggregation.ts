/**
 * Monthly Network Aggregation Inngest Function
 * 
 * Runs monthly to aggregate patterns across clients in same industry.
 * Based on the inter-client-learning skill specification.
 */

import { inngest } from "../client";
import { aggregateIndustryPatterns } from "@/lib/network-intelligence/aggregator";
import { runConfidenceDecay } from "@/lib/network-intelligence/confidence-decay";

export const monthlyNetworkAggregation = inngest.createFunction(
  { id: "monthly-network-aggregation", retries: 1 },
  { cron: "0 7 1 * *" }, // Monthly on 1st at 7am
  async ({ step }) => {
    // Step 1: Aggregate industry patterns
    const aggregation = await step.run("aggregate-patterns", async () => {
      await aggregateIndustryPatterns();
      return { success: true };
    });

    // Step 2: Run confidence decay
    const decay = await step.run("confidence-decay", async () => {
      const results = await runConfidenceDecay();
      return results;
    });

    return {
      aggregation,
      decay,
      timestamp: new Date().toISOString(),
    };
  }
);
