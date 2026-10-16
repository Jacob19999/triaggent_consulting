import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const currentProfile = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  currentProfile: () => currentProfile(),
  serverSupabase: async () => ({ from }),
}));
vi.mock("@/lib/config", () => ({ supabaseConfigured: true }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/agent/route";
import { GET } from "@/app/api/briefs/route";
import { DELETE } from "@/app/api/briefs/[id]/route";
import { briefRow, briefTitle } from "@/lib/briefs";

const profile = { id: "user-1", email: "ada@example.org", role: "manager", shelf_id: null };
const briefId = "11111111-1111-4111-8111-111111111111";

function agentPost() {
  return POST(
    new NextRequest("http://localhost/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "briefing", snapshot: { workspace: "demo", asOf: "2026-07", alerts: [] } }),
    }),
  );
}

describe("brief row", () => {
  it("names a weekly, county, shelf and question briefing", () => {
    expect(briefTitle("briefing", "2026-07")).toBe("Weekly briefing · July 2026");
    expect(briefTitle("county", "2026-07", "Chippewa")).toBe("Chippewa · July 2026");
    expect(briefTitle("shelf", "2026-07", null, null, "North Shelf")).toBe("North Shelf · July 2026");
    expect(briefTitle("ask", "2026-07", null, "Where should a mobile stop go?")).toBe("Where should a mobile stop go?");
  });

  it("keeps the generated text and leaves the author to the database", () => {
    const row = briefRow({
      mode: "county",
      resultMode: "offline",
      asOf: "2026-07",
      workspace: "demo",
      markdown: "Chippewa briefing.",
      county: "Chippewa",
      toolCalls: [{ name: "get_county_profile", input: { county: "Chippewa" } }],
    });
    expect(row).toMatchObject({
      mode: "county",
      result_mode: "offline",
      title: "Chippewa · July 2026",
      county: "Chippewa",
      as_of: "2026-07",
      markdown: "Chippewa briefing.",
    });
    expect(row).not.toHaveProperty("author_email");
    expect(row).not.toHaveProperty("created_by");
    expect(briefRow({ ...({ mode: "briefing", resultMode: "ai", asOf: "2026-07", workspace: "live", markdown: "  " }) })).toBeNull();
  });
});

describe("saved briefings", () => {
  beforeEach(() => {
    currentProfile.mockReset();
    from.mockReset();
  });

  it("stores a generated briefing for the signed-in account", async () => {
    currentProfile.mockResolvedValue(profile);
    const single = vi.fn().mockResolvedValue({ data: { id: briefId }, error: null });
    const insert = vi.fn((_row: Record<string, unknown>) => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert });
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("FOODBRIDGE_AI_REQUIRE_AUTH", "false");
    try {
      const body = await (await agentPost()).json();
      expect(body.mode).toBe("offline");
      expect(body.saved).toBe(true);
      expect(body.id).toBe(briefId);
      const row = insert.mock.calls[0]?.[0];
      expect(row?.markdown).toContain("Offline briefing");
      expect(row).not.toHaveProperty("author_email");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still returns the briefing when storage is down", async () => {
    currentProfile.mockResolvedValue(profile);
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "42P01", message: 'relation "briefs" does not exist' } });
    from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      const body = await (await agentPost()).json();
      expect(body.mode).toBe("offline");
      expect(body.saved).toBe(false);
      expect(body.markdown).toContain("Offline briefing");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("hides the shared list from signed-out visitors", async () => {
    currentProfile.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lets a shelf account read the shared list", async () => {
    currentProfile.mockResolvedValue({ ...profile, role: "shelf" });
    const rows = [{ id: briefId, title: "Weekly briefing · July 2026" }];
    from.mockReturnValue({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: rows, error: null }),
        }),
      }),
    });
    const body = await (await GET()).json();
    expect(body.briefs).toEqual(rows);
  });

  it("lets a manager remove a briefing and refuses a shelf account", async () => {
    currentProfile.mockResolvedValue({ ...profile, role: "shelf" });
    const denied = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: briefId }) });
    expect(denied.status).toBe(403);

    currentProfile.mockResolvedValue(profile);
    const remove = vi.fn(async () => ({ error: null, count: 1 }));
    from.mockReturnValue({ delete: () => ({ eq: remove }) });
    const ok = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: briefId }) });
    expect(ok.status).toBe(200);
    expect(remove).toHaveBeenCalledWith("id", briefId);
  });
});
