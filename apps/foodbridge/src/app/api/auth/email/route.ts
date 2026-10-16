import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminSupabase } from "@/lib/supabase/admin";
import { emailOnlyEnabled } from "@/lib/supabase/emailOnly";
import { serverSupabase } from "@/lib/supabase/server";

const Body = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });

// Explicitly enabled prototype: email is an account selector, not proof of identity.
// generateLink creates missing accounts without sending email; verifyOtp stores the
// resulting user session in cookies. Neither the admin key nor tokens are returned.
export async function POST(req: NextRequest) {
  if (!emailOnlyEnabled()) return NextResponse.json({ error: "Email-only sign-in is disabled" }, { status: 404 });
  const url = new URL(req.url);
  const origin = `${url.protocol}//${req.headers.get("host") ?? url.host}`;
  if (req.headers.get("origin") !== origin)
    return NextResponse.json({ error: "Same-origin requests only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const admin = adminSupabase();
  const supabase = await serverSupabase();
  if (!admin || !supabase) return NextResponse.json({ error: "Sign-in is not configured" }, { status: 503 });

  const { email } = parsed.data;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.user || !data.properties?.hashed_token)
    return NextResponse.json({ error: "Could not create or open this account. Please try again." }, { status: 502 });

  const id = data.user.id;
  const profile = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
  if (profile.error) return NextResponse.json({ error: "Could not load account access" }, { status: 502 });
  let role = profile.data?.role;
  if (!role || role === "pending") {
    // New prototype accounts open the manager workspace. Existing shelf roles stay intact.
    const granted = role
      ? await admin.from("profiles").update({ role: "manager" }).eq("id", id).eq("role", "pending")
      : await admin.from("profiles").insert({ id, email, role: "manager" });
    if (granted.error) return NextResponse.json({ error: "Could not enable workspace access" }, { status: 502 });
    role = "manager";
  }
  // Supabase returns a signup token for a new account and a magiclink token thereafter.
  const type = data.properties.verification_type === "signup" ? "signup" : "magiclink";
  const signedIn = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type });
  if (signedIn.error || !signedIn.data.session)
    return NextResponse.json({ error: "Could not sign in. Please try again." }, { status: 502 });
  return NextResponse.json({ redirect: role === "shelf" ? "/shelf" : "/manager" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
