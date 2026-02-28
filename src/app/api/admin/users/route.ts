import { NextResponse, connection } from "next/server";
import { prismaAdmin } from "@/lib/prisma";
import { z } from "zod";

// Schema for user query parameters
const querySchema = z.object({
  search: z.string().optional(),
  organizationId: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(), // subscription status: active, trialing, past_due, canceled
  page: z.string().optional(),
  limit: z.string().optional(),
});

// GET /api/admin/users - List all users with pagination and filters
export async function GET(request: Request) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse({
      search: searchParams.get("search") || undefined,
      organizationId: searchParams.get("organizationId") || undefined,
      role: searchParams.get("role") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const page = parseInt(params.page || "1");
    const limit = parseInt(params.limit || "25");
    const skip = (page - 1) * limit;

    // Build where clause for org members
    const orgMemberWhere: any = {};
    if (params.role) {
      orgMemberWhere.role = params.role.toUpperCase();
    }
    if (params.organizationId) {
      orgMemberWhere.organizationId = params.organizationId;
    }

    // If filtering by subscription status, we need to include org in count
    // This requires a different approach - we'll count after fetching
    // For now, we'll get all org members and filter in memory, then count
    
    // Get all matching org members first (without pagination for accurate count)
    const allMatchingMembers = await prismaAdmin.orgMember.findMany({
      where: orgMemberWhere,
      select: {
        id: true,
        organization: {
          select: {
            subscription: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    // Filter by subscription status
    let filteredByStatus = allMatchingMembers;
    if (params.status) {
      filteredByStatus = allMatchingMembers.filter(
        (m) => m.organization?.subscription?.status === params.status
      );
    }

    // Get total count after filtering
    const totalCount = filteredByStatus.length;
    
    // Get IDs of filtered members for pagination
    const filteredIds = filteredByStatus.map(m => m.id);

    // Get org members with organization and subscription details
    // Only fetch the ones that match our filters
    const orgMembers = await prismaAdmin.orgMember.findMany({
      where: {
        ...orgMemberWhere,
        id: { in: filteredIds },
      },
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
            subscription: {
              select: {
                id: true,
                status: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                billingPlan: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // For user details, we need to fetch from Supabase Auth
    // Since we can't directly query auth.users easily, we'll return org member data
    // The email will need to be fetched via Supabase Admin API if needed
    // For now, we'll structure it so the frontend can handle email display

    // If we have search params, we need to filter in memory (since we don't have email in org_members)
    // For now, search is not implemented - would need Supabase Auth query
    let filteredMembers = orgMembers;
    
    if (params.search) {
      // We can't filter by email directly without Supabase Auth query
      // For admin purposes, we'll return all org members and let search work differently
      // or we could implement Supabase Admin client to list users
      // For now, skip client-side filtering on search - search would need backend implementation
    }

    return NextResponse.json({
      users: filteredMembers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/admin/users - Create a new user (invite to org)
export async function POST(request: Request) {
  await connection();
  try {
    const body = await request.json();
    
    const createSchema = z.object({
      email: z.string().email("Invalid email address"),
      name: z.string().optional(),
      organizationId: z.string().uuid("Invalid organization ID"),
      role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
    });

    const data = createSchema.parse(body);

    // Check if organization exists
    const org = await prismaAdmin.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Check if user already exists in this organization
    // Note: In a real implementation, we'd check against Supabase Auth
    // For now, we'll create the org member record
    
    // In production, you'd:
    // 1. Create user in Supabase Auth: await supabaseAdmin.auth.admin.createUser({ email: data.email })
    // 2. Or send invite: await supabaseAdmin.auth.admin.generateLink({ type: 'invite', email: data.email })
    // 3. Then create org member with the userId
    
    // For now, return a message indicating this needs Supabase Admin API
    return NextResponse.json({ 
      error: "User creation requires Supabase Auth Admin API. Please use the invite flow or implement auth.admin.createUser.",
      requiresAuthAdmin: true,
    }, { status: 400 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
