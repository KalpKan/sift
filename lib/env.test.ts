import { describe, it, expect } from "vitest";
import { readSupabaseEnv, appName } from "./env";

const full = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_SCHEMA: "myapp",
};

describe("readSupabaseEnv", () => {
  it("returns null when any of the three names is missing or empty", () => {
    expect(readSupabaseEnv({})).toBeNull();
    expect(readSupabaseEnv({ ...full, NEXT_PUBLIC_APP_SCHEMA: undefined })).toBeNull();
    expect(readSupabaseEnv({ ...full, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })).toBeNull();
  });

  it("returns the url, anon key and schema when all three are set", () => {
    expect(readSupabaseEnv(full)).toEqual({
      url: "https://x.supabase.co",
      anonKey: "anon-key",
      schema: "myapp",
    });
  });

  it("throws on a schema name that is not a plain lowercase identifier", () => {
    expect(() => readSupabaseEnv({ ...full, NEXT_PUBLIC_APP_SCHEMA: "My App" })).toThrow(/NEXT_PUBLIC_APP_SCHEMA/);
  });

  it("throws on a url that is not a URL", () => {
    expect(() => readSupabaseEnv({ ...full, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("appName", () => {
  it("defaults to the schema name, then to 'template'", () => {
    expect(appName({})).toBe("template");
    expect(appName({ NEXT_PUBLIC_APP_SCHEMA: "myapp" })).toBe("myapp");
    expect(appName({ NEXT_PUBLIC_APP_NAME: "My App", NEXT_PUBLIC_APP_SCHEMA: "myapp" })).toBe("My App");
  });
});
