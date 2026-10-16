import { NextResponse } from "next/server";
import { BRIEF_LIST_COLUMNS } from "@/lib/briefs";
import { approvedBriefClient, briefQueryError } from "@/lib/briefsApi";

export const runtime = "nodejs";

/** Every approved account reads the same list. Markdown stays on the detail route. */
export async function GET() {
  const access = await approvedBriefClient();
  if (!access.ok) return access.error;
  const { data, error } = await access.supabase
    .from("briefs")
    .select(BRIEF_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return briefQueryError(error);
  return NextResponse.json({ briefs: data ?? [] });
}
