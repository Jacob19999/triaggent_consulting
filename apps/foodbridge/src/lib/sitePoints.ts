import { SITE_TYPES, type SiteType } from "@/lib/networks";

export const SITES_URL = "/data/sites.json";

/** One reporting site at its researched coordinates (D-063): location, type, precision only. */
export interface SitePoint {
  county: string; // county FIPS
  lon: number;
  lat: number;
  type: SiteType;
  /** True when the coordinate marks an area (city, ZIP, community), not the street address. */
  approx: boolean;
}

export interface SitePoints {
  month: string;
  sites: number; // reporting sites in the month
  placed: number;
  exact: number;
  unplaced: number;
  points: SitePoint[];
}

interface Payload {
  meta: { month: string; fields: string[]; types: string[]; sites: number; placed: number; unplaced: number; exact: number };
  counties: Record<string, [lon: number, lat: number, type: number, approx: number][]>;
}

export function sitePointsFrom(payload: Payload): SitePoints {
  const { meta } = payload;
  if (meta.fields.join() !== "lon,lat,type,approx" || meta.types.join() !== SITE_TYPES.join()) {
    throw new Error("sites.json layout changed; rebuild with `uv run python -m mi.foodbridge_bundle --sites`");
  }
  const points: SitePoint[] = [];
  for (const [county, rows] of Object.entries(payload.counties))
    for (const [lon, lat, t, approx] of rows) points.push({ county, lon, lat, type: SITE_TYPES[t], approx: approx === 1 });
  return { month: meta.month, sites: meta.sites, placed: meta.placed, exact: meta.exact, unplaced: meta.unplaced, points };
}

// One download per page; a failed fetch clears the cache so the next caller retries.
let cached: Promise<SitePoints> | null = null;
export function fetchSitePoints(): Promise<SitePoints> {
  cached ??= fetch(SITES_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Site locations unavailable (HTTP ${res.status})`);
      return sitePointsFrom((await res.json()) as Payload);
    })
    .catch((e) => {
      cached = null;
      throw e;
    });
  return cached;
}
