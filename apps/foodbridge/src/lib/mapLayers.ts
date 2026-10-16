// Map layers shared by the explorer and the site planner. Each layer names its field,
// source and direction. County-only measures are not spread onto tracts (D-020):
// they are switched off at tract level instead.

import { fmt } from "./format";
import { PILLARS } from "./pillars";
import type { RampId } from "./ramps";
import { countiesByFips, equityValue, feiReady, research } from "./research";
import type { County, FeiTract, Pillar, Tract } from "./types";

/** One tract with its FEI row and its USDA flags (both are tract aggregates). */
export interface TractRow extends FeiTract {
  name: string;
  li: number | null;
  lila: number | null;
  b1: number | null;
  b10: number | null;
  urbanFlag: number | null;
}

export function mergeTracts(fei: FeiTract[]): TractRow[] {
  const flags = new Map<string, Tract>(research.tracts.map((t) => [t.g, t]));
  return fei.map((t) => {
    const f = flags.get(t.geoid);
    return {
      ...t,
      name: `Tract ${t.geoid.slice(5, 9)}.${t.geoid.slice(9)}`,
      li: f?.li ?? null,
      lila: f?.lila ?? null,
      b1: f?.b1 ?? null,
      b10: f?.b10 ?? null,
      urbanFlag: f?.u ?? t.urban ?? null,
    };
  });
}

export type Unit = "county" | "tract";

export interface LayerDef {
  id: string;
  group: string;
  label: string;
  /** Short name for legends. */
  short: string;
  ramp: RampId;
  invert?: boolean;
  domain?: [number, number];
  format: (v: number) => string;
  low: string;
  high: string;
  note: string;
  forecast?: boolean;
  county?: (c: County) => number | null | undefined;
  tract?: (t: TractRow) => number | null | undefined;
  /** Categorical layers color by class instead of a ramp. */
  categories?: { value: number; label: string; color: string }[];
}

const per1k = (num: number | null | undefined, den: number | null | undefined) =>
  num != null && den ? (num / den) * 1000 : null;

const pillarLayers: LayerDef[] = feiReady
  ? PILLARS.map((p) => ({
      id: `pillar-${p.key}`,
      group: "FEI pillars",
      label: `${p.label} pillar (${p.key})`,
      short: `${p.key} · ${p.label}`,
      ramp: "risk" as RampId,
      domain: [0, 1] as [number, number],
      format: (v: number) => fmt.num(v, 2),
      low: "Fewer barriers",
      high: "More barriers",
      note: `${p.what} Weight ${Math.round(p.weight * 100)}%.`,
      county: (c: County) => (c.fei?.[p.key as Pillar] as number | null | undefined) ?? null,
      tract: (t: TractRow) => (t[p.key as Pillar] as number | null | undefined) ?? null,
    }))
  : [];

export const LAYERS: LayerDef[] = [
  {
    id: "fei",
    group: "Equity index",
    label: feiReady ? "Food Access Equity Index (FEI)" : "Q6 need percentile (placeholder)",
    short: feiReady ? "FEI" : "Need screen",
    ramp: "risk",
    format: (v) => fmt.num(v, 0),
    low: "Fewer barriers",
    high: "More barriers",
    note: feiReady
      ? "FEI = 100 × (0.25·N + 0.25·S + 0.20·T + 0.15·M + 0.15·V). A screening index, not a count of unmet people."
      : "Placeholder until FEI lands: Q6 need percentile (0–100).",
    county: equityValue,
    tract: (t) => t.fei ?? null,
  },
  ...pillarLayers,
  {
    id: "miles",
    group: "Access",
    label: "Miles to nearest reporting shelf",
    short: "Miles to shelf",
    ramp: "risk",
    format: (v) => fmt.num(v, 1),
    low: "Closer",
    high: "Farther",
    note: "Straight line to the nearest shelf reporting in 2024 (D-051). Not travel time.",
    county: (c) => c.fei?.miles_nearest ?? c.mean_miles,
    tract: (t) => t.d ?? null,
  },
  {
    id: "beyond",
    group: "Access",
    label: "Residents beyond 1 mi (urban) / 10 mi (rural)",
    short: "Beyond threshold",
    ramp: "risk",
    domain: [0, 100],
    format: (v) => `${fmt.num(v, 0)}%`,
    low: "All within reach",
    high: "None within reach",
    note: "USDA LILA distance thresholds applied to 2020 block populations, 2024 reporting network.",
    county: (c) => (c.fei?.beyond_share != null ? c.fei.beyond_share * 100 : c.share_beyond_10 != null ? c.share_beyond_10 * 100 : null),
    tract: (t) => (t.beyond != null ? t.beyond * 100 : null),
  },
  {
    id: "supply",
    group: "Access",
    label: "Pounds per low-income resident within reach",
    short: "Lb per low-income resident",
    ramp: "risk",
    invert: true,
    format: (v) => fmt.num(v, 0),
    low: "Less supply",
    high: "More supply",
    note: "Enhanced two-step floating catchment on 2024 PoundsReg, per resident below 200% of poverty, per year.",
    county: (c) => c.fei?.lbs_per_lowinc ?? null,
    tract: (t) => t.A ?? null,
  },
  {
    id: "lila",
    group: "Access",
    label: "USDA low-income, low-access (LILA)",
    short: "LILA",
    ramp: "seq",
    format: (v) => fmt.num(v, 0),
    low: "",
    high: "",
    note: "USDA ERS Food Access Research Atlas 2019 (1 and 10 miles), on 2020 tracts by dominant area. County view: LILA tracts with no reporting shelf.",
    county: (c) => c.lila_without_site,
    tract: (t) => (t.lila === 1 ? 2 : t.li === 1 ? 1 : 0),
    categories: [
      { value: 2, label: "Low income and low access (LILA)", color: "#e34948" },
      { value: 1, label: "Low income only", color: "#f0a35b" },
      { value: 0, label: "Neither", color: "#5b7083" },
    ],
  },
  {
    id: "rural",
    group: "Access",
    label: "Urban / rural",
    short: "Urban / rural",
    ramp: "seq",
    format: (v) => (v ? "Urban" : "Rural"),
    low: "",
    high: "",
    note: "Tracts: USDA SRAM 2025 urban flag. Counties: USDA ERS RUCC 2023 metro status.",
    county: (c) => (c.nonmetro ? 0 : 1),
    tract: (t) => t.urbanFlag,
    categories: [
      { value: 1, label: "Urban / metro", color: "#3987e5" },
      { value: 0, label: "Rural / nonmetro", color: "#c98500" },
    ],
  },
  {
    id: "need",
    group: "Need & context",
    label: "Q6 need percentile",
    short: "Need percentile",
    ramp: "risk",
    domain: [0, 100],
    format: (v) => fmt.num(v, 0),
    low: "Lower need",
    high: "Higher need",
    note: "Q6 need screen from poverty, car access and food insecurity; no activity data. County only.",
    county: (c) => c.need_percentile,
  },
  {
    id: "poverty",
    group: "Need & context",
    label: "Residents below 200% of poverty",
    short: "Below 200% FPL",
    ramp: "risk",
    format: (v) => `${fmt.num(v, 0)}%`,
    low: "Lower",
    high: "Higher",
    note: "ACS 2020–2024 five-year, county. County only (D-020).",
    county: (c) => (c.below_200_share != null ? c.below_200_share * 100 : null),
  },
  {
    id: "svi",
    group: "Need & context",
    label: "Social Vulnerability Index",
    short: "SVI",
    ramp: "risk",
    domain: [0, 1],
    format: (v) => fmt.num(v, 2),
    low: "Less vulnerable",
    high: "More vulnerable",
    note: "CDC/ATSDR SVI 2022, county percentile within the US. County only.",
    county: (c) => c.svi,
  },
  {
    id: "act-visits",
    group: "Activity & forecast",
    label: "Visits per 1,000 residents (2024)",
    short: "Visits / 1k (2024)",
    ramp: "seq",
    format: (v) => fmt.num(v, 0),
    low: "Fewer",
    high: "More",
    note: "HouseholdsReg 2024 ÷ ACS population. Observed demand, not need. County only.",
    county: (c) => per1k(c.annual2024.HouseholdsTotal, c.population),
  },
  {
    id: "fc-visits",
    group: "Activity & forecast",
    label: "Forecast visits per 1,000 residents (Aug 2026)",
    short: "Forecast visits / 1k",
    ramp: "seq",
    format: (v) => fmt.num(v, 1),
    low: "Fewer",
    high: "More",
    note: "HouseholdsReg August 2026 internal forecast (D-045) ÷ ACS population. Not an actual. County only.",
    forecast: true,
    county: (c) => per1k(c.forecast.HouseholdsTotal?.yhat, c.population),
  },
  {
    id: "gap",
    group: "Activity & forecast",
    label: "Need minus activity (Q6 minimum gap)",
    short: "Need − activity",
    ramp: "div",
    format: (v) => fmt.num(v, 0),
    low: "Activity above need",
    high: "Need above activity",
    note: "Positive = need percentile above activity percentile on every signal. County only.",
    county: (c) => c.minimum_gap,
  },
];

export const LAYER_GROUPS = [...new Set(LAYERS.map((l) => l.group))];

export function layerById(id: string): LayerDef {
  return LAYERS.find((l) => l.id === id) ?? LAYERS[0];
}

export function layerValues(layer: LayerDef, unit: Unit, tracts: TractRow[] | null): Record<string, number | null> {
  if (unit === "tract") {
    if (!tracts || !layer.tract) return {};
    return Object.fromEntries(tracts.map((t) => [t.geoid, layer.tract!(t) ?? null]));
  }
  return Object.fromEntries(research.counties.map((c) => [c.fips, layer.county?.(c) ?? null]));
}

export function countyLabel(fips: string): string {
  return `${countiesByFips[fips]?.name ?? fips} County`;
}
