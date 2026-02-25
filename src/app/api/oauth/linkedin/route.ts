import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's organization
  const { data: orgMember } = await supabase
    .from("org_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!orgMember) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "LinkedIn app not configured" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/oauth/linkedin/callback`;
  
  // Generate state with org ID
  const state = Buffer.from(JSON.stringify({
    orgId: orgMember.organization_id,
    userId: user.id,
  })).toString("base64");

  const scopes = [
    "r_liteprofile",
    "r_member_social",
    "w_member_social",
  ].join(" ");

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
