// Public configuration. Only NEXT_PUBLIC_* values reach the browser; the Supabase secret
// key and the Anthropic key are read in server code only (src/lib/supabase/admin.ts,
// src/app/api/*).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);

/** "demo" hides the live workspace even when Supabase is configured. */
export const FORCE_DEMO = process.env.NEXT_PUBLIC_FOODBRIDGE_MODE === "demo";

export const liveAvailable = supabaseConfigured && !FORCE_DEMO;
