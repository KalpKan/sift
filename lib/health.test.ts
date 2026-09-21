import { describe, it, expect, vi } from "vitest";
import { buildHealth, pingSchema } from "./health";

describe("buildHealth", () => {
  it("reports db: skipped and ok: true when the app has no database configured", async () => {
    const body = await buildHealth("myapp", null);
    expect(body).toMatchObject({ ok: true, service: "myapp", db: "skipped" });
    expect(new Date(body.time).toISOString()).toBe(body.time);
  });

  it("reports db: ok when select 1 succeeds", async () => {
    const body = await buildHealth("myapp", async () => true);
    expect(body).toMatchObject({ ok: true, service: "myapp", db: "ok" });
  });

  it("reports ok: false and db: error when select 1 fails or throws", async () => {
    expect(await buildHealth("myapp", async () => false)).toMatchObject({ ok: false, db: "error" });
    expect(
      await buildHealth("myapp", async () => {
        throw new Error("boom");
      }),
    ).toMatchObject({ ok: false, db: "error" });
  });
});

describe("pingSchema", () => {
  it("calls the schema's health_select_one function and is true when it returns 1", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    const client = { rpc } as unknown as Parameters<typeof pingSchema>[0];
    await expect(pingSchema(client)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("health_select_one");
  });

  it("is false when PostgREST answers with an error (schema not exposed, function missing)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST106", message: "schema not exposed" } });
    const client = { rpc } as unknown as Parameters<typeof pingSchema>[0];
    await expect(pingSchema(client)).resolves.toBe(false);
  });
});
