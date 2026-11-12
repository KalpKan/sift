// GET /auth/callback?code=... : the end of Google sign-in (Supabase PKCE).
//
// Exchanges the code for a cookie session, then creates the owner row if this
// is the first sign-in of an email in SIFT_OWNER_EMAILS (lib/access.ts), and
// lands on /me. A cancelled or failed sign-in comes back with no code and goes
// to /sign-in with an error, never to a half-signed-in page.
//
// This exact URL, https://sift.kalpkan.com/auth/callback, is on Project B's
// auth redirect allow-list; redirectTo therefore carries no query string.
import { NextResponse } from "next/server";
import { resolveViewer } from "@/lib/access";
import { createCookieSupabase, toAuthUser } from "@/lib/auth-server";
import { getMeContext } from "@/lib/me-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const failed = NextResponse.redirect(new URL("/sign-in?error=auth", url.origin));
  const code = url.searchParams.get("code");
  if (!code) return failed;

  const supabase = await createCookieSupabase();
  if (!supabase) return failed;
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failed;

  const ctx = getMeContext();
  if (ctx) {
    const user = toAuthUser(data.user);
    // Same rule as every /api/me request: an existing owner passes, an allowed
    // email becomes the owner (with the default follows), anyone else is left
    // signed in but sees /me's "private" page. A database failure here sends
    // the reader back to /sign-in with an error, never to a 500.
    try {
      await resolveViewer(null, { ...ctx.viewer, userFromCookies: async () => user });
    } catch {
      return failed;
    }
  }
  return NextResponse.redirect(new URL("/me", url.origin));
}
