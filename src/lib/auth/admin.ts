import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MemberRole } from "@prisma/client";

/**
 * Get the current user's role in their primary organization
 */
export async function getUserOrgRole(): Promise<MemberRole | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  // Get user's org membership
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return orgMember?.role ?? null;
}

/**
 * Check if user is an admin (OWNER or ADMIN) of their org
 */
export async function isOrgAdmin(): Promise<boolean> {
  const role = await getUserOrgRole();
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Check if user is a super admin (platform-wide admin)
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }

  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return !!superAdmin;
}

/**
 * Require org admin role - redirects if not admin
 */
export async function requireOrgAdmin(): Promise<void> {
  const isAdmin = await isOrgAdmin();
  
  if (!isAdmin) {
    redirect("/mission-control");
  }
}

/**
 * Require super admin role - redirects if not super admin
 */
export async function requireSuperAdmin(): Promise<void> {
  const isSA = await isSuperAdmin();
  
  if (!isSA) {
    redirect("/mission-control");
  }
}

/**
 * Require authentication - redirects if not logged in
 */
export async function requireAuth(): Promise<string> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }
  
  return user.id;
}

/**
 * Get current user ID or null
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  return user?.id ?? null;
}
