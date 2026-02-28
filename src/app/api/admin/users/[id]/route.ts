import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";
import { z } from "zod";

// GET /api/admin/users/[id] - Get single user
// PUT /api/admin/users/[id] - Update user
// DELETE /api/admin/users/[id] - Remove user from organization

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const { id } = await params;

    // Find org member by ID
    const orgMember = await prismaAdmin.orgMember.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            subscription: {
              select: {
                id: true,
                status: true,
                currency: true,
                interval: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                trialStart: true,
                trialEnd: true,
                cancelAtPeriodEnd: true,
                canceledAt: true,
                billingPlan: {
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
                    stripePrices: {
                      where: { isActive: true },
                      orderBy: [{ currency: "asc" }, { interval: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!orgMember) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get additional user metadata if available
    // In a full implementation, we'd fetch from Supabase Auth
    // For now, return org member data

    return NextResponse.json({
      id: orgMember.id,
      userId: orgMember.userId,
      organizationId: orgMember.organizationId,
      role: orgMember.role,
      createdAt: orgMember.createdAt,
      organization: {
        id: orgMember.organization.id,
        name: orgMember.organization.name,
        slug: orgMember.organization.slug,
        createdAt: orgMember.organization.createdAt,
      },
      subscription: orgMember.organization.subscription
        ? {
            id: orgMember.organization.subscription.id,
            status: orgMember.organization.subscription.status,
            currency: orgMember.organization.subscription.currency,
            interval: orgMember.organization.subscription.interval,
            currentPeriodStart: orgMember.organization.subscription.currentPeriodStart,
            currentPeriodEnd: orgMember.organization.subscription.currentPeriodEnd,
            trialStart: orgMember.organization.subscription.trialStart,
            trialEnd: orgMember.organization.subscription.trialEnd,
            cancelAtPeriodEnd: orgMember.organization.subscription.cancelAtPeriodEnd,
            canceledAt: orgMember.organization.subscription.canceledAt,
            plan: orgMember.organization.subscription.billingPlan,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

const updateSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
  organizationId: z.string().uuid().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Check if org member exists
    const existing = await prismaAdmin.orgMember.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If changing organization, verify the new org exists
    if (data.organizationId && data.organizationId !== existing.organizationId) {
      const newOrg = await prismaAdmin.organization.findUnique({
        where: { id: data.organizationId },
      });

      if (!newOrg) {
        return NextResponse.json({ error: "Target organization not found" }, { status: 404 });
      }

      // Check if user is already a member of the target org
      const existingMember = await prismaAdmin.orgMember.findFirst({
        where: {
          userId: existing.userId,
          organizationId: data.organizationId,
        },
      });

      if (existingMember) {
        return NextResponse.json({ 
          error: "User is already a member of this organization" 
        }, { status: 400 });
      }
    }

    // Update the org member
    const updated = await prismaAdmin.orgMember.update({
      where: { id },
      data: {
        ...(data.role && { role: data.role }),
        ...(data.organizationId && { organizationId: data.organizationId }),
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();
  try {
    const { id } = await params;

    // Check if org member exists
    const existing = await prismaAdmin.orgMember.findUnique({
      where: { id },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting the owner
    if (existing.role === "OWNER") {
      return NextResponse.json({ 
        error: "Cannot remove the owner from the organization. Transfer ownership first." 
      }, { status: 400 });
    }

    // Delete the org member
    await prismaAdmin.orgMember.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "User removed from organization" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
