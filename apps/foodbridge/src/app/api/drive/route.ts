import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_TARGETS, type DriveTable } from "@/lib/drive";

// Driving miles and minutes from one point to many, through the team's Minnesota OSRM server
// (deploy/osrm). OSRM_URL and OSRM_KEY are server-only; the browser never sees either. Only
// the planner's own coordinates (a proposed site and public tract centroids) are sent.

export const dynamic = "force-dynamic";

const METERS_PER_MILE = 1609.344;
/** Destinations per OSRM /table call: keeps the URL far below OSRM's and nginx's header limits. */
const BATCH = 300;
const TIMEOUT_MS = 12_000;

// Minnesota with a small margin; anything else is refused before it reaches the server.
const lon = z.number().min(-97.5).max(-89.0);
const lat = z.number().min(43.3).max(49.5);
const point = z.object({ lon, lat });
const body = z.object({ origin: point, targets: z.array(point).min(1).max(MAX_TARGETS) });

type Point = z.infer<typeof point>;

function osrmConfig(): { url: string; key: string } | null {
  const url = process.env.OSRM_URL?.trim().replace(/\/+$/, "");
  const key = process.env.OSRM_KEY?.trim();
  return url && key ? { url, key } : null;
}

const coord = (p: Point) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`;

async function table(cfg: { url: string; key: string }, origin: Point, targets: Point[], signal: AbortSignal): Promise<DriveTable> {
  const coords = [origin, ...targets].map(coord).join(";");
  const destinations = targets.map((_, i) => i + 1).join(";");
  const res = await fetch(
    `${cfg.url}/table/v1/driving/${coords}?sources=0&destinations=${destinations}&annotations=distance,duration`,
    { headers: { "X-OSRM-Key": cfg.key }, signal, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const json = (await res.json()) as { code?: string; distances?: (number | null)[][]; durations?: (number | null)[][] };
  if (json.code !== "Ok" || !json.distances?.[0] || !json.durations?.[0]) throw new Error(`OSRM ${json.code ?? "error"}`);
  return {
    miles: json.distances[0].map((m) => (m == null ? null : m / METERS_PER_MILE)),
    minutes: json.durations[0].map((s) => (s == null ? null : s / 60)),
  };
}

export async function POST(request: Request) {
  const cfg = osrmConfig();
  if (!cfg) return NextResponse.json({ error: "Road routing is not configured" }, { status: 503 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { origin, targets } = parsed.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const parts: Promise<DriveTable>[] = [];
    for (let i = 0; i < targets.length; i += BATCH) parts.push(table(cfg, origin, targets.slice(i, i + BATCH), controller.signal));
    const done = await Promise.all(parts);
    return NextResponse.json(
      { miles: done.flatMap((d) => d.miles), minutes: done.flatMap((d) => d.minutes) } satisfies DriveTable,
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Road routing is unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
