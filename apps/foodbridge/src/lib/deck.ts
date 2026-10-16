// Extra statistics for the judging deck (/present), written by
// `uv run python -m mi.foodbridge_bundle --deck` from outputs/tables.
import raw from "@data/deck.json";
import type { Signal } from "./types";

interface Range {
  coef: number;
  lo95: number;
  hi95: number;
}

export interface DeckFacts {
  meta: { generated_at: string; git_commit: string | null; script: string; year: number; cpi_series: string; sources: Record<string, { file: string; sha256: string | null }> };
  /** County names only, largest residual first (no residual values; D-050). */
  q1_outliers: Record<Signal, { lower_activity: string[]; higher_activity: string[] }>;
  q1_drivers: Record<Signal, { r_squared: number; terms: Record<"poverty_rate" | "no_vehicle_rate" | "nonmetro" | "site_density", Range> }>;
  q1_distance: Record<Signal, { rho: number; p: number; n: number }>;
  q4_prices: { month: string; cpi: number }[];
  q4_workdays: Record<Signal, { elasticity: number; pct_per_day: number }>;
  q4_months: Record<Signal, { month: number; log_change: number }[]>;
  q5_place: Record<Signal, Range>;
  q8_presence: Record<"rural_better_access" | "rural_low_access" | "urban_better_access" | "urban_low_access", { tracts: number; with_site: number; share: number }>;
  q8_road: Record<"rural_better_access" | "rural_low_access" | "urban_better_access" | "urban_low_access", { mean_miles: number; share_beyond_10: number }>;
  q6_chance: { flagged: number; flagged_by_chance: number; survivors: number; survivors_by_chance: number };
}

export const deck = raw as unknown as DeckFacts;
