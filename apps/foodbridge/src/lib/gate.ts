// Portal password gate (middleware + /gate). Runs on the Edge and Node runtimes, so it
// uses Web Crypto only. The cookie holds a SHA-256 of the configured password rather than
// the password itself; changing FOODBRIDGE_PORTAL_PASSWORD signs every browser out.

export const GATE_COOKIE = "fb_portal";
export const GATE_PATH = "/gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 7; // seconds

/** Configured portal password, or null. Unset means the portal refuses every request. */
export function portalPassword(): string | null {
  const value = process.env.FOODBRIDGE_PORTAL_PASSWORD?.trim();
  return value ? value : null;
}

export async function gateToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`foodbridge-portal:v1:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison (no early exit on the first differing character). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hasPortalAccess(cookie: string | undefined): Promise<boolean> {
  const password = portalPassword();
  if (!password || !cookie) return false;
  return safeEqual(cookie, await gateToken(password));
}

/** Same-site relative path to return to after the gate; anything else falls back to "/". */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next.startsWith(GATE_PATH) ? "/" : next;
}

/** Paths served without the cookie: the self-contained gate page, favicon and robots.txt. */
export function isOpenPath(pathname: string): boolean {
  return pathname === GATE_PATH || pathname === "/favicon.ico" || pathname === "/robots.txt";
}
