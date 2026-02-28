import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

// GET /api/admin/users/organizations - Get all organizations for filtering

export async function GET(request: Request) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const organizations = await prismaAdmin.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}
