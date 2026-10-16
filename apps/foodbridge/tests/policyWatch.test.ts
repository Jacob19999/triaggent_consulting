import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ currentProfile: vi.fn(async () => null) }));
import { NextRequest } from "next/server";
import { POST } from "@/app/api/policy-watch/route";
import { policyWatchTask } from "@/lib/agent/policyTask";
import { leaksOutcome, parseScan, rateTimeline, WebPolicyItem } from "@/lib/policyWatch";
import { research } from "@/lib/research";

const item = (over: Record<string, unknown> = {}) => ({
  title: "Minnesota expands SNAP work requirements",
  program: "SNAP",
  level: "state",
  status: "in_effect",
  effective: "2026-11-01",
  what_changes: "Able-bodied adults without dependents aged 55 to 64 must meet work rules.",
  who_in_mn: "Older SNAP adults without dependents",
  demand_pressure: "up",
  supply_effect: "none",
  impact: "high",
  signals: ["HouseholdsReg", "AdultsReg"],
  action: "Brief rural shelves.",
  tracked_id: null,
  confidence: "medium",
  sources: [{ title: "DCYF bulletin", publisher: "MN DCYF", url: "https://dcyf.mn.gov/x", kind: "primary" }, { title: "bad", url: "javascript:alert(1)" }],
  ...over,
});
const reply = (items: unknown[]) => "Here you go:\n```json\n" + JSON.stringify({ summary: "SNAP rules tighten.", items }) + "\n```";

describe("policy scan parsing", () => {
  it("parses fenced JSON, drops unsafe URLs and coerces unknown values", () => {
    const out = parseScan(reply([item({ impact: "enormous", signals: ["Visits"] })]))!;
    expect(out.summary).toBe("SNAP rules tighten.");
    expect(out.items).toHaveLength(1);
    expect(out.items[0].impact).toBe("low");
    expect(out.items[0].signals).toEqual([]);
    expect(out.items[0].sources.map((s) => s.url)).toEqual(["https://dcyf.mn.gov/x"]);
  });
  it("sorts by impact, then newest effective date", () => {
    const out = parseScan(reply([item({ title: "a", impact: "low" }), item({ title: "b", effective: "2026-09" }), item({ title: "c", effective: "2026-12" })]))!;
    expect(out.items.map((i) => i.title)).toEqual(["c", "b", "a"]);
  });
  it("returns null when there is no JSON", () => {
    expect(parseScan("I could not find anything.")).toBeNull();
  });
  it("withholds items that quote food-shelf activity after July 2026 (August rule)", () => {
    const leak = WebPolicyItem.parse(item({ what_changes: "Food shelves reported 280,000 visits in August 2026 after the cut." }));
    const policyOnly = WebPolicyItem.parse(item({ what_changes: "Rules take effect November 2026 and may increase visits." }));
    expect(leaksOutcome(leak)).toBe(true);
    expect(leaksOutcome(policyOnly)).toBe(false);
    const out = parseScan(reply([item({ what_changes: leak.what_changes }), item()]))!;
    expect(out.items).toHaveLength(1);
    expect(out.dropped).toBe(1);
  });
});

describe("tracked timeline rating", () => {
  it("rates every curated event and puts Minnesota food-benefit changes first", () => {
    const rated = rateTimeline(research.policy, "2026-07");
    expect(rated).toHaveLength(research.policy.length);
    expect(rated[0].impact).toBe("high");
    expect(rated[0].event.mn).toBe(true);
    expect(rated.find((r) => r.event.program === "School meals")!.pressure).toBe("down");
  });
  it("task context names tracked ids and the observed cutoff, never a forecast month as observed", () => {
    const task = policyWatchTask("2026-07", "2026-10-16");
    expect(task).toContain(research.policy[0].id);
    expect(task).toContain("operational data ends 2026-07");
    expect(task).not.toMatch(/2026-08.*HouseholdsReg/);
  });
});

describe("policy watch route", () => {
  const post = (body: object) =>
    POST(new NextRequest("http://localhost/api/policy-watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  it("asks Gemini with Google Search grounding and returns parsed items with grounding pages", async () => {
    vi.stubEnv("GEMINI_API_KEY", "pw-secret");
    vi.stubEnv("FOODBRIDGE_AI_MODEL", "gemini-flash-latest");
    vi.stubEnv("FOODBRIDGE_AI_REQUIRE_AUTH", "false");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        modelVersion: "gemini-test",
        candidates: [
          {
            finishReason: "STOP",
            content: { role: "model", parts: [{ text: reply([item()]) }] },
            groundingMetadata: { webSearchQueries: ["Minnesota SNAP work rules 2026"], groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/x", title: "mn.gov" } }] },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    try {
      const out = await (await post({ workspace: "demo", asOf: "2026-07", refresh: true })).json();
      expect(out.mode).toBe("ai");
      expect(out.items[0].title).toContain("SNAP");
      expect(out.queries).toEqual(["Minnesota SNAP work rules 2026"]);
      expect(out.searched[0].title).toBe("mn.gov");
      const sent = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
      expect(sent.tools).toEqual([{ googleSearch: {} }]);
      expect(sent.toolConfig).toBeUndefined();
      expect(JSON.stringify(sent)).not.toContain("pw-secret");
      // Second call inside the TTL is served from the instance cache.
      await post({ workspace: "demo", asOf: "2026-07" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  it("returns an offline scan without a key and requires sign-in for the live workspace", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      expect((await (await post({ workspace: "demo", asOf: "2026-07" })).json()).mode).toBe("offline");
      expect((await post({ workspace: "live", asOf: "2026-07" })).status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
