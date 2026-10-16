import "server-only";
import { NextResponse } from "next/server";
import { supabaseConfigured } from "./config";
import { isApprovedRole } from "./briefs";
import { currentProfile, serverSupabase } from "./supabase/server";

type BriefClient = NonNullable<Awaited<ReturnType<typeof serverSupabase>>>;

export async function approvedBriefClient(): Promise<
  | { ok: true; supabase: BriefClient; profile: { id: string; email: string | null; role: "manager" | "shelf"; shelf_id: string | null } }
  | { ok: false; error: NextResponse }
> {
  if (!supabaseConfigured) return { ok: false, error: NextResponse.json({ error: "Sign-in is not configured" }, { status: 503 }) };
  const profile = await currentProfile();
  if (!profile || !isApprovedRole(profile.role)) {
    return { ok: false, error: NextResponse.json({ error: "Sign in to read saved briefings." }, { status: 401 }) };
  }
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: NextResponse.json({ error: "Sign-in is not configured" }, { status: 503 }) };
  return { ok: true, supabase, profile: { ...profile, role: profile.role } };
}

export function briefQueryError(error: { code?: string; message: string }) {
  if (error.code === "42P01" || /relation .*briefs.* does not exist/i.test(error.message)) {
    return NextResponse.json({ error: "Saved briefings are not set up on this project yet." }, { status: 503 });
  }
  console.error("brief query failed", error.code ?? error.message);
  return NextResponse.json({ error: "Saved briefings are unavailable." }, { status: 500 });
}

export function isBriefId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
