import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminSupabase } from "@/lib/supabase/admin";
import { currentProfile } from "@/lib/supabase/server";

const Body = z.object({ email: z.email().max(254), shelf_id: z.uuid() });

// Manager-only: create (or find) the coordinator's account and link it to a shelf.
// The secret key never leaves the server; the requester's role is checked first.
export async function POST(req: NextRequest) {
  const me = await currentProfile();
  if (!me || me.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and shelf" }, { status: 400 });
  const admin = adminSupabase();
  if (!admin) return NextResponse.json({ error: "Server is missing SUPABASE_SECRET_KEY" }, { status: 500 });
  const { email, shelf_id } = parsed.data;

  const shelf = await admin.from("shelves").select("id").eq("id", shelf_id).single();
  if (shelf.error) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });

  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) userId = created.data.user.id;
  else {
    const existing = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    userId = existing.data?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: created.error?.message ?? "Could not create the account" }, { status: 400 });
  const current = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (current.data?.role === "manager")
    return NextResponse.json({ error: "That account is a manager; change roles in Supabase instead." }, { status: 409 });
  const linked = await admin.from("profiles").upsert({ id: userId, email, role: "shelf", shelf_id });
  if (linked.error) return NextResponse.json({ error: linked.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
