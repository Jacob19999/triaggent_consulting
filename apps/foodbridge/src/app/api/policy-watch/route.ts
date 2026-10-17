import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createGeminiClient, FALLBACK_AI_MODEL, GeminiAPIError, resolveAiModel, shouldFallback } from "@/lib/agent/gemini";
import { clientIp, limited } from "@/lib/agent/limit";
import { policyWatchTask } from "@/lib/agent/policyTask";
import { POLICY_WATCH_PROMPT } from "@/lib/agent/prompt";
import type { GeminiResponse } from "@/lib/agent/run";
import { supabaseConfigured } from "@/lib/config";
import { parseScan, type WebPolicyScan } from "@/lib/policyWatch";
import { currentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  workspace: z.enum(["demo", "live"]),
  asOf: z.string().regex(/^\d{4}-\d{2}$/),
  refresh: z.boolean().optional(),
});

// Web results change slowly; one scan per instance per half hour saves search quota.
const TTL = 30 * 60 * 1000;
const cache = new Map<string, { at: number; scan: WebPolicyScan }>();

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 2_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body.workspace === "live" || process.env.FOODBRIDGE_AI_REQUIRE_AUTH === "true") {
    const profile = supabaseConfigured ? await currentProfile() : null;
    if (!profile || profile.role === "pending") return NextResponse.json({ error: "Sign in to use the policy watch." }, { status: 401 });
  }

  const offline = (note: string): WebPolicyScan => ({ mode: "offline", fetchedAt: new Date().toISOString(), items: [], searched: [], queries: [], note });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json(offline("No Gemini key is configured; showing the tracked timeline only."));

  const key = body.asOf;
  const hit = cache.get(key);
  if (hit && !body.refresh && Date.now() - hit.at < TTL) return NextResponse.json(hit.scan);

  const limit = limited(clientIp(req.headers));
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  const model = resolveAiModel();
  const today = new Date().toISOString().slice(0, 10);
  const deadline = Date.now() + 95_000;
  const ask = (name: string) =>
    createGeminiClient(apiKey, name, fetch, deadline)({
      systemInstruction: { parts: [{ text: POLICY_WATCH_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: policyWatchTask(body.asOf, today) }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
    });

  try {
    let response: GeminiResponse;
    let usedFallback = false;
    try {
      response = await ask(model);
    } catch (e) {
      if (!shouldFallback(e, model)) throw e;
      response = await ask(FALLBACK_AI_MODEL);
      usedFallback = true;
    }
    const candidate = response.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("\n");
    const parsed = candidate?.finishReason === "STOP" ? parseScan(text) : null;
    if (!parsed) return NextResponse.json(offline("Gemini did not return a usable policy scan; showing the tracked timeline only."));
    const grounding = candidate?.groundingMetadata;
    const scan: WebPolicyScan = {
      mode: "ai",
      fetchedAt: new Date().toISOString(),
      model: response.modelVersion ?? (usedFallback ? FALLBACK_AI_MODEL : model),
      summary: parsed.summary,
      items: parsed.items,
      dropped: parsed.dropped,
      queries: (grounding?.webSearchQueries ?? []).slice(0, 12),
      searched: (grounding?.groundingChunks ?? [])
        .flatMap((c) => (c.web?.uri && /^https:\/\//.test(c.web.uri) ? [{ title: (c.web.title ?? c.web.uri).slice(0, 200), url: c.web.uri }] : []))
        .slice(0, 20),
      ...(usedFallback ? { note: "Gemini Flash is busy; this scan uses Gemini 3.5 Flash Lite." } : {}),
    };
    cache.set(key, { at: Date.now(), scan });
    return NextResponse.json(scan);
  } catch (e) {
    const status = e instanceof GeminiAPIError ? e.status : 500;
    console.error("Gemini policy scan failed", { status });
    return NextResponse.json(
      offline(
        status === 429
          ? "Google Gemini's request limit was reached; showing the tracked timeline. Try again later."
          : "Google Gemini is unavailable; showing the tracked timeline.",
      ),
    );
  }
}
