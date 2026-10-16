import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, GATE_PATH, gateToken, hasPortalAccess, portalPassword, safeEqual, safeNext } from "@/lib/gate";

// Plain HTML (no React, no script) so the page works before the browser may load any
// gated app chunk.
export const dynamic = "force-dynamic";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(next: string, message: string | null, configured: boolean, status = 200): Response {
  const body = configured
    ? `<form method="post" action="${GATE_PATH}">
        <input type="hidden" name="next" value="${escape(next)}">
        <label for="pw">Portal password</label>
        <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
        ${message ? `<p class="err" role="alert">${escape(message)}</p>` : ""}
        <button type="submit">Enter</button>
      </form>`
    : `<p class="err" role="alert">The portal password is not configured on this deployment, so FoodBridge stays closed. Set FOODBRIDGE_PORTAL_PASSWORD and redeploy.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>FoodBridge · password required</title>
<style>
:root{color-scheme:dark light}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#0b1219;color:#e6edf3;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(380px,92vw);background:#121c26;border:1px solid #23313f;border-radius:14px;padding:28px}
h1{margin:0 0 4px;font-size:20px}p{margin:0 0 18px;color:#9fb0c0;font-size:13.5px}
label{display:block;font-size:13px;margin-bottom:6px;color:#c9d4de}
input[type=password]{box-sizing:border-box;width:100%;height:40px;border-radius:9px;border:1px solid #2c3d4e;background:#0b1219;color:inherit;padding:0 12px;font-size:15px}
input:focus{outline:2px solid #d9e7a9;outline-offset:1px}
button{margin-top:14px;width:100%;height:40px;border:0;border-radius:9px;background:#d9e7a9;color:#143f35;font-weight:600;font-size:14.5px;cursor:pointer}
.err{margin:10px 0 0;color:#ff8a80}
</style></head><body><main>
<h1>FoodBridge</h1><p>This portal is private to the team and The Food Group. Enter the portal password to continue.</p>
${body}
</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Relative 303 so the browser stays on the host it used (the cookie is host-scoped). */
function seeOther(location: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { location, "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  if (url.searchParams.has("signout")) {
    const res = seeOther(GATE_PATH);
    res.cookies.delete(GATE_COOKIE);
    return res;
  }
  if (!portalPassword()) return page(next, null, false, 503);
  if (await hasPortalAccess(req.cookies.get(GATE_COOKIE)?.value)) return seeOther(next);
  return page(next, url.searchParams.has("e") ? "That password is not right." : null, true);
}

export async function POST(req: NextRequest) {
  const password = portalPassword();
  const form = await req.formData().catch(() => null);
  const next = safeNext(String(form?.get("next") ?? ""));
  if (!password) return page(next, null, false, 503);
  const given = String(form?.get("password") ?? "");
  const ok = safeEqual(await gateToken(given), await gateToken(password));
  if (!ok) {
    // Slows guessing a little; the real protection is a stronger password.
    await new Promise((r) => setTimeout(r, 600));
    const query = new URLSearchParams({ e: "1", ...(next !== "/" ? { next } : {}) });
    return seeOther(`${GATE_PATH}?${query}`);
  }
  const res = seeOther(next);
  res.cookies.set(GATE_COOKIE, await gateToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
