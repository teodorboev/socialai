import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

// GET /api/admin/billing/subscriptions - List all subscriptions
// POST /api/admin/billing/subscriptions - Create subscription (manual)
export async function GET(request: Request) {
  try {
    await connection();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orgId = searchParams.get("organizationId");

    const where: any = {};
    if (status) where.status = status;
    if (orgId) where.organizationId = orgId;

    const subscriptions = await prismaAdmin.subscription.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        billingPlan: {
          select: { id: true, name: true, slug: true },
          include: {
            stripePrices: {
              where: { interval: "month", isActive: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}
