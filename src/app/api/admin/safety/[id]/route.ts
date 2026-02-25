import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.safetyConfig.update({
      where: { id },
      data: {
        values: body.values,
        action: body.action,
        isEnabled: body.isEnabled,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating safety config:", error);
    return NextResponse.json(
      { error: "Failed to update safety config" },
      { status: 500 }
    );
  }
}
