import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

// GET /api/admin/users/plans - Get all available billing plans

export async function GET(request: Request) {
  await connection();
  try {
    const plans = await prismaAdmin.billingPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        trialDays: true,
        maxPlatforms: true,
        maxPostsPerMonth: true,
        maxBrands: true,
        maxTeamMembers: true,
        agentTier: true,
        features: true,
        isUsageBased: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}
