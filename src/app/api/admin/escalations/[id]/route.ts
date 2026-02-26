import { NextResponse } from "next/server";
import { prismaAdmin } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prismaAdmin.escalationRule.update({
      where: { id },
      data: {
        name: body.name,
        triggerType: body.triggerType,
        triggerValue: body.triggerValue,
        action: body.action,
        priority: body.priority,
        isEnabled: body.isEnabled,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating escalation rule:", error);
    return NextResponse.json(
      { error: "Failed to update escalation rule" },
      { status: 500 }
    );
  }
}
