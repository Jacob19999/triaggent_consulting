import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { offlineBriefing } from "@/lib/agent/fallback";
import { MODE_PROMPTS } from "@/lib/agent/prompt";
import { runAgent } from "@/lib/agent/run";
import { createGeminiClient, DEFAULT_AI_MODEL, FALLBACK_AI_MODEL, GeminiAPIError } from "@/lib/agent/gemini";
import { Snapshot } from "@/lib/agent/tools";
import { supabaseConfigured } from "@/lib/config";
import { currentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  mode: z.enum(["briefing", "county", "shelf", "ask"]),
  question: z.string().max(2000).optional(),
  county: z.string().max(60).optional(),
  snapshot: Snapshot,
});

// Per-instance limiter: enough for a demo deployment. For durable limits across
// instances, back this with Upstash Redis or Vercel KV (see README).
const hits = new Map<string, number[]>();
let daily = { day: "", count: 0 };
function limited(ip: string): string | null {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= Number(process.env.FOODBRIDGE_AI_PER_IP ?? 8)) return "Too many requests. Try again in a few minutes.";
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) daily = { day: today, count: 0 };
  if (daily.count >= Number(process.env.FOODBRIDGE_AI_DAILY_LIMIT ?? 300)) return "The daily AI limit for this deployment is reached.";
  recent.push(now);
  hits.set(ip, recent);
  daily.count++;
  return null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 120_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Live workspaces require a signed-in, approved user. Demo workspaces carry only
  // synthetic shelves and public research aggregates.
  if (body.snapshot.workspace === "live" || process.env.FOODBRIDGE_AI_REQUIRE_AUTH === "true") {
    const profile = supabaseConfigured ? await currentProfile() : null;
    if (!profile || profile.role === "pending") return NextResponse.json({ error: "Sign in to use the briefing agent." }, { status: 401 });
  }

  const offline = () =>
    NextResponse.json({
      mode: "offline",
      markdown: offlineBriefing(body.mode, body.snapshot, body.county),
      toolCalls: [],
    });

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return offline();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = limited(ip);
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  const model = process.env.FOODBRIDGE_AI_MODEL?.trim() || DEFAULT_AI_MODEL;
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
      if (!(e instanceof GeminiAPIError) || e.status !== 503 || model !== DEFAULT_AI_MODEL) throw e;
      // Restart the conversation: signatures from one model cannot be replayed to another.
      result = await generate(FALLBACK_AI_MODEL);
      usedFallback = true;
    }
    if (result.status === "ok" && result.markdown)
      return NextResponse.json({
        mode: "ai", model: result.model, markdown: result.markdown, toolCalls: result.toolCalls,
        ...(usedFallback ? { note: "Gemini Flash is busy; this summary uses Gemini Flash-Lite." } : {}),
      });
    return NextResponse.json({
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
    return NextResponse.json({
      mode: "offline",
      markdown: offlineBriefing(body.mode, body.snapshot, body.county),
      toolCalls: [],
      note: status === 429
        ? "Google Gemini's request limit was reached; showing the offline briefing. Try again later."
        : status === 503
          ? "Google Gemini is experiencing high demand; showing the offline briefing. Try again shortly."
          : "Google Gemini is unavailable; showing the offline briefing.",
    });
  }
}
