import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { offlineBriefing } from "@/lib/agent/fallback";
import { MODE_PROMPTS } from "@/lib/agent/prompt";
import { runAgent } from "@/lib/agent/run";
import { createGeminiClient, FALLBACK_AI_MODEL, GeminiAPIError, resolveAiModel, shouldFallback } from "@/lib/agent/gemini";
import { clientIp, limited } from "@/lib/agent/limit";
import { Snapshot } from "@/lib/agent/tools";
import { briefRow, isApprovedRole } from "@/lib/briefs";
import { supabaseConfigured } from "@/lib/config";
import { currentProfile, serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  mode: z.enum(["briefing", "county", "shelf", "ask"]),
  question: z.string().max(2000).optional(),
  county: z.string().max(60).optional(),
  snapshot: Snapshot,
});

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 120_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Live workspaces require a signed-in, approved user. The county networks workspace
  // carries only county aggregates, behind the portal password.
  const profile = supabaseConfigured ? await currentProfile() : null;
  if ((body.snapshot.workspace === "live" || process.env.FOODBRIDGE_AI_REQUIRE_AUTH === "true") && !isApprovedRole(profile?.role)) {
    return NextResponse.json({ error: "Sign in to use the briefing agent." }, { status: 401 });
  }

  const finish = async (payload: { mode: "ai" | "offline"; markdown: string; toolCalls: { name: string; input: unknown }[]; model?: string; note?: string }) => {
    const id = await saveBrief(payload);
    return NextResponse.json({ ...payload, saved: Boolean(id), ...(id ? { id } : {}) });
  };

  const saveBrief = async (payload: { mode: "ai" | "offline"; markdown: string; toolCalls: { name: string; input: unknown }[]; model?: string; note?: string }) => {
    if (!isApprovedRole(profile?.role)) return null;
    const row = briefRow({
      mode: body.mode,
      resultMode: payload.mode,
      asOf: body.snapshot.asOf,
      workspace: body.snapshot.workspace,
      markdown: payload.markdown,
      county: body.county,
      question: body.question,
      shelfName: body.snapshot.shelf?.name,
      model: payload.model,
      note: payload.note,
      toolCalls: payload.toolCalls,
    });
    if (!row) return null;
    const supabase = await serverSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("briefs").insert(row).select("id").single();
    if (error || !data?.id) {
      console.error("brief save failed", error?.code ?? error?.message ?? "no id");
      return null;
    }
    return data.id as string;
  };

  const offline = () =>
    finish({
      mode: "offline",
      markdown: offlineBriefing(body.mode, body.snapshot, body.county),
      toolCalls: [],
    });

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return offline();
  const limit = limited(clientIp(req.headers));
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  const model = resolveAiModel();
  const task = [
    MODE_PROMPTS[body.mode],
    `As-of month: ${body.snapshot.asOf}. Workspace: ${body.snapshot.workspace}.`,
    body.county ? `County: ${body.county}.` : "",
    body.question ? `User question: ${body.question}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const deadline = Date.now() + 95_000;
    const generate = (name: string) => runAgent(createGeminiClient(apiKey, name, fetch, deadline), task, body.snapshot, name);
    let result;
    let usedFallback = false;
    try {
      result = await generate(model);
    } catch (e) {
      if (!shouldFallback(e, model)) throw e;
      // Restart the conversation: signatures from one model cannot be replayed to another.
      result = await generate(FALLBACK_AI_MODEL);
      usedFallback = true;
    }
    if ((result.status !== "ok" || !result.markdown) && !usedFallback && model !== FALLBACK_AI_MODEL) {
      result = await generate(FALLBACK_AI_MODEL);
      usedFallback = true;
    }
    if (result.status === "ok" && result.markdown)
      return finish({
        mode: "ai", model: result.model, markdown: result.markdown, toolCalls: result.toolCalls,
        ...(usedFallback ? { note: "Gemini Flash is busy; this summary uses Gemini 3.5 Flash Lite." } : {}),
      });
    return finish({
      mode: "offline",
      markdown: offlineBriefing(body.mode, body.snapshot, body.county),
      toolCalls: result.toolCalls,
      note:
        result.status === "refusal"
          ? "The model declined; showing the offline briefing."
          : "The agent did not finish; showing the offline briefing.",
    });
  } catch (e) {
    const status = e instanceof GeminiAPIError ? e.status : 500;
    console.error("Gemini briefing failed", { status });
    return finish({
      mode: "offline",
      markdown: offlineBriefing(body.mode, body.snapshot, body.county),
      toolCalls: [],
      note: status === 429
        ? "Google Gemini's request limit was reached; showing the offline briefing. Try again later."
        : status === 503
          ? "Google Gemini is experiencing high demand; showing the offline briefing. Try again shortly."
          : status === 504
            ? "Google Gemini timed out; showing the offline briefing."
            : "Google Gemini is unavailable; showing the offline briefing.",
    });
  }
}
