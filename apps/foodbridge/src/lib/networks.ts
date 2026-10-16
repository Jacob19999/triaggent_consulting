// County food-shelf networks: one record per county, each month summed over the sites that
// reported to the statewide network (food_shelf_broad, the repaired Q7 training panel).
// Real sponsor aggregates at county grain from public/data/networks.json, written by
// `uv run python -m mi.county_networks` then `mi.foodbridge_bundle`; no site rows or names.
// Fields the extract does not carry (stock, receipts, capacity, turn-aways, volunteer
// hours, opening hours, contact) stay null rather than invented.

import { hypotheticalRequests } from "./hypotheticalRequests";
import { research } from "./research";
import type { Shelf, ShelfReport, ShelfRequest } from "./types";

export const NETWORK_AS_OF = research.meta.observed_end; // "2026-07"
export const NETWORKS_URL = "/data/networks.json";
const NETWORKS_FILE = "outputs/tables/county_network_month.csv";
/** Fingerprint of the network table this build ships; keys the browser's saved copy. */
export const NETWORKS_SHA = research.sources.find((s) => s.file === NETWORKS_FILE)?.sha256 ?? "unversioned";

const FIELDS = [
  "month",
  "n_sites",
  "HouseholdsReg",
  "IndividualsReg",
  "ChildrenReg",
  "AdultsReg",
  "SeniorsReg",
  "PoundsReg",
  "partial_fields",
] as const;

type NetworkRow = [
  month: string,
  sites: number,
  households: number,
  individuals: number,
  children: number,
  adults: number,
  seniors: number,
  pounds: number,
  partial: string | null,
];

/** Organization.AgencyType values in the food_shelf_broad universe (D-014). */
export const SITE_TYPES = ["Brick and Mortar Site", "Outreach Program", "Tribal Program", "College Campus Program"] as const;
export type SiteType = (typeof SITE_TYPES)[number];
const TYPE_FIELDS = ["n_sites", "HouseholdsReg", "PoundsReg"] as const;
type TypeRow = [sites: number, households: number | null, pounds: number | null];

export interface SiteTypeCell {
  sites: number;
  households: number | null; // HouseholdsReg
  pounds: number | null; // PoundsReg
}
export type CountyTypes = Record<string, Partial<Record<SiteType, SiteTypeCell>>>;
/** County FIPS -> reporting sites by type in `month`, and the same month a year earlier
 * (`prior`). Counts per type, never site rows. */
export interface SiteTypeMix {
  month: string | null;
  counties: CountyTypes;
  prior: { month: string | null; counties: CountyTypes };
}

export interface NetworkPayload {
  meta: {
    fields: string[];
    type_fields?: string[];
    types_month?: string | null;
    types_prior_month?: string | null;
    universe: string;
    observed_start: string;
    observed_end: string;
    generated_at: string;
    source: string;
    sha256: string | null;
    script: string;
  };
  counties: { fips: string; name: string; rows: NetworkRow[]; types?: Partial<Record<SiteType, TypeRow>>; types_prior?: Partial<Record<SiteType, TypeRow>> }[];
}

export interface NetworkData {
  shelves: Shelf[];
  reports: ShelfReport[];
  requests: ShelfRequest[];
}

export const networkId = (fips: string) => `network-${fips}`;

function note(sites: number, partial: string | null, universe: string): string {
  const base = `${sites} reporting site${sites === 1 ? "" : "s"} (${universe})`;
  return partial
    ? `${base}. Some sites left ${partial.split(";").join(", ")} blank; the total covers the sites that filled it.`
    : `${base}.`;
}

export function buildNetworkData(payload: NetworkPayload): NetworkData {
  if (payload.meta.fields.join() !== FIELDS.join()) {
    throw new Error("networks.json field order changed; rebuild with `uv run python -m mi.foodbridge_bundle`");
  }
  const { generated_at: stamp, universe } = payload.meta;
  const shelves: Shelf[] = [];
  const reports: ShelfReport[] = [];
  for (const c of payload.counties) {
    const id = networkId(c.fips);
    shelves.push({
      id,
      name: `${c.name} County network`,
      county_fips: c.fips,
      type: "brick_and_mortar",
      capacity_households: null,
      storage_lbs: null,
      hours: null,
      contact_name: null,
      active: true,
      is_demo: true,
      priority_status: null,
      manager_note: null,
      created_at: stamp,
    });
    for (const [month, sites, households, individuals, children, adults, seniors, pounds, partial] of c.rows) {
      // Observed months only: the app never holds a value at or after the forecast target.
      if (month > NETWORK_AS_OF) continue;
      reports.push({
        id: `${id}-${month}`,
        shelf_id: id,
        month,
        households,
        individuals,
        children,
        adults,
        seniors,
        pounds_distributed: pounds,
        pounds_received: null,
        inventory_lbs: null,
        volunteer_hours: null,
        turned_away: null,
        notes: note(sites, partial, universe),
        submitted_at: stamp,
        submitted_by: "statewide extract",
      });
    }
  }
  return { shelves, reports, requests: hypotheticalRequests(shelves, reports, NETWORK_AS_OF) };
}

const typeCells = (t: Partial<Record<SiteType, TypeRow>> = {}) =>
  Object.fromEntries(Object.entries(t).map(([k, [sites, households, pounds]]) => [k, { sites, households, pounds }])) as Partial<Record<SiteType, SiteTypeCell>>;

/** Site-type mix per county; empty when the bundle was built without county_site_types.csv. */
export function siteTypesFrom(payload: NetworkPayload): SiteTypeMix {
  const month = payload.meta.types_month ?? null;
  const priorMonth = payload.meta.types_prior_month ?? null;
  if (!month) return { month: null, counties: {}, prior: { month: null, counties: {} } };
  if ((payload.meta.type_fields ?? []).join() !== TYPE_FIELDS.join()) {
    throw new Error("networks.json type fields changed; rebuild with `uv run python -m mi.foodbridge_bundle`");
  }
  const counties: CountyTypes = {};
  const prior: CountyTypes = {};
  for (const c of payload.counties) {
    counties[c.fips] = typeCells(c.types);
    if (priorMonth) prior[c.fips] = typeCells(c.types_prior);
  }
  return { month, counties, prior: { month: priorMonth, counties: prior } };
}

// One download per page: the store seed and the map's site-type layer share it.
let payload: Promise<NetworkPayload> | null = null;
export function fetchNetworkPayload(): Promise<NetworkPayload> {
  payload ??= fetch(NETWORKS_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`County networks unavailable (HTTP ${res.status})`);
      return (await res.json()) as NetworkPayload;
    })
    .catch((e) => {
      payload = null; // let the next caller retry
      throw e;
    });
  return payload;
}

export async function fetchNetworkData(): Promise<NetworkData> {
  return buildNetworkData(await fetchNetworkPayload());
}

/** Insert-ready rows with fresh ids, for the live workspace's "Load county networks" and
 * the Supabase integration test. */
export function networkInsertRows(data: NetworkData, uid: () => string, limit?: number) {
  const picked = limit ? data.shelves.slice(0, limit) : data.shelves;
  const ids = new Map<string, string>();
  const shelves = picked.map((sh) => {
    const id = uid();
    ids.set(sh.id, id);
    const { created_at: _c, ...rest } = sh;
    return { ...rest, id, is_demo: true };
  });
  const reports = data.reports
    .filter((r) => ids.has(r.shelf_id))
    .map(({ id: _id, submitted_by: _b, submitted_at: _s, ...r }) => ({ ...r, shelf_id: ids.get(r.shelf_id)! }));
  return { shelves, reports };
}
