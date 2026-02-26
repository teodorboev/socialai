import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

// GET /api/admin/billing/subscriptions/[id] - Get single subscription
// PUT /api/admin/billing/subscriptions/[id] - Update subscription
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const subscription = await prismaAdmin.subscription.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        billingPlan: {
          include: {
            stripePrices: {
              orderBy: [{ currency: "asc" }, { interval: "asc" }],
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { currentUsage } = body;

    // Check if subscription exists
    const existing = await prismaAdmin.subscription.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Update subscription
    const subscription = await prismaAdmin.subscription.update({
      where: { id },
      data: {
        ...(currentUsage !== undefined && { currentUsage }),
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
