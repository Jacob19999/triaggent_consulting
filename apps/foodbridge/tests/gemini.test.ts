import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createGeminiClient, GeminiAPIError } from "@/lib/agent/gemini";
import { POST } from "@/app/api/agent/route";
import { NextRequest } from "next/server";
import type { GeminiRequest } from "@/lib/agent/run";
vi.mock("@/lib/supabase/server", () => ({ currentProfile: vi.fn(async () => null) }));

const request: GeminiRequest = {
  contents: [{ role: "user", parts: [{ text: "Brief me" }] }],
  systemInstruction: { parts: [{ text: "Use sourced facts" }] },
  tools: [], toolConfig: { functionCallingConfig: { mode: "AUTO" } },
  generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
};
const body = { mode: "briefing", snapshot: { workspace: "demo", asOf: "2026-07", alerts: [] } };
function post(workspace = "demo") {
  return POST(new NextRequest("http://localhost/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, snapshot: { ...body.snapshot, workspace } }) }));
}

describe("Gemini server client", () => {
  it("keeps the key in the Google header, outside the URL and model payload", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ modelVersion: "gemini-test" })));
    await createGeminiClient("test-secret", "gemini-flash-latest", fetcher)(request);
    const [url, opts] = fetcher.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent");
    expect(opts?.headers).toMatchObject({ "X-goog-api-key": "test-secret" });
    expect(JSON.stringify(opts?.body)).not.toContain("test-secret");
    expect(opts?.signal).toBeInstanceOf(AbortSignal);
  });
  it("rejects a non-Gemini model before sending credentials", () => {
    expect(() => createGeminiClient("secret", "../other-host")).toThrow(GeminiAPIError);
  });
  it("drops provider errors that could echo secrets", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("test-secret", { status: 429 }));
    try {
      await createGeminiClient("test-secret", "gemini-flash-latest", fetcher)(request);
      expect.fail("Expected quota error");
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiAPIError);
      expect(String(error)).not.toContain("test-secret");
      expect((error as GeminiAPIError).status).toBe(429);
    }
  });
});

describe("Gemini briefing route", () => {
  it("uses Google for grounded summaries and falls back cleanly on quota errors", async () => {
    vi.stubEnv("GEMINI_API_KEY", "route-test-secret");
    vi.stubEnv("FOODBRIDGE_AI_MODEL", "gemini-flash-latest");
    vi.stubEnv("FOODBRIDGE_AI_REQUIRE_AUTH", "false");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall: { name: "get_network_summary", args: {} } }] } }] }))
      .mockResolvedValueOnce(Response.json({ modelVersion: "gemini-test", candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: "Sourced summary [q4_state_month.csv]." }] } }] }))
      .mockResolvedValueOnce(new Response("route-test-secret", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await (await post()).json();
      expect(result.mode).toBe("ai");
      expect(result.model).toBe("gemini-test");
      const fallback = await (await post()).json();
      expect(fallback.mode).toBe("offline");
      expect(fallback.note).toContain("request limit");
      expect(JSON.stringify(fallback)).not.toContain("route-test-secret");
      expect(JSON.stringify(log.mock.calls)).not.toContain("route-test-secret");
    } finally {
      log.mockRestore(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
    }
  });
  it("restarts on Flash overload using Flash-Lite and identifies the fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "route-test-secret");
    vi.stubEnv("FOODBRIDGE_AI_MODEL", "gemini-flash-latest");
    vi.stubEnv("FOODBRIDGE_AI_REQUIRE_AUTH", "false");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Busy", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ functionCall: { name: "get_network_summary", args: {} } }] } }] }))
      .mockResolvedValueOnce(Response.json({ modelVersion: "gemini-flash-lite-test", candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: "Sourced fallback summary." }] } }] }));
    vi.stubGlobal("fetch", fetcher);
    try {
      const result = await (await post()).json();
      expect(result.mode).toBe("ai");
      expect(result.model).toBe("gemini-flash-lite-test");
      expect(result.note).toContain("Flash-Lite");
      expect(String(fetcher.mock.calls[1][0])).toContain("gemini-flash-lite-latest");
      expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).contents).toHaveLength(1);
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
  it("keeps live summaries behind sign-in", async () => {
    const result = await post("live");
    expect(result.status).toBe(401);
  });
  it("returns an offline briefing without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("FOODBRIDGE_AI_REQUIRE_AUTH", "false");
    try {
      const result = await (await post()).json();
      expect(result.mode).toBe("offline");
    } finally { vi.unstubAllEnvs(); }
  });
});
