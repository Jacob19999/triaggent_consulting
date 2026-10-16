// Shapes of the research bundle written by `uv run python -m mi.foodbridge_bundle`
// and of the operational records the app stores (Supabase or this browser's county networks copy).

export type Signal = "HouseholdsTotal" | "PoundsTotal" | "IndividualsTotal";
export type AgeSignal = "ChildrenTotal" | "AdultsTotal" | "SeniorsTotal";
export type ForecastSignal = Signal | AgeSignal;
export type Pillar = "N" | "S" | "T" | "M" | "V";

export interface ForecastCell {
  yhat: number | null;
  lo80: number | null;
  hi80: number | null;
  lo95: number | null;
  hi95: number | null;
  status: string;
  sites: number | null;
}

export interface CountyFei {
  fei: number | null;
  N: number | null;
  S: number | null;
  T: number | null;
  M: number | null;
  V: number | null;
  rank?: number | null;
  decile?: number | null;
  quintile?: number | null;
  V_no_race?: number | null;
  beyond_residents?: number | null;
  beyond_share?: number | null;
  miles_nearest?: number | null;
  lbs_per_lowinc?: number | null;
  children_top_quintile?: number | null;
  top_quintile_tracts?: number | null;
  carless_beyond?: number | null;
  shelves_reporting?: number | null;
  snap_participation?: number | null;
  excluded_pounds_share?: number | null;
  stable_high?: boolean | null;
  supply_understated?: boolean | null;
}

export interface County {
  fips: string;
  name: string;
  nonmetro: boolean;
  population: number | null;
  children: number | null;
  seniors: number | null;
  poverty_persons: number | null;
  poverty_rate: number | null;
  below_200_share: number | null;
  rent_burden_share: number | null;
  no_vehicle_share: number | null;
  need_percentile: number | null;
  review: boolean;
  flagged: boolean;
  robust: boolean;
  minimum_gap: number | null;
  gaps: Record<Signal, number | null>;
  annual2024: Record<Signal, number | null>;
  sites_2024: number;
  forecast: Partial<Record<ForecastSignal, ForecastCell>>;
  lila_tracts: number;
  lila_without_site: number;
  mean_miles: number | null;
  share_beyond_1: number | null;
  share_beyond_10: number | null;
  svi: number | null;
  fmr_change_pct: number | null;
  centroid: [number, number] | null;
  fei: CountyFei | null;
}

/** Compact tract record (keys kept short to keep the bundle small). */
export interface Tract {
  g: string; // 2020 tract GEOID
  c: string; // county FIPS
  p: number; // residents (2020)
  d: number | null; // mean straight-line miles to nearest reporting shelf (D-051)
  b1: number | null; // share of residents beyond 1 mile
  b10: number | null; // share beyond 10 miles
  x: number; // centroid longitude (tract geometry, not a shelf point)
  y: number; // centroid latitude
  u: number | null; // USDA SRAM 2025 urban flag
  li: number | null; // USDA low-income tract flag
  lila: number | null; // USDA LILA 2019 (1 and 10 miles) on 2020 tracts
}

export interface FeiTract {
  geoid: string;
  county: string;
  pop?: number | null;
  fei?: number | null;
  N?: number | null;
  S?: number | null;
  T?: number | null;
  M?: number | null;
  V?: number | null;
  A?: number | null;
  d?: number | null;
  d_bm?: number | null;
  beyond?: number | null;
  /** Driving miles / minutes to the nearest reporting shelf and share beyond θ by road (OSRM). */
  d_road?: number | null;
  min_road?: number | null;
  beyond_road?: number | null;
  urban?: number | null;
  theta?: number | null;
  lat?: number | null;
  lon?: number | null;
  demand?: number | null;
  quintile?: number | null;
  decile?: number | null;
  children?: number | null;
  stable_high?: boolean | null;
}

export interface FeiTractPayload {
  tracts: FeiTract[];
  geometry: Record<string, GeoJSONGeometry>;
}

export interface FeiBundle {
  status: "pending" | "invalid" | "ready";
  reason?: string;
  counties?: Record<string, CountyFei>;
  tracts?: FeiTract[];
  meta?: Record<string, unknown>;
  source?: Record<string, string | null>;
}

export interface HistoryRow {
  month: string;
  HouseholdsTotal: number | null;
  PoundsTotal: number | null;
  IndividualsTotal: number | null;
  sites: number;
  workdays: number;
}

export interface PolicyEvent {
  id: string;
  name: string;
  level: string;
  program: string;
  announced: string | null;
  start: string;
  end: string | null;
  affected: string;
  direction: string;
  mn: boolean;
  source: string;
  publisher: string;
  url: string;
  notes: string;
}

export interface FindingSection {
  id: string;
  title: string;
  lead: string;
  markdown: string;
}

export interface Source {
  file: string;
  publisher: string;
  vintage: string;
  meaning: string;
  sha256: string | null;
}

export interface CorrelationRow {
  signal: Signal;
  correlation: number;
  lo95: number;
  hi95: number;
  n: number;
}

export interface ResearchBundle {
  meta: {
    schema_version: number;
    generated_at: string;
    git_commit: string | null;
    research_version: string | null;
    observed_end: string;
    forecast_target: string;
    universe: string | null;
    script: string;
    fei_status: FeiBundle["status"];
    fei_reason: string | null;
  };
  counties: County[];
  geometry: Record<string, GeoJSONGeometry>;
  tracts: Tract[];
  history: HistoryRow[];
  evidence: Record<string, unknown>;
  policy: PolicyEvent[];
  findings: {
    sections: FindingSection[];
    stats: {
      q1_rate: CorrelationRow[];
      q1_count: CorrelationRow[];
      q4: { signal: Signal; max_lag: number; cumulative_elasticity: number; lo95: number; hi95: number }[];
      q5: { signal: Signal; coefficient: number; lo95: number; hi95: number }[];
      q5_noise: {
        event: string;
        month: string;
        signal: Signal;
        residual_pp: number;
        rank_of_all: number;
        months_ranked: number;
      }[];
      q6_checks: { check: string; rule: string; spearman: number; lo95: number; hi95: number; n: number; result: string }[];
      q6_review: number;
      q6_robust: string[];
      q6_flagged: string[];
      q7_state: { signal: ForecastSignal; yhat: number; counties: number }[];
      q7_intervals: { target_month: string; signal: ForecastSignal; coverage80: number; coverage95: number }[];
      q8: {
        lila_tracts: number;
        lila_without_site: number;
        strata: {
          group: string;
          tracts: number;
          population: number;
          mean_miles: number;
          share_beyond_1: number;
          share_beyond_10: number;
        }[];
      };
    };
  };
  fei: FeiBundle;
  sources: Source[];
}

export type GeoJSONGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

// ---------- Operational records (app state) ----------

export type ShelfType = "brick_and_mortar" | "mobile" | "outreach" | "campus" | "tribal";

export interface Shelf {
  id: string;
  name: string;
  county_fips: string;
  type: ShelfType;
  capacity_households: number | null; // households the shelf can serve per month
  storage_lbs: number | null;
  hours: string | null;
  contact_name: string | null;
  active: boolean;
  is_demo: boolean; // seeded county network (removable), not a shelf's own account record
  priority_status: PriorityStatus | null; // manager override
  manager_note: string | null;
  created_at: string;
}

export type PriorityStatus = "urgent" | "support" | "monitor" | "stable";

export interface ShelfReport {
  id: string;
  shelf_id: string;
  month: string; // YYYY-MM
  households: number; // visits, HouseholdsReg
  individuals: number; // IndividualsReg
  children: number;
  adults: number;
  seniors: number;
  pounds_distributed: number; // PoundsReg
  pounds_received: number | null;
  inventory_lbs: number | null; // on hand at month end
  volunteer_hours: number | null;
  turned_away: number | null; // households that could not be served
  notes: string | null;
  submitted_at: string;
  submitted_by: string | null;
}

export type RequestKind = "food" | "volunteers" | "funding" | "transport" | "equipment" | "other";
export type RequestStatus = "open" | "in_progress" | "fulfilled" | "declined";

export interface ShelfRequest {
  id: string;
  shelf_id: string;
  kind: RequestKind;
  urgency: "low" | "normal" | "high";
  message: string;
  pounds_requested: number | null;
  status: RequestStatus;
  response: string | null;
  created_at: string;
  updated_at: string;
  /** Seeded example in the county networks workspace, written from real county totals. */
  hypothetical?: boolean;
}

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface AlertState {
  alert_key: string;
  status: AlertStatus;
  note: string | null;
  updated_at: string;
}

export interface SavedScenario {
  id: string;
  name: string;
  kind: "new_shelf" | "allocation";
  payload: unknown;
  created_at: string;
}

export type Role = "manager" | "shelf";
