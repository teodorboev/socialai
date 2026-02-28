import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/social/token-manager";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`/mission-control/accounts?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect("/mission-control/accounts?error=missing_params");
  }

  // Decode state to get org and user IDs
  let orgId: string;
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    orgId = decoded.orgId;
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect("/mission-control/accounts?error=invalid_state");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect("/mission-control/accounts?error=linkedin_not_configured");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/oauth/linkedin/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();
    
    // Get profile picture
    const pictureResponse = await fetch("https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const pictureData = await pictureResponse.json();

    // Encrypt token
    const encryptedToken = encrypt(accessToken);

    const supabase = await createClient();

    // Save social account
    const { error: insertError } = await supabase.from("social_accounts").upsert({
      organization_id: orgId,
      platform: "LINKEDIN",
      platform_user_id: userData.id,
      platform_username: `${userData.firstName?.localized?.en} ${userData.lastName?.localized?.en}`.trim(),
      access_token: encryptedToken,
      scopes: ["r_liteprofile", "r_member_social", "w_member_social"],
      is_active: true,
      metadata: {
        userId: userData.id,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "organizationId_platform_platformUserId",
    });

    if (insertError) {
      console.error("Failed to save social account:", insertError);
      return NextResponse.redirect("/mission-control/accounts?error=save_failed");
    }

    return NextResponse.redirect("/mission-control/accounts?success=connected");
  } catch (err) {
    console.error("OAuth error:", err);
    return NextResponse.redirect("/mission-control/accounts?error=oauth_failed");
  }
}
