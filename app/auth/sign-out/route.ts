// POST /auth/sign-out : ends the cookie session and returns to the public front page.
import { NextResponse } from "next/server";
import { createCookieSupabase } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createCookieSupabase();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", new URL(request.url).origin), { status: 303 });
}
