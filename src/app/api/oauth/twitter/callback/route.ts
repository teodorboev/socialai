import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/social/token-manager";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`/dashboard/accounts?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect("/dashboard/accounts?error=missing_params");
  }

  // Decode state to get org and user IDs
  let orgId: string;
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    orgId = decoded.orgId;
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect("/dashboard/accounts?error=invalid_state");
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect("/dashboard/accounts?error=twitter_not_configured");
  }

  try {
    // Exchange code for access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: `${baseUrl}/api/oauth/twitter/callback`,
        code_verifier: "challenge",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user info
    const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();
    const userInfo = userData.data || {};

    // Encrypt token
    const encryptedToken = encrypt(accessToken);
    const encryptedRefreshToken = encrypt(refreshToken);

    const supabase = await createClient();

    // Save social account
    const { error: insertError } = await supabase.from("social_accounts").upsert({
      organization_id: orgId,
      platform: "TWITTER",
      platform_user_id: userInfo.id,
      platform_username: userInfo.username,
      access_token: encryptedToken,
      refresh_token: encryptedRefreshToken,
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      is_active: true,
      metadata: {
        userId: userInfo.id,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "organizationId_platform_platformUserId",
    });

    if (insertError) {
      console.error("Failed to save social account:", insertError);
      return NextResponse.redirect("/dashboard/accounts?error=save_failed");
    }

    return NextResponse.redirect("/dashboard/accounts?success=connected");
  } catch (err) {
    console.error("OAuth error:", err);
    return NextResponse.redirect("/dashboard/accounts?error=oauth_failed");
  }
}
