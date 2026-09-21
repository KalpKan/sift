import { describe, it, expect } from "vitest";
import { getSupabase } from "./supabase";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_SCHEMA: "myapp",
};

describe("getSupabase", () => {
  it("is null when the env triple is not set, so the app runs without a database", () => {
    expect(getSupabase({})).toBeNull();
  });

  it("scopes every query to NEXT_PUBLIC_APP_SCHEMA (Accept-Profile header), never public", () => {
    const client = getSupabase(env);
    expect(client).not.toBeNull();
    // @ts-expect-error protected field, asserted on purpose: proves the Accept-Profile schema
    expect(client!.rest.schemaName).toBe("myapp");
  });

  it("does not persist auth sessions in the browser (no cookies, no localStorage)", () => {
    const client = getSupabase(env)!;
    // @ts-expect-error private field, asserted on purpose: the template must stay cookieless
    expect(client.auth.persistSession).toBe(false);
  });
});
