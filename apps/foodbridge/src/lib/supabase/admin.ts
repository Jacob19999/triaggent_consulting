import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../config";

/** Service client with the secret key. Server only; bypasses RLS, so every caller must
 * check the requesting user's role first, except the explicitly enabled
 * email-only prototype sign-in route. */
export function adminSupabase() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
