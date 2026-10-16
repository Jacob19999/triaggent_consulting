import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "@/app/api/drive/route";

const call = (body: unknown) =>
  POST(new Request("http://localhost/api/drive", { method: "POST", body: JSON.stringify(body) }));

const origin = { lon: -93.265, lat: 44.978 };

describe("/api/drive", () => {
  beforeEach(() => {
    vi.stubEnv("OSRM_URL", "https://osrm.example/");
    vi.stubEnv("OSRM_KEY", "k");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is 503 when routing is not configured", async () => {
    vi.stubEnv("OSRM_URL", "");
    expect((await call({ origin, targets: [origin] })).status).toBe(503);
  });

  it("refuses points outside Minnesota before calling OSRM", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call({ origin: { lon: -96.79, lat: 46.88 - 10 }, targets: [origin] })).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("batches targets, sends the key server-side and converts to miles and minutes", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      const n = new URL(url).searchParams.get("destinations")!.split(";").length;
      return Response.json({ code: "Ok", distances: [Array(n).fill(1609.344)], durations: [Array(n).fill(120)] });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call({ origin, targets: Array(450).fill({ lon: -94, lat: 45 }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.miles).toHaveLength(450);
    expect(json.miles[449]).toBeCloseTo(1);
    expect(json.minutes[0]).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith("https://osrm.example/table/v1/driving/-93.26500,44.97800;")).toBe(true);
    expect((init.headers as Record<string, string>)["X-OSRM-Key"]).toBe("k");
  });

  it("reports an upstream failure as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad gateway", { status: 502 })));
    expect((await call({ origin, targets: [origin] })).status).toBe(503);
  });
});
