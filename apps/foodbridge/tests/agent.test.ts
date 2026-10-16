import { describe, expect, it } from "vitest";
import { offlineBriefing } from "@/lib/agent/fallback";
import { runAgent, type GeminiRequest, type GeminiResponse, type GeminiPart } from "@/lib/agent/run";

const snap = { workspace: "demo" as const, asOf: "2026-07", alerts: [] };

function message(parts: GeminiPart[], finishReason = "STOP"): GeminiResponse {
  return { modelVersion: "gemini-flash-test", candidates: [{ finishReason, content: { role: "model", parts } }] };
}

describe("Gemini agent loop", () => {
  it("returns parallel tool results with IDs and preserves model thought signatures", async () => {
    const calls: GeminiRequest[] = [];
    const parts: GeminiPart[] = [
      { thought: true, text: "Retrieve evidence", thoughtSignature: "opaque-signature" },
      { functionCall: { id: "t1", name: "get_county_profile", args: { county: "Chippewa" } } },
      { functionCall: { id: "t2", name: "get_policy_events", args: { program: "SNAP" } } },
    ];
    const out = await runAgent(async (p) => {
      calls.push(structuredClone(p));
      if (calls.length === 1) return message(parts);
      return message([{ thought: true, text: "Private reasoning" }, { text: "## Headline\nChippewa briefing." }]);
    }, "Brief me", snap, "gemini-flash-latest");
    expect(out.status).toBe("ok");
    expect(out.model).toBe("gemini-flash-test");
    expect(out.markdown).toContain("Chippewa briefing");
    expect(out.markdown).not.toContain("Private reasoning");
    expect(out.toolCalls.map((t) => t.name)).toEqual(["get_county_profile", "get_policy_events"]);
    expect(calls[1].contents[1].parts).toEqual(parts);
    const results = calls[1].contents.at(-1)!;
    expect(results.role).toBe("user");
    expect(results.parts.map((p) => p.functionResponse?.id)).toEqual(["t1", "t2"]);
    expect(JSON.stringify(results.parts)).toContain("q7_august2026_wide.csv");
    expect(calls[0].toolConfig.functionCallingConfig.mode).toBe("ANY");
    expect(calls[1].toolConfig.functionCallingConfig.mode).toBe("AUTO");
    expect(calls[0].tools[0].functionDeclarations[0].parametersJsonSchema).toBeDefined();
  });

  it("stops on a prompt block without running tools", async () => {
    const out = await runAgent(async () => ({ promptFeedback: { blockReason: "SAFETY" } }), "x", snap, "m");
    expect(out.status).toBe("refusal");
    expect(out.toolCalls).toHaveLength(0);
  });

  it("does not show truncated, empty or ungrounded completions", async () => {
    for (const response of [message([{ text: "Incomplete" }], "MAX_TOKENS"), {}, message([{ text: "No lookup" }])]) {
      const out = await runAgent(async () => response, "x", snap, "m");
      expect(out.status).toBe("steps");
    }
  });

  it("gives up after the step limit", async () => {
    const out = await runAgent(
      async () => message([{ functionCall: { name: "get_fei_method", args: {} } }]),
      "x", snap, "m", 3,
    );
    expect(out.status).toBe("steps");
    expect(out.toolCalls).toHaveLength(3);
  });

  it("offline briefing lists sourced policy events newest first", () => {
    const md = offlineBriefing("briefing", snap);
    expect(md).toContain("## Policy events");
    const dates = [...md.matchAll(/\*\*(\d{4}-\d{2}-?\d{0,2})\*\*/g)].map((m) => m[1]);
    expect(dates.length).toBeGreaterThan(2);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
