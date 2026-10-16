import { SYSTEM_PROMPT } from "./prompt";
import { runTool, TOOL_DEFS, type SnapshotT } from "./tools";

export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export type GeminiTool =
  | { functionDeclarations: { name: string; description: string; parametersJsonSchema: unknown }[] }
  // Google Search grounding: the model runs its own web queries server-side at Google.
  | { googleSearch: Record<string, never> };

export interface GeminiRequest {
  systemInstruction: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools: GeminiTool[];
  toolConfig?: { functionCallingConfig: { mode: "ANY" | "AUTO" } };
  generationConfig: { maxOutputTokens: number; temperature: number };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: { web?: { uri?: string; title?: string } }[];
}

export interface GeminiResponse {
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: { content?: GeminiContent; finishReason?: string; groundingMetadata?: GroundingMetadata }[];
}

export type GenerateContent = (params: GeminiRequest) => Promise<GeminiResponse>;

export interface AgentOutcome {
  status: "ok" | "refusal" | "steps";
  markdown: string;
  model?: string;
  toolCalls: { name: string; input: unknown }[];
}

/** Replay model parts intact, including thought signatures and function-call IDs.
 * `create` is injectable so the loop can be tested without the Google API.
 */
export async function runAgent(create: GenerateContent, task: string, snapshot: SnapshotT, model: string, maxTurns = 8): Promise<AgentOutcome> {
  const contents: GeminiContent[] = [{ role: "user", parts: [{ text: task }] }];
  const toolCalls: AgentOutcome["toolCalls"] = [];
  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await create({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools: [{ functionDeclarations: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.input_schema })) }],
      // Retrieve evidence before writing any summary.
      toolConfig: { functionCallingConfig: { mode: turn === 0 ? "ANY" : "AUTO" } },
      generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
      contents,
    });
    const candidate = response.candidates?.[0];
    if (response.promptFeedback?.blockReason || ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(candidate?.finishReason ?? "")) {
      return { status: "refusal", markdown: "", toolCalls };
    }
    // Never show a truncated or malformed answer as a completed briefing.
    if (!candidate?.content || candidate.finishReason !== "STOP") return { status: "steps", markdown: "", toolCalls };
    const parts = candidate.content.parts;
    const uses = parts.flatMap((p) => p.functionCall ? [p.functionCall] : []);
    if (!uses.length) {
      const markdown = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("\n").trim();
      return { status: toolCalls.length && markdown ? "ok" : "steps", markdown, model: response.modelVersion ?? model, toolCalls };
    }
    contents.push(candidate.content);
    const results: GeminiPart[] = uses.map((u) => {
      toolCalls.push({ name: u.name, input: u.args ?? {} });
      let response: Record<string, unknown>;
      try {
        response = { result: runTool(u.name, u.args ?? {}, snapshot) };
      } catch {
        response = { error: "The requested lookup could not be completed." };
      }
      return { functionResponse: { name: u.name, response, ...(u.id ? { id: u.id } : {}) } };
    });
    contents.push({ role: "user", parts: results });
  }
  return { status: "steps", markdown: "", toolCalls };
}
