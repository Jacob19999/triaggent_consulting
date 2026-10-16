import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/config";
import { research } from "@/lib/research";
import { DEFAULT_AI_MODEL } from "@/lib/agent/gemini";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    bundle: { generated_at: research.meta.generated_at, commit: research.meta.git_commit, fei: research.meta.fei_status },
    supabase: supabaseConfigured,
    ai: Boolean(process.env.GEMINI_API_KEY?.trim()),
    aiProvider: "google",
    aiModel: process.env.FOODBRIDGE_AI_MODEL?.trim() || DEFAULT_AI_MODEL,
  });
}
