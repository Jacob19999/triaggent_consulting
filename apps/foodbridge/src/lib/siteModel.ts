// Site planner: sizes a new site from the August 2026 county forecast, then scores it
// with the scenario engine (reach, FEI change, dollars). Also searches for the best
// sites. Every number is an approximation from tract averages and is labelled so.
//
// Forecast for a new site, per tract whose nearest reporting shelf would become the new site:
//   shifted visits = residents × county forecast visits per resident × Huff share × site reach
//   Huff share     = d_new^-2 / (d_new^-2 + d_old^-2)   (gravity model, distances floored at 0.25 mi)
//   induced visits = shifted × (min(cap, e^(k × miles saved)) − 1)
// where k is the cross-county association between distance and visits per low-income
// resident (2024 HouseholdsReg, fitted here from the bundle; an association, not causal).
// Pounds, individuals and ages follow the county's forecast ratios.

import { haversineMiles } from "./geo";
import { countiesByFips, research } from "./research";
import { DEFAULT_MONEY, runScenario, type MoneyAssumptions, type ScenarioResult } from "./scenario";
import type { County, FeiTract, ShelfType, Tract } from "./types";

/** Share of a full-time brick-and-mortar shelf's reach a site type achieves (planning assumption). */
export const TYPE_REACH: Record<ShelfType, number> = {
  brick_and_mortar: 1,
  tribal: 1,
  mobile: 0.5,
  outreach: 0.4,
  campus: 0.35,
};
export const HUFF_EXPONENT = 2;
export const UPLIFT_CAP = 1.5;
const MIN_MILES = 0.25;

export interface CountyRates {
  visitsPerResident: number;
  lbPerVisit: number;
  indPerVisit: number;
  childShare: number;
  adultShare: number;
  seniorShare: number;
  lo80: number;
  hi80: number;
  fromState: boolean;
}

let stateRates: CountyRates | null = null;
const rateCache = new Map<string, CountyRates>();

function ratesFrom(cs: County[]): Omit<CountyRates, "fromState"> | null {
  let v = 0,
    p = 0,
    lb = 0,
    ind = 0,
    ch = 0,
    ad = 0,
    se = 0,
    lo = 0,
    hi = 0;
  for (const c of cs) {
    const f = c.forecast;
    const yv = f.HouseholdsTotal?.yhat;
    if (!yv || !c.population || !f.PoundsTotal?.yhat || !f.IndividualsTotal?.yhat) continue;
    v += yv;
    p += c.population;
    lb += f.PoundsTotal.yhat;
    ind += f.IndividualsTotal.yhat;
    ch += f.ChildrenTotal?.yhat ?? 0;
    ad += f.AdultsTotal?.yhat ?? 0;
    se += f.SeniorsTotal?.yhat ?? 0;
    lo += f.HouseholdsTotal?.lo80 ?? yv;
    hi += f.HouseholdsTotal?.hi80 ?? yv;
  }
  if (!v || !p) return null;
  const ages = ch + ad + se || 1;
  return {
    visitsPerResident: v / p,
    lbPerVisit: lb / v,
    indPerVisit: ind / v,
    childShare: ch / ages,
    adultShare: ad / ages,
    seniorShare: se / ages,
    lo80: lo / v,
    hi80: hi / v,
  };
}

/** Monthly rates from the county's August 2026 forecast (D-045); the state's when the county has none. */
export function countyRates(fips: string): CountyRates {
  const hit = rateCache.get(fips);
  if (hit) return hit;
  stateRates ??= { ...ratesFrom(research.counties)!, fromState: true };
  const c = countiesByFips[fips];
  const own = c ? ratesFrom([c]) : null;
  const r = own ? { ...own, fromState: false } : stateRates;
  rateCache.set(fips, r);
  return r;
}

let association: { perMile: number; n: number } | null = null;

/** OLS slope of log(2024 visits per resident below 200% of poverty) on average miles to the
 * nearest reporting shelf, across counties. Negative = farther counties record fewer visits. */
export function distanceAssociation(): { perMile: number; n: number } {
  if (association) return association;
  const pts = research.counties
    .filter((c) => (c.annual2024.HouseholdsTotal ?? 0) > 0 && c.population && c.below_200_share && c.mean_miles != null)
    .map((c) => ({ x: c.mean_miles!, y: Math.log(c.annual2024.HouseholdsTotal! / (c.population! * c.below_200_share!)) }));
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  association = { perMile: sxx > 0 ? sxy / sxx : 0, n };
  return association;
}

export interface SiteForecast {
  visits: number;
  shifted: number;
  induced: number;
  visitsLo: number;
  visitsHi: number;
  pounds: number;
  inducedPounds: number;
  individuals: number;
  children: number;
  adults: number;
  seniors: number;
  catchmentResidents: number;
  catchmentTracts: number;
  milesSavedPerVisit: number;
  reach: number;
  perMile: number;
  stateRatesUsed: boolean;
}

export function forecastNewSite(lon: number, lat: number, type: ShelfType, tracts: Tract[] = research.tracts): SiteForecast {
  const reach = TYPE_REACH[type];
  const k = Math.max(0, -distanceAssociation().perMile);
  let shifted = 0,
    induced = 0,
    lo = 0,
    hi = 0,
    pounds = 0,
    inducedPounds = 0,
    ind = 0,
    ch = 0,
    ad = 0,
    se = 0,
    residents = 0,
    n = 0,
    savedW = 0,
    stateUsed = false;
  for (const t of tracts) {
    if (t.d == null) continue;
    const miles = haversineMiles(t.x, t.y, lon, lat);
    if (miles >= t.d) continue;
    const r = countyRates(t.c);
    stateUsed ||= r.fromState;
    const a = Math.max(MIN_MILES, miles) ** -HUFF_EXPONENT;
    const b = Math.max(MIN_MILES, t.d) ** -HUFF_EXPONENT;
    const base = t.p * r.visitsPerResident * (a / (a + b)) * reach;
    const saved = t.d - miles;
    const uplift = Math.min(UPLIFT_CAP, Math.exp(k * saved));
    const extra = base * (uplift - 1);
    const v = base + extra;
    shifted += base;
    induced += extra;
    lo += base * r.lo80 + extra * 0.5;
    hi += base * r.hi80 + extra * 1.5;
    pounds += v * r.lbPerVisit;
    inducedPounds += extra * r.lbPerVisit;
    const i = v * r.indPerVisit;
    ind += i;
    ch += i * r.childShare;
    ad += i * r.adultShare;
    se += i * r.seniorShare;
    residents += t.p;
    savedW += v * saved;
    n++;
  }
  const visits = shifted + induced;
  return {
    visits,
    shifted,
    induced,
    visitsLo: lo,
    visitsHi: hi,
    pounds,
    inducedPounds,
    individuals: ind,
    children: ch,
    adults: ad,
    seniors: se,
    catchmentResidents: residents,
    catchmentTracts: n,
    milesSavedPerVisit: visits ? savedW / visits : 0,
    reach,
    perMile: distanceAssociation().perMile,
    stateRatesUsed: stateUsed,
  };
}

export interface SiteEvaluation {
  forecast: SiteForecast;
  result: ScenarioResult;
}

/** Forecast a site, then score it. Manual sizes override the forecast when given. */
export function evaluateSite(opts: {
  lon: number;
  lat: number;
  county: string;
  type: ShelfType;
  money?: MoneyAssumptions;
  feiTracts?: FeiTract[];
  manual?: { visits: number; pounds: number } | null;
}): SiteEvaluation {
  const forecast = forecastNewSite(opts.lon, opts.lat, opts.type);
  const visits = opts.manual ? opts.manual.visits : Math.round(forecast.visits);
  const pounds = opts.manual ? opts.manual.pounds : Math.round(forecast.pounds);
  // Manual sizes scale the induced share in proportion so dollar values stay consistent.
  const inducedShare = forecast.pounds > 0 ? forecast.inducedPounds / forecast.pounds : 0;
  const result = runScenario(
    {
      lon: opts.lon,
      lat: opts.lat,
      county: opts.county,
      type: opts.type,
      householdsPerMonth: visits,
      poundsPerMonth: pounds,
      money: opts.money ?? DEFAULT_MONEY[opts.type],
      milesSavedPerVisit: forecast.milesSavedPerVisit,
      inducedPoundsPerMonth: pounds * inducedShare,
    },
    opts.feiTracts ?? [],
  );
  return { forecast, result };
}

// ---------- Optimal site search ----------

export type Objective = "fei" | "topq" | "reach" | "lowIncome" | "value";

export const OBJECTIVES: { id: Objective; label: string; detail: string; icon: string }[] = [
  {
    id: "fei",
    label: "Largest FEI reduction",
    detail: "Population-weighted drop in statewide FEI (supply and travel pillars).",
    icon: "index",
  },
  {
    id: "topq",
    label: "Most residents out of the top FEI quintile",
    detail: "Residents whose tract falls below today's top-quintile FEI cut-off: targets the highest-barrier places.",
    icon: "target",
  },
  {
    id: "reach",
    label: "Most residents newly within reach",
    detail: "Residents moved inside 1 mile (urban) or 10 miles (rural) of a shelf.",
    icon: "users",
  },
  {
    id: "lowIncome",
    label: "Most low-income residents reached",
    detail: "Newly within reach × county share below 200% of poverty.",
    icon: "scale",
  },
  {
    id: "value",
    label: "Most net new value",
    detail: "Food reaching new visits plus household travel cost avoided, per year.",
    icon: "dollar",
  },
];

export function objectiveScore(objective: Objective, e: SiteEvaluation): number {
  const r = e.result;
  switch (objective) {
    case "fei":
      return r.fei.status === "ready" ? (r.fei.stateBefore ?? 0) - (r.fei.stateAfter ?? 0) : r.residentsNewlyWithin;
    case "topq":
      return r.fei.status === "ready"
        ? (r.fei.topQuintileResidentsBefore ?? 0) - (r.fei.topQuintileResidentsAfter ?? 0)
        : r.residentsNewlyWithin;
    case "reach":
      return r.residentsNewlyWithin;
    case "lowIncome":
      return r.lowIncomeNewlyWithin;
    case "value":
      return r.dollars.netNewValue;
  }
}

export interface Candidate {
  rank: number;
  geoid: string;
  county: string;
  lon: number;
  lat: number;
  score: number;
  evaluation: SiteEvaluation;
}

export interface OptimizeOptions {
  objective: Objective;
  type: ShelfType;
  money?: MoneyAssumptions;
  feiTracts: FeiTract[];
  /** Counties to search (FIPS); empty = statewide. */
  counties?: string[];
  count?: number;
  spacingMiles?: number;
  onProgress?: (share: number) => void;
  signal?: { cancelled: boolean };
}

/** Candidates are tract geometry centroids (never shelf points), skipping tracts already within half a mile of a shelf.
 * Every candidate is scored with the same engine the planner shows; picks keep a minimum spacing. */
export async function optimizeSites(o: OptimizeOptions): Promise<Candidate[]> {
  const scope = o.counties?.length ? new Set(o.counties) : null;
  const pool = research.tracts.filter((t) => (!scope || scope.has(t.c)) && t.d != null && t.d > 0.5);
  const scored: Omit<Candidate, "rank">[] = [];
  const chunk = 24;
  for (let i = 0; i < pool.length; i += chunk) {
    if (o.signal?.cancelled) return [];
    for (const t of pool.slice(i, i + chunk)) {
      const evaluation = evaluateSite({ lon: t.x, lat: t.y, county: t.c, type: o.type, money: o.money, feiTracts: o.feiTracts });
      scored.push({ geoid: t.g, county: t.c, lon: t.x, lat: t.y, score: objectiveScore(o.objective, evaluation), evaluation });
    }
    o.onProgress?.(Math.min(1, (i + chunk) / pool.length));
    await new Promise((r) => setTimeout(r, 0));
  }
  scored.sort((a, b) => b.score - a.score);
  const picks: Candidate[] = [];
  const spacing = o.spacingMiles ?? 15;
  for (const s of scored) {
    if (picks.length >= (o.count ?? 5)) break;
    if (s.score <= 0) break;
    if (picks.some((p) => haversineMiles(p.lon, p.lat, s.lon, s.lat) < spacing)) continue;
    picks.push({ ...s, rank: picks.length + 1 });
  }
  return picks;
}
