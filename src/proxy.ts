import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  
  // Only check auth for dashboard routes, let pages handle their own auth
  const pathname = request.nextUrl.pathname;
  
  // Let all requests through - individual pages handle their own auth/redirects
  return supabaseResponse;
}
