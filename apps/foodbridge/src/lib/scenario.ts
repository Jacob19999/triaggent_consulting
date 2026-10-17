// "What if we open a food shelf here?" Every output is labelled an approximation:
// residents are placed at their tract's centroid, distances are straight-line miles,
// and the FEI change follows A4's published formulas applied to tract averages.

import { haversineMiles } from "./geo";
import { DEFAULT_FEI_WEIGHTS, feiFromPillars, type PillarWeights } from "./pillars";
import { countiesByFips, feiReady, research } from "./research";
import type { FeiTract, ShelfType, Tract } from "./types";

// ---------- Dollar assumptions (every one editable in the UI) ----------

export interface MoneyAssumptions {
  valuePerLb: number;
  lbPerMeal: number;
  mileageRate: number;
  tripsPerHouseholdMonth: number;
  annualOperatingCost: number;
  startupCost: number;
  amortizeYears: number;
}

export interface AssumptionNote {
  key: keyof MoneyAssumptions;
  label: string;
  unit: string;
  source: string;
  url?: string;
  kind: "cited" | "example" | "placeholder";
}

export const DEFAULT_MONEY: Record<ShelfType, MoneyAssumptions> = {
  brick_and_mortar: {
    valuePerLb: 1.37,
    lbPerMeal: 1.2,
    mileageRate: 0.725,
    tripsPerHouseholdMonth: 1,
    annualOperatingCost: 85000,
    startupCost: 60000,
    amortizeYears: 5,
  },
  mobile: {
    valuePerLb: 1.37,
    lbPerMeal: 1.2,
    mileageRate: 0.725,
    tripsPerHouseholdMonth: 1,
    annualOperatingCost: 40000,
    startupCost: 15000,
    amortizeYears: 5,
  },
  outreach: {
    valuePerLb: 1.37,
    lbPerMeal: 1.2,
    mileageRate: 0.725,
    tripsPerHouseholdMonth: 1,
    annualOperatingCost: 40000,
    startupCost: 15000,
    amortizeYears: 5,
  },
  campus: {
    valuePerLb: 1.37,
    lbPerMeal: 1.2,
    mileageRate: 0.725,
    tripsPerHouseholdMonth: 1,
    annualOperatingCost: 30000,
    startupCost: 10000,
    amortizeYears: 5,
  },
  tribal: {
    valuePerLb: 1.37,
    lbPerMeal: 1.2,
    mileageRate: 0.725,
    tripsPerHouseholdMonth: 1,
    annualOperatingCost: 85000,
    startupCost: 60000,
    amortizeYears: 5,
  },
};

export const ASSUMPTION_NOTES: AssumptionNote[] = [
  {
    key: "valuePerLb",
    label: "Wholesale value of food",
    unit: "$/lb",
    source:
      "Example only: Oregon Food Bank's FY2027 donated-inventory valuation ($1.37/lb), a Feeding America member's published figure. Replace with The Food Group's own valuation.",
    url: "https://ofbportals.oregonfoodbank.org/home/partner_support/partner_support/partner_agencies/metro_announcements_page/metro_announcements_posts/ofbs_2026_2027_donated_inventory_valuation",
    kind: "example",
  },
  {
    key: "lbPerMeal",
    label: "Pounds per meal",
    unit: "lb",
    source: "Feeding America's pounds-per-meal standard (1.2 lb), as used in the Q6 meal-gap work (D-046).",
    url: "https://feedingamerica.org/ways-to-give/faq/about-our-claims",
    kind: "cited",
  },
  {
    key: "mileageRate",
    label: "Cost of driving",
    unit: "$/mile",
    source: "IRS 2026 business standard mileage rate, 72.5 cents (IR-2025-128). A proxy for a household's full cost of a car trip.",
    url: "https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents",
    kind: "cited",
  },
  {
    key: "tripsPerHouseholdMonth",
    label: "Round trips per visit",
    unit: "trips",
    source: "One visit = one trip by one household (sponsor glossary).",
    kind: "cited",
  },
  {
    key: "annualOperatingCost",
    label: "Annual operating cost",
    unit: "$/yr",
    source: "Placeholder. Replace with The Food Group's budget for this site type (rent, staff, utilities, delivery).",
    kind: "placeholder",
  },
  {
    key: "startupCost",
    label: "Start-up cost",
    unit: "$",
    source: "Placeholder. Shelving, cold storage, vehicle or build-out.",
    kind: "placeholder",
  },
  {
    key: "amortizeYears",
    label: "Years to spread start-up cost",
    unit: "years",
    source: "Planning choice.",
    kind: "placeholder",
  },
];

// ---------- Access thresholds and the A4 decay table ----------

/** USDA LILA thresholds: 1 mile urban, 10 miles rural. Unknown urban flag → county metro status. */
export function thresholdMiles(t: Pick<Tract, "u" | "c">): number {
  if (t.u === 1) return 1;
  if (t.u === 0) return 10;
  return countiesByFips[t.c]?.nonmetro ? 10 : 1;
}

/** A4 step decay (urban 1/2/5/10 mi, rural 5/10/20/30 mi → 1, .6, .3, .1, then 0). */
export function decay(miles: number, urban: boolean): number {
  const bands = urban ? [1, 2, 5, 10] : [5, 10, 20, 30];
  const weights = [1, 0.6, 0.3, 0.1];
  for (let i = 0; i < bands.length; i++) if (miles <= bands[i]) return weights[i];
  return 0;
}

// ---------- Scenario ----------

export interface NewShelfInput {
  lon: number;
  lat: number;
  county: string; // FIPS
  type: ShelfType;
  householdsPerMonth: number;
  poundsPerMonth: number;
  money: MoneyAssumptions;
  /** From the site forecast: visit-weighted miles saved per visit (else the resident-weighted average). */
  milesSavedPerVisit?: number;
  /** From the site forecast: pounds per month reaching visits that do not happen today. */
  inducedPoundsPerMonth?: number;
  /** Only food added to the network can increase total supply. Default: none. */
  additionalPoundsPerMonth?: number;
  /** Existing visits that move to this site; new visits did not make an old trip. */
  shiftedVisitsPerMonth?: number;
  /** One-way travel for additional visits, a cost rather than avoided travel. */
  newVisitMiles?: number;
}

export interface TractEffect {
  geoid: string;
  county: string;
  residents: number;
  milesBefore: number;
  milesAfter: number;
  newlyWithin: number;
  feiBefore?: number;
  feiAfter?: number;
}

export interface FeiImpact {
  status: "ready" | "pending";
  reason?: string;
  countyBefore?: number;
  countyAfter?: number;
  stateBefore?: number;
  stateAfter?: number;
  tractsImproved?: number;
  topQuintileResidentsBefore?: number;
  topQuintileResidentsAfter?: number;
}

export interface ScenarioResult {
  input: NewShelfInput;
  affected: TractEffect[];
  residentsCloser: number;
  residentsNewlyWithin: number;
  /** Residents newly within reach × their county's share below 200% of poverty (county ACS, D-020). */
  lowIncomeNewlyWithin: number;
  /** Residents newly within reach × their county's child share. */
  childrenNewlyWithin: number;
  avgMilesSavedCloser: number;
  countyResidentsBeyondBefore: number;
  countyResidentsBeyondAfter: number;
  lowIncomeResidents: number | null;
  poundsPerLowIncomeBefore: number | null;
  poundsPerLowIncomeAfter: number | null;
  fei: FeiImpact;
  dollars: {
    annualPounds: number;
    annualMeals: number;
    foodValue: number;
    travelSavings: number;
    additionalTravelCost: number;
    /** Food value reaching visits that do not happen today (induced visits only). */
    newFoodValue: number;
    /** Assumed additional food value plus avoided travel, less additional travel. */
    netNewValue: number;
    /** Net new value minus annual cost. */
    netValue: number;
    annualCost: number;
    costPerMeal: number | null;
    costPerVisit: number | null;
    costPerResidentWithin: number | null;
    valuePerDollar: number | null;
    /** Net new value per $1 of cost. */
    newValuePerDollar: number | null;
    costPerFeiPoint: number | null;
  };
}

const quantile = (values: number[], q: number) => {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

/** Norm(x) = clip((x − Q05)/(Q95 − Q05), 0, 1). Uses the FEI build's published bounds
 * (fei_meta.json → normalization) when present, otherwise the tract quantiles. */
function normalizer(key: string, values: (number | null | undefined)[]) {
  const published = (research.fei.meta?.normalization as Record<string, { bounds?: [number, number] }> | undefined)?.[key]
    ?.bounds;
  let lo: number, hi: number;
  if (published) [lo, hi] = published;
  else {
    const v = values.filter((x): x is number => x != null && Number.isFinite(x));
    lo = quantile(v, 0.05);
    hi = quantile(v, 0.95);
  }
  return (x: number) => (hi > lo ? Math.max(0, Math.min(1, (x - lo) / (hi - lo))) : 0.5);
}

const T_WEIGHTS = { d: 0.5, beyond: 0.3, bm: 0.2 };

function feiWeights(): PillarWeights {
  const params = research.fei.meta?.params as { weights?: Partial<PillarWeights> } | undefined;
  const w = params?.weights;
  if (!w) return DEFAULT_FEI_WEIGHTS;
  const merged = { ...DEFAULT_FEI_WEIGHTS, ...w };
  const sum = Object.values(merged).reduce((s, v) => s + (v ?? 0), 0);
  // Accept weights given as fractions or as points out of 100.
  return sum > 1.5
    ? (Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, (v ?? 0) / 100])) as PillarWeights)
    : (merged as PillarWeights);
}

/** FEI change from A4's tract table. S and T move by this engine's deltas from the tract's
 * published pillars, FEI is recomputed with the build's formula (need × access, D-069), and only
 * the change is added to the published FEI, so a small mismatch between this engine and the
 * pipeline's exact block-level values does not shift the baseline. */
export function feiImpact(input: NewShelfInput, tracts: FeiTract[] = []): {
  impact: FeiImpact;
  byTract: Map<string, { before: number; after: number }>;
} {
  const byTract = new Map<string, { before: number; after: number }>();
  const usable = tracts.filter(
    (t) => t.fei != null && t.lat != null && t.lon != null && t.A != null && t.d != null && (t.pop ?? 0) > 0,
  );
  if (!feiReady || usable.length < 100) {
    return {
      impact: {
        status: "pending",
        reason: feiReady
          ? "Tract FEI is still loading, or the tract table lacks the scenario fields."
          : "FEI is being built by task A4. The FEI change appears here once fei_tracts.csv lands.",
      },
      byTract,
    };
  }
  const w = feiWeights();
  const isUrban = (t: FeiTract) => (t.urban ?? 0) === 1;
  const theta = (t: FeiTract) => t.theta ?? (isUrban(t) ? 1 : 10);
  const normA = normalizer("lbs_per_lowinc_resident", usable.map((t) => t.A));
  const normD = normalizer("miles_nearest", usable.map((t) => t.d));
  const normBM = normalizer("brick_excess_miles", usable.map((t) => Math.max(0, (t.d_bm ?? t.d!) - theta(t))));
  const operating = input.householdsPerMonth > 0 && input.poundsPerMonth > 0;
  const dist = (t: FeiTract) => operating ? haversineMiles(t.lon!, t.lat!, input.lon, input.lat) : Infinity;

  // 2SFCA: only assumed additional network food increases catchment supply.
  const annualSupply = (input.additionalPoundsPerMonth ?? 0) * 12;
  const demand = usable.reduce((s, t) => s + (t.demand ?? 0) * decay(dist(t), isUrban(t)), 0);
  const ratio = demand > 0 ? annualSupply / demand : 0;
  const isFixed = input.type === "brick_and_mortar" || input.type === "tribal" || input.type === "campus";

  let popAll = 0,
    feiAll = 0,
    feiAllAfter = 0,
    popC = 0,
    feiC = 0,
    feiCAfter = 0,
    improved = 0;
  // Top quintile as the FEI build labels it (fei_quintile = 5); fall back to the 80th percentile.
  const q5 = usable.filter((t) => t.quintile === 5).map((t) => t.fei!);
  const q80 = q5.length ? Math.min(...q5) : quantile(usable.map((t) => t.fei!), 0.8);
  let topBefore = 0,
    topAfter = 0;
  for (const t of usable) {
    const miles = dist(t);
    const pop = t.pop!;
    let after = t.fei!;
    const g = decay(miles, isUrban(t));
    if (g > 0 || miles < t.d!) {
      const sBefore = 1 - normA(t.A!);
      const sAfter = 1 - normA(t.A! + ratio * g);
      const dAfter = Math.min(t.d!, miles);
      const beyondBefore = t.beyond ?? 0;
      const beyondAfter = miles <= theta(t) ? 0 : beyondBefore;
      const bmBefore = t.d_bm ?? t.d!;
      const bmAfter = isFixed ? Math.min(bmBefore, miles) : bmBefore;
      const tBefore =
        T_WEIGHTS.d * normD(t.d!) + T_WEIGHTS.beyond * beyondBefore + T_WEIGHTS.bm * normBM(Math.max(0, bmBefore - theta(t)));
      const tAfter =
        T_WEIGHTS.d * normD(dAfter) + T_WEIGHTS.beyond * beyondAfter + T_WEIGHTS.bm * normBM(Math.max(0, bmAfter - theta(t)));
      const clip = (x: number) => Math.max(0, Math.min(1, x));
      const base = { N: t.N, S: t.S, T: t.T, M: t.M, V: t.V };
      const feiBefore = feiFromPillars(base, w);
      const feiAfter = feiFromPillars(
        { ...base, S: clip((t.S ?? 0) + sAfter - sBefore), T: clip((t.T ?? 0) + tAfter - tBefore) },
        w,
      );
      if (feiBefore != null && feiAfter != null) after = Math.max(0, t.fei! + feiAfter - feiBefore);
      if (after < t.fei! - 1e-9) {
        improved++;
        byTract.set(t.geoid, { before: t.fei!, after });
      }
    }
    popAll += pop;
    feiAll += pop * t.fei!;
    feiAllAfter += pop * after;
    const wasTop = t.quintile != null ? t.quintile === 5 : t.fei! >= q80;
    if (wasTop) topBefore += pop;
    // Rounded FEI can tie across quintile boundaries. A no-op must preserve the
    // published membership; a non-increasing score cannot enter the top group.
    if (wasTop && after >= q80) topAfter += pop;
    if (t.county === input.county) {
      popC += pop;
      feiC += pop * t.fei!;
      feiCAfter += pop * after;
    }
  }
  return {
    impact: {
      status: "ready",
      countyBefore: popC ? feiC / popC : undefined,
      countyAfter: popC ? feiCAfter / popC : undefined,
      stateBefore: feiAll / popAll,
      stateAfter: feiAllAfter / popAll,
      tractsImproved: improved,
      topQuintileResidentsBefore: topBefore,
      topQuintileResidentsAfter: topAfter,
    },
    byTract,
  };
}

export function runScenario(
  input: NewShelfInput,
  feiTracts: FeiTract[] = [],
  tracts: Tract[] = research.tracts,
): ScenarioResult {
  const nonnegative = [input.householdsPerMonth, input.poundsPerMonth, ...Object.values(input.money),
    input.additionalPoundsPerMonth ?? 0, input.shiftedVisitsPerMonth ?? 0,
    input.inducedPoundsPerMonth ?? 0, input.milesSavedPerVisit ?? 0, input.newVisitMiles ?? 0];
  if (nonnegative.some((v) => !Number.isFinite(v) || v < 0) || !Number.isFinite(input.lon) || !Number.isFinite(input.lat)) {
    throw new Error("Enter finite, nonnegative site sizes and budget assumptions.");
  }
  if (input.money.lbPerMeal <= 0 || input.money.amortizeYears <= 0) {
    throw new Error("Pounds per meal and years to spread start-up cost must be greater than zero.");
  }
  if ((input.additionalPoundsPerMonth ?? 0) > input.poundsPerMonth || (input.inducedPoundsPerMonth ?? 0) > input.poundsPerMonth ||
      (input.shiftedVisitsPerMonth ?? 0) > input.householdsPerMonth) {
    throw new Error("Additional food and shifted visits cannot exceed the site's total.");
  }
  const affected: TractEffect[] = [];
  let lowIncomeWithin = 0,
    childrenWithin = 0;
  let closer = 0,
    newlyWithin = 0,
    savedWeighted = 0,
    beyondBefore = 0,
    beyondAfter = 0;
  for (const t of tracts) {
    if (t.d == null) continue;
    const theta = thresholdMiles(t);
    const share = theta === 1 ? (t.b1 ?? 0) : (t.b10 ?? 0);
    const miles = input.householdsPerMonth > 0 && input.poundsPerMonth > 0
      ? haversineMiles(t.x, t.y, input.lon, input.lat) : Infinity;
    const isCounty = t.c === input.county;
    if (isCounty) beyondBefore += t.p * share;
    if (miles >= t.d) {
      if (isCounty) beyondAfter += t.p * share;
      continue;
    }
    const within = miles <= theta ? t.p * share : 0;
    if (isCounty) beyondAfter += t.p * share - within;
    closer += t.p;
    newlyWithin += within;
    const tc = countiesByFips[t.c];
    lowIncomeWithin += within * (tc?.below_200_share ?? 0);
    childrenWithin += within * (tc?.children != null && tc.population ? tc.children / tc.population : 0);
    savedWeighted += t.p * (t.d - miles);
    affected.push({
      geoid: t.g,
      county: t.c,
      residents: t.p,
      milesBefore: t.d,
      milesAfter: miles,
      newlyWithin: within,
    });
  }
  const county = countiesByFips[input.county];
  const lowIncome =
    county?.population != null && county.below_200_share != null ? county.population * county.below_200_share : null;
  const annualPounds = input.poundsPerMonth * 12;
  const before2024 = county?.annual2024.PoundsTotal ?? null;
  const fei = feiImpact(input, feiTracts);
  // Supply can improve a tract even when the proposed shelf is not its nearest.
  // Include those changes so the FEI map and the aggregate use the same tracts.
  const affectedIds = new Set(affected.map((a) => a.geoid));
  for (const t of tracts) {
    if (t.d != null && fei.byTract.has(t.g) && !affectedIds.has(t.g)) {
      affected.push({ geoid: t.g, county: t.c, residents: t.p, milesBefore: t.d, milesAfter: t.d, newlyWithin: 0 });
    }
  }
  for (const a of affected) {
    const f = fei.byTract.get(a.geoid);
    if (f) {
      a.feiBefore = f.before;
      a.feiAfter = f.after;
    }
  }

  const m = input.money;
  const avgSaved = closer ? savedWeighted / closer : 0;
  const annualVisits = input.householdsPerMonth * 12;
  const annualMeals = annualPounds / m.lbPerMeal;
  const foodValue = annualPounds * m.valuePerLb;
  // Only shifted visits had an old trip to shorten. Additional visits add travel.
  const savedPerVisit = input.milesSavedPerVisit ?? avgSaved;
  const shiftedVisits = Math.min(input.householdsPerMonth, Math.max(0, input.shiftedVisitsPerMonth ?? 0));
  const travelSavings = shiftedVisits * 12 * m.tripsPerHouseholdMonth * 2 * savedPerVisit * m.mileageRate;
  const additionalTravelCost = (input.householdsPerMonth - shiftedVisits) * 12 * m.tripsPerHouseholdMonth * 2 * (input.newVisitMiles ?? 0) * m.mileageRate;
  const newFoodValue = Math.min(input.inducedPoundsPerMonth ?? 0, input.additionalPoundsPerMonth ?? 0) * 12 * m.valuePerLb;
  const annualCost = m.annualOperatingCost + (m.amortizeYears > 0 ? m.startupCost / m.amortizeYears : m.startupCost);
  const countyPoints =
    fei.impact.status === "ready" && fei.impact.countyBefore != null && fei.impact.countyAfter != null
      ? fei.impact.countyBefore - fei.impact.countyAfter
      : null;
  return {
    input,
    affected: affected.sort((a, b) => b.milesBefore - b.milesAfter - (a.milesBefore - a.milesAfter)),
    residentsCloser: closer,
    residentsNewlyWithin: newlyWithin,
    lowIncomeNewlyWithin: lowIncomeWithin,
    childrenNewlyWithin: childrenWithin,
    avgMilesSavedCloser: avgSaved,
    countyResidentsBeyondBefore: beyondBefore,
    countyResidentsBeyondAfter: beyondAfter,
    lowIncomeResidents: lowIncome,
    poundsPerLowIncomeBefore: lowIncome && before2024 != null ? before2024 / lowIncome : null,
    poundsPerLowIncomeAfter: lowIncome && before2024 != null ? (before2024 + (input.additionalPoundsPerMonth ?? 0) * 12) / lowIncome : null,
    fei: fei.impact,
    dollars: {
      annualPounds,
      annualMeals,
      foodValue,
      travelSavings,
      additionalTravelCost,
      newFoodValue,
      netNewValue: newFoodValue + travelSavings - additionalTravelCost,
      netValue: newFoodValue + travelSavings - additionalTravelCost - annualCost,
      annualCost,
      costPerMeal: annualMeals ? annualCost / annualMeals : null,
      costPerVisit: annualVisits ? annualCost / annualVisits : null,
      costPerResidentWithin: newlyWithin > 0 ? annualCost / newlyWithin : null,
      valuePerDollar: annualCost ? (foodValue + travelSavings) / annualCost : null,
      newValuePerDollar: annualCost ? (newFoodValue + travelSavings - additionalTravelCost) / annualCost : null,
      costPerFeiPoint: countyPoints && countyPoints > 0 ? annualCost / countyPoints : null,
    },
  };
}
