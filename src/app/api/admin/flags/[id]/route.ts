import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prismaAdmin.featureFlag.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        isEnabled: body.isEnabled,
        planMinimum: body.planMinimum || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating feature flag:", error);
    return NextResponse.json(
      { error: "Failed to update feature flag" },
      { status: 500 }
    );
  }
}
