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

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    return NextResponse.json(
      { error: "TikTok app not configured" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/oauth/tiktok/callback`;
  
  // Generate state with org ID
  const state = Buffer.from(JSON.stringify({
    orgId: orgMember.organization_id,
    userId: user.id,
  })).toString("base64");

  const scopes = [
    "user.info.basic",
    "video.publish",
    "comment.list",
  ].join(",");

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
