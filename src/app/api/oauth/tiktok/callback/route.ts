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

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

  if (!clientKey || !clientSecret) {
    return NextResponse.redirect("/dashboard/accounts?error=tiktok_not_configured");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${baseUrl}/api/oauth/tiktok/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const openId = tokenData.open_id;

    // Get user info
    const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();
    const userInfo = userData.data?.user || {};

    // Encrypt token
    const encryptedToken = encrypt(accessToken);

    const supabase = await createClient();

    // Save social account
    const { error: insertError } = await supabase.from("social_accounts").upsert({
      organization_id: orgId,
      platform: "TIKTOK",
      platform_user_id: openId,
      platform_username: userInfo.display_name || openId,
      access_token: encryptedToken,
      scopes: ["user.info.basic", "video.publish", "comment.list"],
      is_active: true,
      metadata: {
        openId,
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
