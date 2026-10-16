import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverSupabase } from "@/lib/supabase/server";

// Completes a magic-link sign-in: PKCE `code` from signInWithOtp, or `token_hash` when
// the email template links straight to the app.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/", url));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing sign-in code") };
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url));
  const { data } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user?.id ?? "").single();
  const dest = profile?.role === "shelf" ? "/shelf" : "/manager";
  return NextResponse.redirect(new URL(dest, url));
}
