import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/config";
import { research } from "@/lib/research";
import { resolveAiModel } from "@/lib/agent/gemini";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    bundle: { generated_at: research.meta.generated_at, commit: research.meta.git_commit, fei: research.meta.fei_status },
    supabase: supabaseConfigured,
    ai: Boolean(process.env.GEMINI_API_KEY?.trim()),
    aiProvider: "google",
    aiModel: resolveAiModel(),
  });
}
