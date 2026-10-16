// Driving access for a proposed site, from the team's Minnesota OSRM server via /api/drive.
// Loads after the straight-line result, which never waits for it; when routing is offline the
// planner keeps its straight-line figures. Residents still sit at tract centroids.

import { haversineMiles } from "./geo";
import type { FeiTract } from "./types";

export interface LonLat {
  lon: number;
  lat: number;
}

/** One entry per destination, null where OSRM found no route. */
export interface DriveTable {
  miles: (number | null)[];
  minutes: (number | null)[];
}

export type DriveStatus = "idle" | "loading" | "ready" | "unavailable";

export interface DriveReach {
  tractsRouted: number;
  /** Residents whose nearest shelf by road would be the new site. */
  residentsCloser: number;
  /** Population-weighted drive minutes saved among those residents. */
  avgMinutesSaved: number;
  avgMilesSaved: number;
  /** Residents now beyond θ road miles (1 urban, 10 rural) who would come within it. */
  residentsNewlyWithin: number;
  /** Residents whose tract centroid is within 15 minutes' drive of the site. */
  residentsWithin15Min: number;
}

/** Upper bound on destinations per planner request; the API splits them for OSRM. */
export const MAX_TARGETS = 800;
export const DRIVE_MINUTES_RING = 15;
/** Road miles run 1.2–1.8× straight-line miles in Minnesota tracts (p10–p90, D-064). */
const ROAD_FACTOR_FALLBACK = 1.4;

export async function fetchDriveTable(origin: LonLat, targets: LonLat[], signal?: AbortSignal): Promise<DriveTable> {
  const res = await fetch("/api/drive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin, targets }),
    signal,
  });
  if (!res.ok) throw new Error(`drive ${res.status}`);
  return (await res.json()) as DriveTable;
}

/** Tracts the site could serve better by road: a road trip is never shorter than the straight
 * line, so a tract whose straight-line distance already exceeds its current road distance
 * cannot gain. Nearest first, capped at ``MAX_TARGETS``. */
export function driveCandidates(site: LonLat, tracts: FeiTract[]): FeiTract[] {
  const out: { t: FeiTract; miles: number }[] = [];
  for (const t of tracts) {
    if (t.lat == null || t.lon == null || !(t.pop ?? 0)) continue;
    const today = t.d_road ?? (t.d != null ? t.d * ROAD_FACTOR_FALLBACK : null);
    if (today == null) continue;
    const miles = haversineMiles(t.lon, t.lat, site.lon, site.lat);
    if (miles < today || miles * ROAD_FACTOR_FALLBACK <= DRIVE_MINUTES_RING) out.push({ t, miles });
  }
  return out
    .sort((a, b) => a.miles - b.miles)
    .slice(0, MAX_TARGETS)
    .map((x) => x.t);
}

export function driveReach(tracts: FeiTract[], table: DriveTable): DriveReach {
  let routed = 0,
    closer = 0,
    savedMin = 0,
    savedMi = 0,
    newly = 0,
    within15 = 0;
  tracts.forEach((t, i) => {
    const miles = table.miles[i];
    const minutes = table.minutes[i];
    if (miles == null || minutes == null) return;
    routed++;
    const pop = t.pop ?? 0;
    if (minutes <= DRIVE_MINUTES_RING) within15 += pop;
    if (t.d_road == null || miles >= t.d_road) return;
    closer += pop;
    savedMi += pop * (t.d_road - miles);
    if (t.min_road != null) savedMin += pop * Math.max(0, t.min_road - minutes);
    const theta = t.theta ?? ((t.urban ?? 0) === 1 ? 1 : 10);
    if (miles <= theta) newly += pop * (t.beyond_road ?? 0);
  });
  return {
    tractsRouted: routed,
    residentsCloser: closer,
    avgMinutesSaved: closer ? savedMin / closer : 0,
    avgMilesSaved: closer ? savedMi / closer : 0,
    residentsNewlyWithin: newly,
    residentsWithin15Min: within15,
  };
}

/** Request, then summarize; resolves null when routing is unavailable. */
export async function loadDriveReach(site: LonLat, tracts: FeiTract[], signal?: AbortSignal): Promise<DriveReach | null> {
  const targets = driveCandidates(site, tracts);
  if (!targets.length) return driveReach([], { miles: [], minutes: [] });
  try {
    const table = await fetchDriveTable(
      site,
      targets.map((t) => ({ lon: t.lon!, lat: t.lat! })),
      signal,
    );
    return driveReach(targets, table);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return null;
  }
}
