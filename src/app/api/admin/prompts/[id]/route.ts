import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prismaAdmin.promptTemplate.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        body: body.body,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating prompt template:", error);
    return NextResponse.json(
      { error: "Failed to update prompt template" },
      { status: 500 }
    );
  }
}
