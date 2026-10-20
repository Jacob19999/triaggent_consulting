import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/gate/route";
import { GATE_COOKIE, gateToken, hasPortalAccess, isOpenPath, safeEqual, safeNext } from "@/lib/gate";
import { middleware } from "@/middleware";

const BASE = "https://foodbridge.test";
const html = { accept: "text/html" };

function post(fields: Record<string, string>) {
  return new NextRequest(`${BASE}/gate`, { method: "POST", body: new URLSearchParams(fields) });
}

describe("portal gate", () => {
  beforeEach(() => {
    process.env.FOODBRIDGE_PORTAL_PASSWORD = "G08";
  });
  afterEach(() => {
    delete process.env.FOODBRIDGE_PORTAL_PASSWORD;
  });

  it("only returns to same-site paths", () => {
    expect(safeNext("/manager?x=1")).toBe("/manager?x=1");
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "/gate?next=/x", "", null]) expect(safeNext(bad)).toBe("/");
    // Control characters a browser drops while parsing ("/\t/evil.test" resolves to evil.test).
    for (const bad of ["/\t/evil.test", "/\n/evil.test", "/\r/evil.test", "/x\\y"]) expect(safeNext(bad)).toBe("/");
    expect(new URL(safeNext("/\t/evil.test"), "https://foodbridge.test").host).toBe("foodbridge.test");
  });

  it("keeps only the gate, favicon and robots open", () => {
    expect(isOpenPath("/gate")).toBe(true);
    for (const p of ["/", "/manager", "/api/agent", "/data/networks.json", "/deck/present.pdf", "/_next/static/chunks/a.js"]) {
      expect(isOpenPath(p)).toBe(false);
    }
  });

  it("accepts only the configured password's token", async () => {
    expect(await hasPortalAccess(await gateToken("G08"))).toBe(true);
    expect(await hasPortalAccess(await gateToken("g08"))).toBe(false);
    expect(await hasPortalAccess("G08")).toBe(false);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("sets an httpOnly cookie for the right password and returns to next", async () => {
    const res = await POST(post({ password: "G08", next: "/manager/map" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/manager/map");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${GATE_COOKIE}=${await gateToken("G08")}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie).not.toContain("G08;");
  });

  it("rejects a wrong password without a cookie", async () => {
    const res = await POST(post({ password: "nope", next: "/manager" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/gate?e=1&next=%2Fmanager");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("lets Vercel analytics through without the portal cookie", async () => {
    for (const p of ["/_vercel/insights/script.js", "/_vercel/insights/view"]) {
      const res = await middleware(new NextRequest(`${BASE}${p}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("middleware sends pages to the gate and refuses API, data and chunks", async () => {
    const page = await middleware(new NextRequest(`${BASE}/manager?tab=1`, { headers: html }));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe(`${BASE}/gate?next=%2Fmanager%3Ftab%3D1`);
    for (const p of ["/api/agent", "/data/networks.json", "/deck/present.pdf", "/_next/static/chunks/app.js"]) {
      expect((await middleware(new NextRequest(`${BASE}${p}`))).status).toBe(401);
    }
  });

  it("middleware lets a request with the cookie through", async () => {
    const req = new NextRequest(`${BASE}/data/networks.json`, { headers: { cookie: `${GATE_COOKIE}=${await gateToken("G08")}` } });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("stays closed when no password is configured", async () => {
    delete process.env.FOODBRIDGE_PORTAL_PASSWORD;
    expect((await middleware(new NextRequest(`${BASE}/`, { headers: html }))).status).toBe(503);
    expect((await GET(new NextRequest(`${BASE}/gate`))).status).toBe(503);
    expect((await POST(post({ password: "" }))).status).toBe(503);
  });
});
