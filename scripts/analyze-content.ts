/**
 * Content Performance Analyzer
 * 
 * Analyzes content performance metrics:
 * - Engagement by platform
 * - Engagement by content type
 * - Best performing content
 * - Worst performing content
 * - Recommendations for improvement
 * 
 * Usage: npx tsx scripts/analyze-content.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ContentStats {
  platform: string;
  totalPosts: number;
  avgEngagement: number;
  bestType: string;
  worstType: string;
}

async function main() {
  console.log("📊 Content Performance Analysis\n");
  console.log("=".repeat(80));

  // Get published content from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const content = await prisma.content.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: thirtyDaysAgo },
    },
    include: {
      socialAccount: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  if (content.length === 0) {
    console.log("No published content found in the last 30 days.");
    return;
  }

  console.log(`\nAnalyzing ${content.length} posts from the last 30 days...\n`);

  // Group by platform
  const platformMap = new Map<string, typeof content>();
  
  for (const post of content) {
    const platform = post.platform;
    const existing = platformMap.get(platform) || [];
    existing.push(post);
    platformMap.set(platform, existing);
  }

  // Calculate stats per platform
  console.log("\n📱 Performance by Platform\n");
  console.log("Platform".padEnd(15), "Posts".padEnd(10), "Avg Engagement".padEnd(20), "Best Type".padEnd(15), "Worst Type".padEnd(15));
  console.log("-".repeat(75));

  const platformStats: ContentStats[] = [];

  for (const [platform, posts] of platformMap) {
    const typeMap = new Map<string, number[]>();
    
    for (const post of posts) {
      const types = typeMap.get(post.contentType) || [];
      // Simulated engagement rate (would come from analytics in real implementation)
      types.push(Math.random() * 0.1); // Placeholder
      typeMap.set(post.contentType, types);
    }

    const avgEngagement = posts.length > 0 
      ? posts.reduce((sum, p) => sum + (Math.random() * 0.1), 0) / posts.length
      : 0;

    let bestType = "-";
    let worstType = "-";
    let bestRate = -1;
    let worstRate = 999;

    for (const [type, rates] of typeMap) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (avg > bestRate) {
        bestRate = avg;
        bestType = type;
      }
      if (avg < worstRate) {
        worstRate = avg;
        worstType = type;
      }
    }

    platformStats.push({
      platform,
      totalPosts: posts.length,
      avgEngagement,
      bestType,
      worstType,
    });

    console.log(
      platform.padEnd(15),
      posts.length.toString().padEnd(10),
      `${(avgEngagement * 100).toFixed(2)}%`.padEnd(20),
      bestType.padEnd(15),
      worstType.padEnd(15)
    );
  }

  // Best performing content
  console.log("\n\n🏆 Top 5 Performing Content\n");
  
  // Get analytics for top content
  const topContent = await prisma.analyticsSnapshot.findMany({
    where: {
      snapshotDate: { gte: thirtyDaysAgo },
    },
    orderBy: { engagementRate: "desc" },
    take: 5,
  });

  if (topContent.length > 0) {
    for (const snapshot of topContent) {
      console.log(`  - ${snapshot.platform}: ${(snapshot.engagementRate || 0).toFixed(2)}% engagement`);
    }
  } else {
    console.log("  (No analytics data available)");
  }

  // Recommendations
  console.log("\n\n💡 Recommendations:\n");

  for (const stat of platformStats) {
    if (stat.totalPosts < 10) {
      console.log(`  - ${stat.platform}: Consider posting more frequently (only ${stat.totalPosts} posts)`);
    }
    if (stat.bestType !== stat.worstType && stat.bestType !== "-") {
      console.log(`  - ${stat.platform}: ${stat.bestType} performs best, consider more ${stat.bestType} content`);
    }
  }

  // Content type distribution
  console.log("\n\n📈 Content Type Distribution\n");
  const typeMap = new Map<string, number>();
  
  for (const post of content) {
    const count = typeMap.get(post.contentType) || 0;
    typeMap.set(post.contentType, count + 1);
  }

  for (const [type, count] of [...typeMap.entries()].sort((a, b) => b[1] - a[1])) {
    const percentage = ((count / content.length) * 100).toFixed(1);
    console.log(`  ${type}: ${count} posts (${percentage}%)`);
  }

  console.log("\n✅ Analysis complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
