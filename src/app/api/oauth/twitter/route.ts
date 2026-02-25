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

  const clientId = process.env.TWITTER_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Twitter app not configured" },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/oauth/twitter/callback`;
  
  // Generate state with org ID
  const state = Buffer.from(JSON.stringify({
    orgId: orgMember.organization_id,
    userId: user.id,
  })).toString("base64");

  const scopes = [
    "tweet.read",
    "tweet.write",
    "users.read",
    "offline.access",
  ].join("%20");

  const authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code&code_challenge=challenge&code_challenge_method=plain`;

  return NextResponse.redirect(authUrl);
}
