// Supply planner split, ported from FoodBridge core.allocate (D-038, D-048):
// pool × [(1 − w) × county share of forecast PoundsReg + w × county share of ACS
// residents below poverty], largest-remainder rounding so drafts + reserve = pool.

import type { County } from "./types";

export interface AllocationInput {
  total: number;
  reserve: number; // percent 0–50
  ids: string[];
  needWeight?: number; // percent 0–100
}

export interface AllocationRow {
  fips: string;
  name: string;
  pounds: number;
  forecast: number;
  upper80: number | null;
  demandPounds: number;
}

export interface Allocation {
  total: number;
  reserve: number;
  needWeight: number;
  reservePounds: number;
  available: number;
  forecastTotal: number;
  rows: AllocationRow[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function allocate(counties: County[], input: AllocationInput): Allocation {
  const { total, reserve, ids } = input;
  const needWeight = input.needWeight ?? 0;
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1e9)
    throw new Error("Enter whole pounds between 1 and 1,000,000,000.");
  if (!Number.isInteger(reserve) || reserve < 0 || reserve > 50) throw new Error("Reserve must be between 0% and 50%.");
  if (!Number.isInteger(needWeight) || needWeight < 0 || needWeight > 100)
    throw new Error("Need weight must be between 0% and 100%.");
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Choose at least one county, without duplicates.");
  const selected = ids.map((id) => counties.find((c) => c.fips === id));
  if (selected.some((c) => !c)) throw new Error("A selected county is unavailable.");
  const chosen = selected as County[];
  if (chosen.some((c) => !isNum(c.forecast.PoundsTotal?.yhat) || (c.forecast.PoundsTotal?.yhat ?? 0) <= 0))
    throw new Error(
      "Selected counties need a positive PoundsReg forecast. Missing forecasts cannot be treated as zero.",
    );
  if (needWeight > 0 && chosen.some((c) => !isNum(c.poverty_persons) || (c.poverty_persons ?? 0) <= 0))
    throw new Error("A need-weighted split needs the ACS poverty count for every selected county.");
  const forecastTotal = chosen.reduce((s, c) => s + (c.forecast.PoundsTotal?.yhat ?? 0), 0);
  const povertyTotal = chosen.reduce((s, c) => s + (c.poverty_persons ?? 0), 0);
  const w = needWeight / 100;
  const reservePounds = Math.round((total * reserve) / 100);
  const available = total - reservePounds;
  const rows = chosen.map((c) => {
    const yhat = c.forecast.PoundsTotal!.yhat!;
    const demandShare = yhat / forecastTotal;
    const needShare = w > 0 ? (c.poverty_persons ?? 0) / povertyTotal : 0;
    const exact = w > 0 ? available * ((1 - w) * demandShare + w * needShare) : (available * yhat) / forecastTotal;
    return {
      fips: c.fips,
      name: c.name,
      pounds: Math.floor(exact),
      remainder: exact - Math.floor(exact),
      forecast: yhat,
      upper80: c.forecast.PoundsTotal!.hi80,
      demandPounds: Math.round(available * demandShare),
    };
  });
  const left = available - rows.reduce((s, r) => s + r.pounds, 0);
  const ordered = [...rows].sort((a, b) => b.remainder - a.remainder || a.fips.localeCompare(b.fips));
  for (let i = 0; i < left; i++) ordered[i].pounds += 1;
  return {
    total,
    reserve,
    needWeight,
    reservePounds,
    available,
    forecastTotal,
    rows: rows.sort((a, b) => b.pounds - a.pounds).map(({ remainder: _r, ...r }) => r),
  };
}
