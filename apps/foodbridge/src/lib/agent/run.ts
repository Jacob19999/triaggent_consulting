import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFS, type SnapshotT } from "./tools";

type Create = (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.Messages.BetaMessage>;

export interface AgentOutcome {
  status: "ok" | "refusal" | "steps";
  markdown: string;
  model?: string;
  toolCalls: { name: string; input: unknown }[];
}

/** Manual tool-use loop. `create` is injectable so the loop can be tested without the API. */
export async function runAgent(create: Create, task: string, snapshot: SnapshotT, model: string, maxTurns = 8): Promise<AgentOutcome> {
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: task }];
  const toolCalls: AgentOutcome["toolCalls"] = [];
  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOL_DEFS,
      messages,
    });
    if (response.stop_reason === "refusal") return { status: "refusal", markdown: "", toolCalls };
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const uses = response.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || uses.length === 0) {
      const markdown = response.content
        .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { status: "ok", markdown, model: response.model, toolCalls };
    }
    messages.push({ role: "assistant", content: response.content });
    // All results for this turn go back in one user message (parallel tool use).
    const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = uses.map((u) => {
      toolCalls.push({ name: u.name, input: u.input });
      try {
        const out = runTool(u.name, (u.input ?? {}) as Record<string, unknown>, snapshot);
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) };
      } catch (e) {
        return { type: "tool_result", tool_use_id: u.id, is_error: true, content: String(e) };
      }
    });
    messages.push({ role: "user", content: results });
  }
  return { status: "steps", markdown: "", toolCalls };
}
