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

    // SIMPLIFIED APPROACH: Get total count first
    let totalCount = await prismaAdmin.orgMember.count({
      where: orgMemberWhere,
    });

    // If filtering by subscription status, we need to fetch and filter in memory
    // But only if we have users and status filter is active
    let filteredIds: string[] | null = null;
    
    if (params.status && totalCount > 0) {
      try {
        // Try to get subscription status for filtering
        const allWithStatus = await prismaAdmin.orgMember.findMany({
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
          take: 1000, // Limit for performance
        });
        
        const filtered = allWithStatus.filter(
          (m) => m.organization?.subscription?.status === params.status
        );
        filteredIds = filtered.map(m => m.id);
        totalCount = filteredIds.length;
      } catch (subError) {
        console.error("Error fetching subscription status, ignoring filter:", subError);
        // If subscription query fails, ignore the status filter
        filteredIds = null;
      }
    }

    // Build the query
    const queryWhere = filteredIds 
      ? { ...orgMemberWhere, id: { in: filteredIds } }
      : orgMemberWhere;

    // Get org members with organization details
    // Use try-catch for each part to make it resilient
    let orgMembers;
    try {
      orgMembers = await prismaAdmin.orgMember.findMany({
        where: queryWhere,
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
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      });
    } catch (queryError) {
      console.error("Error fetching org members:", queryError);
      return NextResponse.json({ 
        error: "Failed to fetch users from database",
        details: queryError instanceof Error ? queryError.message : "Unknown error"
      }, { status: 500 });
    }

    // Now try to get subscription info separately (if it exists)
    let usersWithSubscription = orgMembers;
    try {
      // Get subscription info for each user
      const orgIds = [...new Set(orgMembers.map(m => m.organizationId))];
      
      if (orgIds.length > 0) {
        const subscriptions = await prismaAdmin.subscription.findMany({
          where: { organizationId: { in: orgIds } },
          select: {
            id: true,
            status: true,
            organizationId: true,
            billingPlan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });
        
        const subMap = new Map(subscriptions.map(s => [s.organizationId, s]));
        
        usersWithSubscription = orgMembers.map(m => ({
          ...m,
          organization: {
            ...m.organization,
            subscription: subMap.get(m.organizationId) || null,
          },
        }));
      }
    } catch (subError) {
      console.error("Error fetching subscriptions:", subError);
      // Continue without subscription info
    }

    // For user details, we need to fetch from Supabase Auth
    // Since we can't directly query auth.users easily, we'll return org member data
    // The email will need to be fetched via Supabase Admin API if needed
    // For now, we'll structure it so the frontend can handle email display

    // If we have search params, we need to filter in memory (since we don't have email in org_members)
    // For now, search is not implemented - would need Supabase Auth query
    let filteredMembers = usersWithSubscription;
    
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
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ 
      error: "Failed to fetch users",
      details: errorMessage,
      stack: process.env.NODE_ENV === "development" ? (error as Error)?.stack : undefined
    }, { status: 500 });
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
