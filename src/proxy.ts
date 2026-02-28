import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Create Supabase server client (anon key, handles cookies/auth session)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let supabaseResponse = NextResponse.next({ request });

  // Check admin routes - require super admin
  if (pathname.startsWith("/admin")) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      // If not logged in or auth error, redirect to login
      if (authError || !user) {
        console.error("Auth error:", authError);
        return NextResponse.redirect(new URL("/login", request.url));
      }

      // Check if service role key is available
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error("SUPABASE_SERVICE_ROLE_KEY not configured");
        // Allow access if no service role key (dev/fallback mode)
        return supabaseResponse;
      }

      // Use the service role client to bypass RLS when checking super admin status
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      );

      // Use .maybeSingle() instead of .single() to avoid errors when no rows found
      const { data: superAdmin, error: superAdminError } = await serviceClient
        .from("super_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (superAdminError) {
        console.error("Super admin check error:", superAdminError);
        // If table doesn't exist or other error, allow access for now
        return supabaseResponse;
      }

      // If not super admin, redirect to dashboard
      if (!superAdmin) {
        return NextResponse.redirect(new URL("/mission-control", request.url));
      }
    } catch (error) {
      console.error("Admin route error:", error);
      // If there's an error, allow access for now (don't block)
      return supabaseResponse;
    }
  }

  return supabaseResponse;
}
