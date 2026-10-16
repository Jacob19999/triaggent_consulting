import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_PATH, hasPortalAccess, isOpenPath, portalPassword } from "@/lib/gate";

// 1. Portal password: every page, API route, data file, deck PDF and app chunk needs the
//    gate cookie (src/lib/gate.ts). No configured password means the portal stays closed.
// 2. Refreshes the Supabase session cookie on navigation. Access control inside the app is
//    enforced by row-level security in Postgres and by role checks in the API routes.
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isOpenPath(pathname) && !(await hasPortalAccess(request.cookies.get(GATE_COOKIE)?.value))) {
    return deny(request, pathname + search);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key || pathname.startsWith("/_next/") || pathname.startsWith("/data/") || pathname.startsWith("/deck/")) {
    return response;
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

function deny(request: NextRequest, target: string): Response {
  const headers = { "cache-control": "no-store" };
  if (!portalPassword() && request.nextUrl.pathname !== GATE_PATH) {
    return new NextResponse("FoodBridge is closed: FOODBRIDGE_PORTAL_PASSWORD is not configured.", { status: 503, headers });
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Portal password required" }, { status: 401, headers });
  }
  // Page navigations go to the gate and come back; assets and data files just refuse.
  const isPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (isPage) {
    const gate = new URL(GATE_PATH, request.url);
    if (target !== "/") gate.searchParams.set("next", target);
    return NextResponse.redirect(gate, 307);
  }
  return new NextResponse("Portal password required", { status: 401, headers });
}

export const config = {
  // Everything, including /_next/static (the app bundle embeds county data), /data and
  // /deck. Only the gate page, favicon and robots.txt stay open (isOpenPath).
  matcher: ["/((?!favicon.ico|robots.txt).*)"],
};
