// Refreshes the Supabase cookie session on the private pages only (the
// @supabase/ssr pattern). Reading the user is what rotates an expiring token,
// and only the proxy can write the new cookies before a Server Component
// renders. Public pages and the API are not matched: they never read a session
// (the API's /api/me routes verify the caller themselves).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseEnv } from "@/lib/env";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const cfg = readSupabaseEnv();
  if (!cfg) return response;
  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/me", "/me/:path*"],
};
