/**
 * Prompt Optimizer
 * 
 * Analyzes and optimizes AI prompts:
 * - Estimates token count
 * - Checks for best practices
 * - Identifies optimization opportunities
 * - Suggests improvements
 * 
 * Usage: npx tsx scripts/optimize-prompts.ts [agent-name]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Simple token estimation (average ~4 characters per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface PromptAnalysis {
  name: string;
  body: string;
  tokenCount: number;
  variables: string[];
  issues: string[];
  suggestions: string[];
}

async function main() {
  const agentFilter = process.argv[2];

  console.log("🎨 Prompt Optimization Analysis\n");
  console.log("=".repeat(80));

  // Fetch all prompts
  const where = agentFilter ? { agentName: agentFilter as any } : {};
  const prompts = await prisma.promptTemplate.findMany({
    where,
    orderBy: [{ agentName: "asc" }, { version: "desc" }],
  });

  if (prompts.length === 0) {
    console.log("No prompts found.");
    return;
  }

  const analyses: PromptAnalysis[] = [];

  for (const prompt of prompts) {
    const analysis: PromptAnalysis = {
      name: `${prompt.agentName} - ${prompt.name}`,
      body: prompt.body,
      tokenCount: estimateTokens(prompt.body),
      variables: prompt.variables || [],
      issues: [],
      suggestions: [],
    };

    // Check for issues
    const body = prompt.body;

    // Check length
    if (analysis.tokenCount > 3000) {
      analysis.issues.push(`Prompt is very long (${analysis.tokenCount} tokens). Consider splitting.`);
    }

    // Check for missing instructions
    if (!body.includes("Respond with")) {
      analysis.issues.push("No explicit output format specified");
    }

    // Check for JSON mention
    if (body.includes("JSON") && !body.includes("schema")) {
      analysis.suggestions.push("Consider adding a Zod schema for structured output");
    }

    // Check for examples
    if (!body.includes("Example") && !body.includes("example")) {
      analysis.suggestions.push("Consider adding examples to improve consistency");
    }

    // Check for constraints
    if (!body.includes("never") && !body.includes("don't") && !body.includes("avoid")) {
      analysis.suggestions.push("Consider adding explicit constraints/do-nots");
    }

    // Check for confidence scoring
    if (!body.includes("confidence") && !body.includes("score")) {
      analysis.suggestions.push("Consider adding confidence score requirement");
    }

    // Check variable usage
    const varPlaceholders = body.match(/\{\{(\w+)\}\}/g) || [];
    for (const v of varPlaceholders) {
      const varName = v.replace(/[{}]/g, "");
      if (!analysis.variables.includes(varName)) {
        analysis.issues.push(`Template variable {{${varName}}} not declared`);
      }
    }

    analyses.push(analysis);
  }

  // Print results
  let totalTokens = 0;
  let totalIssues = 0;

  for (const analysis of analyses) {
    totalTokens += analysis.tokenCount;
    totalIssues += analysis.issues.length;

    console.log(`\n📝 ${analysis.name}`);
    console.log(`   Tokens: ${analysis.tokenCount}`);
    console.log(`   Variables: ${analysis.variables.join(", ") || "(none)"}`);

    if (analysis.issues.length > 0) {
      console.log("   ⚠️  Issues:");
      for (const issue of analysis.issues) {
        console.log(`      - ${issue}`);
      }
    }

    if (analysis.suggestions.length > 0) {
      console.log("   💡 Suggestions:");
      for (const suggestion of analysis.suggestions) {
        console.log(`      - ${suggestion}`);
      }
    }

    if (analysis.issues.length === 0 && analysis.suggestions.length === 0) {
      console.log("   ✅ No issues found");
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Summary:");
  console.log(`  Total Prompts: ${prompts.length}`);
  console.log(`  Total Tokens: ${totalTokens}`);
  console.log(`  Total Issues: ${totalIssues}`);
  console.log(`  Avg Tokens/Prompt: ${Math.round(totalTokens / prompts.length)}`);

  // Cost estimate
  const avgCostPerToken = 0.000015; // Claude Sonnet average
  const estimatedMonthlyCost = (totalTokens * 100 * avgCostPerToken); // Assuming 100 calls/day
  console.log(`  Estimated Monthly Cost: $${estimatedMonthlyCost.toFixed(2)}`);

  // Optimization recommendations
  if (totalIssues > 0) {
    console.log("\n🎯 Top Priority Fixes:");
    for (const analysis of analyses) {
      if (analysis.issues.length > 0) {
        console.log(`  - ${analysis.name}: ${analysis.issues[0]}`);
      }
    }
  }

  console.log("\n✅ Analysis complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
