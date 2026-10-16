import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateLink: vi.fn(), profile: vi.fn(), grant: vi.fn(), verifyOtp: vi.fn(),
  from: vi.fn(), admin: vi.fn(), server: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ adminSupabase: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: mocks.server }));
import { POST } from "@/app/api/auth/email/route";

function request(email = "Person@Example.com", origin = "http://127.0.0.1:3000", host = "http://127.0.0.1:3000") {
  return new NextRequest(`${host}/api/auth/email`, {
    method: "POST", headers: { origin, host: new URL(host).host, "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  });
}

describe("prototype email-only login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FOODBRIDGE_EMAIL_ONLY_LOGIN", "true");
    mocks.generateLink.mockResolvedValue({ data: { user: { id: "test-user" }, properties: { hashed_token: "private-token", verification_type: "magiclink" } }, error: null });
    mocks.profile.mockResolvedValue({ data: { role: "pending" }, error: null });
    mocks.grant.mockResolvedValue({ error: null });
    const update = { eq: vi.fn() };
    update.eq.mockReturnValueOnce(update).mockImplementationOnce(mocks.grant);
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }),
      update: () => update,
      insert: mocks.grant,
    });
    mocks.admin.mockReturnValue({ auth: { admin: { generateLink: mocks.generateLink } }, from: mocks.from });
    mocks.verifyOtp.mockResolvedValue({ data: { session: { access_token: "private-session" } }, error: null });
    mocks.server.mockResolvedValue({ auth: { verifyOtp: mocks.verifyOtp } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["false", ""])("disables the endpoint unless explicitly enabled (%s)", async (value) => {
    vi.stubEnv("FOODBRIDGE_EMAIL_ONLY_LOGIN", value);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("allows the explicitly enabled flow on the hosted prototype", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request("person@example.com", "https://foodbridge.example", "https://foodbridge.example"))).status).toBe(200);
  });
  it("rejects cross-origin and missing-origin requests before creating accounts", async () => {
    expect((await POST(request("person@example.com", "https://other.example"))).status).toBe(403);
    expect((await POST(request("person@example.com", ""))).status).toBe(403);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it("rejects malformed email", async () => {
    expect((await POST(request("invalid"))).status).toBe(400);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it("opens a pending account as manager with a cookie session and no token in the response", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirect: "/manager" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "person@example.com" });
    expect(mocks.grant).toHaveBeenCalledOnce();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "private-token", type: "magiclink" });
  });
  it("creates a missing profile for a newly created account", async () => {
    mocks.profile.mockResolvedValue({ data: null, error: null });
    mocks.generateLink.mockResolvedValue({ data: { user: { id: "test-user" }, properties: { hashed_token: "private-token", verification_type: "signup" } }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.grant).toHaveBeenCalledWith({ id: "test-user", email: "person@example.com", role: "manager" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "private-token", type: "signup" });
  });
  it.each(["manager", "shelf"])("preserves an existing %s role", async (role) => {
    mocks.profile.mockResolvedValue({ data: { role }, error: null });
    const response = await POST(request());
    expect(await response.json()).toEqual({ redirect: role === "shelf" ? "/shelf" : "/manager" });
    expect(mocks.grant).not.toHaveBeenCalled();
  });
  it("does not sign in when granting workspace access fails", async () => {
    mocks.grant.mockResolvedValue({ error: { message: "database details" } });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("reports a failed session without returning internal auth details", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: "private-token" } });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-token");
  });
});
