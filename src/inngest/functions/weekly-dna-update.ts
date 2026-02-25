/**
 * Weekly DNA Profile Update Inngest Function
 * 
 * Rebuilds DNA profiles weekly after self-evaluation.
 * Based on the content-dna skill specification.
 */

import { inngest } from "../client";
import { rebuildAllDNAProfiles } from "@/lib/content-dna/profile";

export const weeklyDNAUpdate = inngest.createFunction(
  { id: "weekly-dna-update", retries: 1 },
  { cron: "0 4 * * 1" }, // Weekly on Monday at 4am (before goal check)
  async ({ step }) => {
    const result = await step.run("rebuild-dna-profiles", async () => {
      await rebuildAllDNAProfiles();
      return { success: true };
    });

    return result;
  }
);
