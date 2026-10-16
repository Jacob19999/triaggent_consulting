import { NextResponse } from "next/server";
import { BRIEF_DETAIL_COLUMNS } from "@/lib/briefs";
import { approvedBriefClient, briefQueryError, isBriefId } from "@/lib/briefsApi";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isBriefId(id)) return NextResponse.json({ error: "Unknown briefing" }, { status: 404 });
  const access = await approvedBriefClient();
  if (!access.ok) return access.error;
  const { data, error } = await access.supabase.from("briefs").select(BRIEF_DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) return briefQueryError(error);
  if (!data) return NextResponse.json({ error: "Unknown briefing" }, { status: 404 });
  return NextResponse.json({ brief: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isBriefId(id)) return NextResponse.json({ error: "Unknown briefing" }, { status: 404 });
  const access = await approvedBriefClient();
  if (!access.ok) return access.error;
  if (access.profile.role !== "manager") {
    return NextResponse.json({ error: "A manager can remove a saved briefing." }, { status: 403 });
  }
  const { error, count } = await access.supabase.from("briefs").delete({ count: "exact" }).eq("id", id);
  if (error) return briefQueryError(error);
  if (!count) return NextResponse.json({ error: "Unknown briefing" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
