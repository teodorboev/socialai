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

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "Meta app not configured" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/oauth/meta/callback`;
  
  // Generate state with org ID
  const state = Buffer.from(JSON.stringify({
    orgId: orgMember.organization_id,
    userId: user.id,
  })).toString("base64");

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "pages_read_engagement",
    "pages_manage_posts",
  ].join(",");

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
