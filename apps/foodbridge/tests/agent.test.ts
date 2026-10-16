import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { offlineBriefing } from "@/lib/agent/fallback";
import { runAgent } from "@/lib/agent/run";

type Msg = Anthropic.Beta.Messages.BetaMessage;
type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
const snap = { workspace: "demo" as const, asOf: "2026-07", alerts: [] };

function message(stop: Msg["stop_reason"], content: unknown[]): Msg {
  return { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: stop, content } as unknown as Msg;
}

describe("agent loop", () => {
  it("runs requested tools, returns all results in one turn, then returns the text", async () => {
    const calls: Params[] = [];
    const create = async (p: Params) => {
      calls.push(structuredClone(p));
      if (calls.length === 1)
        return message("tool_use", [
          { type: "tool_use", id: "t1", name: "get_county_profile", input: { county: "Chippewa" } },
          { type: "tool_use", id: "t2", name: "get_policy_events", input: { program: "SNAP" } },
        ]);
      return message("end_turn", [{ type: "text", text: "## Headline\nChippewa briefing." }]);
    };
    const out = await runAgent(create, "Brief me", snap, "claude-opus-5-5");
    expect(out.status).toBe("ok");
    expect(out.markdown).toContain("Chippewa briefing");
    expect(out.toolCalls.map((t) => t.name)).toEqual(["get_county_profile", "get_policy_events"]);
    const second = calls[1].messages;
    const results = second[second.length - 1];
    expect(results.role).toBe("user");
    expect(Array.isArray(results.content) && results.content.length).toBe(2);
    expect(JSON.stringify(results.content)).toContain("q7_august2026_wide.csv");
    expect(calls[0].fallbacks).toBe("default");
    expect(calls[0].thinking).toEqual({ type: "adaptive" });
  });

  it("stops on refusal without running tools", async () => {
    const out = await runAgent(async () => message("refusal", []), "x", snap, "m");
    expect(out.status).toBe("refusal");
    expect(out.toolCalls).toHaveLength(0);
  });

  it("gives up after the step limit", async () => {
    const out = await runAgent(
      async () => message("tool_use", [{ type: "tool_use", id: "t", name: "get_fei_method", input: {} }]),
      "x",
      snap,
      "m",
      3,
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
