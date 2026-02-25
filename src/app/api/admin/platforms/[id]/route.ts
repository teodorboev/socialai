import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.platformConfig.update({
      where: { id },
      data: {
        maxCaptionLength: body.maxCaptionLength,
        maxHashtags: body.maxHashtags,
        guidelines: body.guidelines,
        isEnabled: body.isEnabled,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating platform config:", error);
    return NextResponse.json(
      { error: "Failed to update platform config" },
      { status: 500 }
    );
  }
}
