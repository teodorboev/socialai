import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

// GET /api/admin/billing/events - List billing events
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");
    const eventType = searchParams.get("eventType");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (eventType) where.eventType = eventType;

    const [events, total] = await Promise.all([
      prismaAdmin.billingEvent.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prismaAdmin.billingEvent.count({ where }),
    ]);

    return NextResponse.json({
      events,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching billing events:", error);
    return NextResponse.json({ error: "Failed to fetch billing events" }, { status: 500 });
  }
}
