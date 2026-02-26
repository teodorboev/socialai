import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Create Supabase server client
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
    const { data: { user } } = await supabase.auth.getUser();

    // If not logged in, redirect to login
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    // If not super admin, redirect to dashboard
    if (!superAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}
