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

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";

  if (!appId || !appSecret) {
    return NextResponse.redirect("/dashboard/accounts?error=meta_not_configured");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(`${baseUrl}/api/oauth/meta/callback`)}&client_secret=${appSecret}&code=${code}`
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;

    // Get long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );

    const longLivedData = await longLivedResponse.json();
    const accessToken = longLivedData.access_token;

    // Get user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
    );

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    // Find page with Instagram account
    let pageId: string | null = null;
    let igUserId: string | null = null;

    for (const page of pages) {
      if (page.instagram_business_account?.id) {
        pageId = page.id;
        igUserId = page.instagram_business_account.id;
        break;
      }
    }

    // If no Instagram account found, try to use the first page
    if (!pageId && pages.length > 0) {
      pageId = pages[0].id;
    }

    if (!pageId) {
      return NextResponse.redirect("/dashboard/accounts?error=no_page_found");
    }

    // Get page info
    const pageInfoResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=username&access_token=${accessToken}`
    );
    const pageInfo = await pageInfoResponse.json();

    // Encrypt token
    const encryptedToken = encrypt(accessToken);

    const supabase = await createClient();

    // Save social account
    const { error: insertError } = await supabase.from("social_accounts").upsert({
      organization_id: orgId,
      platform: "INSTAGRAM",
      platform_user_id: igUserId || pageId,
      platform_username: pageInfo.username,
      access_token: encryptedToken,
      scopes: ["instagram_basic", "instagram_content_publish", "pages_read_engagement"],
      is_active: true,
      metadata: {
        pageId,
        igUserId,
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
