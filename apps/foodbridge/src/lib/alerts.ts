// Deterministic alert rules. Every alert carries the numbers that triggered it, the field
// they came from and a suggested action. Forecast-based alerts say "may" because the
// forecast is a planning reference with an empirical band, not a promise.

import { addMonths, daysInMonth, monthLabel } from "./calendar";
import { forecastNext, trailingMean, type Forecast } from "./forecast";
import { countiesByFips, equityValue, EQUITY_SHORT, feiReady, research } from "./research";
import type { County, PolicyEvent, Shelf, ShelfReport } from "./types";
import { fmt } from "./format";

export type Severity = "critical" | "serious" | "warning" | "info";
export type AlertCategory =
  | "stock"
  | "demand"
  | "capacity"
  | "turnaways"
  | "reporting"
  | "data_quality"
  | "policy"
  | "equity"
  | "forecast";

export interface AlertMetric {
  label: string;
  value: string;
  field?: string;
}

export interface Alert {
  key: string;
  scope: "shelf" | "county" | "network";
  severity: Severity;
  category: AlertCategory;
  title: string;
  detail: string;
  action: string;
  metrics: AlertMetric[];
  shelfId?: string;
  fips?: string;
  source: string;
  url?: string;
}

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, serious: 1, warning: 2, info: 3 };

export interface ShelfOutlook {
  shelf: Shelf;
  reports: ShelfReport[];
  latest: ShelfReport | null;
  households: Forecast | null;
  individuals: Forecast | null;
  pounds: Forecast | null;
  target: string;
  /** Pounds expected to be available next month: inventory + typical receipts. */
  available: number | null;
  coverage: number | null; // available ÷ forecast pounds
  daysOfSupply: number | null;
  growth: number | null; // forecast visits vs trailing 6-month mean
  utilization: number | null; // forecast hi80 visits ÷ capacity
  overdue: boolean;
}

export function shelfOutlook(shelf: Shelf, all: ShelfReport[], asOf: string): ShelfOutlook {
  const reports = all
    .filter((r) => r.shelf_id === shelf.id && r.month <= asOf)
    .sort((a, b) => a.month.localeCompare(b.month));
  const latest = reports[reports.length - 1] ?? null;
  const target = addMonths(asOf, 1);
  const series = (key: "households" | "individuals" | "pounds_distributed") =>
    reports.map((r) => ({ month: r.month, value: r[key] }));
  const households = forecastNext(series("households"), target);
  const individuals = forecastNext(series("individuals"), target);
  const pounds = forecastNext(series("pounds_distributed"), target);
  const receipts = trailingMean(
    reports.map((r) => ({ month: r.month, value: r.pounds_received })),
    target,
    3,
  );
  const available =
    latest?.month === asOf && latest.inventory_lbs != null && receipts != null
      ? latest.inventory_lbs + receipts : null;
  const coverage = available != null && pounds?.yhat ? available / pounds.yhat : null;
  const daysOfSupply =
    latest?.month === asOf && latest.inventory_lbs != null && pounds?.yhat
      ? latest.inventory_lbs / (pounds.yhat / daysInMonth(target))
      : null;
  const base = trailingMean(series("households"), target, 6);
  const growth = households && base ? households.yhat / base - 1 : null;
  const utilization =
    households && shelf.capacity_households ? households.hi80 / shelf.capacity_households : null;
  return {
    shelf,
    reports,
    latest,
    households,
    individuals,
    pounds,
    target,
    available,
    coverage,
    daysOfSupply,
    growth,
    utilization,
    overdue: shelf.active && (!latest || latest.month < asOf),
  };
}

function shelfAlerts(o: ShelfOutlook, asOf: string): Alert[] {
  const out: Alert[] = [];
  const s = o.shelf;
  const county = countiesByFips[s.county_fips];
  const where = county ? `${county.name} County` : s.county_fips;
  const next = monthLabel(o.target);
  const base = { scope: "shelf" as const, shelfId: s.id, fips: s.county_fips };
  const src = "Shelf monthly reports · FoodBridge forecast (1:2:3 working-day run rate, D-045 method)";

  if (o.overdue) {
    out.push({
      ...base,
      key: `reporting:${s.id}:${asOf}`,
      severity: "warning",
      category: "reporting",
      title: `${monthLabel(asOf)} report not submitted`,
      detail: `${s.name} (${where}) has no report for ${monthLabel(asOf)}. Its forecast and the network totals use older months.`,
      action: "Submit the monthly report, or contact the shelf coordinator.",
      metrics: [{ label: "Last report", value: o.latest ? monthLabel(o.latest.month) : "none" }],
      source: "Shelf monthly reports",
    });
  }

  if (o.pounds && o.coverage != null) {
    const hiCoverage = o.available! / o.pounds.hi80;
    const severity: Severity | null =
      o.coverage < 1 ? "critical" : hiCoverage < 1 ? "serious" : (o.daysOfSupply ?? 99) < 14 ? "warning" : null;
    if (severity) {
      out.push({
        ...base,
        key: `stock:${s.id}:${o.target}`,
        severity,
        category: "stock",
        title:
          severity === "critical"
            ? `Stock may run out in ${next}`
            : severity === "serious"
              ? `Stock is short if ${next} demand runs high`
              : "Under two weeks of food on hand",
        detail: `Forecast pounds for ${next} are ${fmt.int(o.pounds.yhat)} lb (80% band ${fmt.int(o.pounds.lo80)}–${fmt.int(o.pounds.hi80)}). On-hand plus typical receipts is about ${fmt.int(o.available)} lb.`,
        action:
          severity === "warning"
            ? "Schedule the next delivery early."
            : "Request an extra delivery or a transfer from a nearby shelf before the month starts.",
        metrics: [
          { label: "Forecast lb", value: fmt.int(o.pounds.yhat), field: "PoundsReg (forecast)" },
          { label: "Available lb", value: fmt.int(o.available), field: "inventory_lbs + avg pounds_received" },
          { label: "Coverage", value: fmt.pct(o.coverage) },
          { label: "Days on hand", value: fmt.num(o.daysOfSupply, 0) },
        ],
        source: src,
      });
    }
  }

  if (o.households && o.growth != null && o.growth > 0.15) {
    out.push({
      ...base,
      key: `demand:${s.id}:${o.target}`,
      severity: o.growth > 0.3 ? "serious" : "warning",
      category: "demand",
      title: `Visits may rise ${fmt.signedPct(o.growth)} in ${next}`,
      detail: `The forecast of ${fmt.int(o.households.yhat)} visits is above the six-month average. Recent months are trending up.`,
      action: "Plan volunteer shifts and product for higher traffic; confirm the trend with the coordinator.",
      metrics: [
        { label: "Forecast visits", value: fmt.int(o.households.yhat), field: "HouseholdsReg (forecast)" },
        { label: "vs 6-mo avg", value: fmt.signedPct(o.growth) },
        { label: "80% band", value: `${fmt.int(o.households.lo80)}–${fmt.int(o.households.hi80)}` },
      ],
      source: src,
    });
  }

  if (o.households && o.utilization != null && o.utilization > 0.9) {
    out.push({
      ...base,
      key: `capacity:${s.id}:${o.target}`,
      severity: o.utilization > 1 ? "serious" : "warning",
      category: "capacity",
      title: o.utilization > 1 ? `Visits may exceed capacity in ${next}` : `Near capacity in ${next}`,
      detail: `The upper 80% forecast is ${fmt.int(o.households.hi80)} visits against a stated capacity of ${fmt.int(s.capacity_households)}.`,
      action: "Add distribution hours, a second site day, or route overflow to a nearby shelf.",
      metrics: [
        { label: "Upper 80% visits", value: fmt.int(o.households.hi80) },
        { label: "Capacity", value: fmt.int(s.capacity_households), field: "capacity_households" },
        { label: "Utilization", value: fmt.pct(o.utilization) },
      ],
      source: src,
    });
  }

  const ta = o.latest?.turned_away ?? 0;
  if (o.latest && ta > 0) {
    const share = ta / Math.max(1, o.latest.households);
    out.push({
      ...base,
      key: `turnaways:${s.id}:${o.latest.month}`,
      severity: share > 0.05 ? "serious" : "warning",
      category: "turnaways",
      title: `${fmt.int(ta)} households could not be served in ${monthLabel(o.latest.month)}`,
      detail: "Turn-aways are unmet demand: a request the shelf could not fill (stock, hours or location).",
      action: "Find the cause (stock, hours, location) and offer a referral path.",
      metrics: [
        { label: "Turned away", value: fmt.int(ta), field: "turned_away" },
        { label: "Share of visits", value: fmt.pct(share, 1) },
      ],
      source: "Shelf monthly reports",
    });
  }

  const recent = o.reports.slice(-3);
  for (const r of recent) {
    if (r.households > r.individuals) {
      out.push({
        ...base,
        key: `dq-hh:${s.id}:${r.month}`,
        severity: "info",
        category: "data_quality",
        title: `${monthLabel(r.month)}: visits above individuals`,
        detail: `Reported visits (${fmt.int(r.households)}) exceed individuals served (${fmt.int(r.individuals)}). This is usually a keying or convention issue (D-043 keeps such months and footnotes them).`,
        action: "Check the report and correct it if it was mis-keyed.",
        metrics: [
          { label: "Visits", value: fmt.int(r.households), field: "HouseholdsReg" },
          { label: "Individuals", value: fmt.int(r.individuals), field: "IndividualsReg" },
        ],
        source: "Shelf monthly reports",
      });
    }
    const ageSum = r.children + r.adults + r.seniors;
    if (r.individuals > 0 && Math.abs(ageSum - r.individuals) / r.individuals > 0.02) {
      out.push({
        ...base,
        key: `dq-age:${s.id}:${r.month}`,
        severity: "info",
        category: "data_quality",
        title: `${monthLabel(r.month)}: age groups do not add up`,
        detail: `Children + adults + seniors = ${fmt.int(ageSum)}, but individuals served = ${fmt.int(r.individuals)}.`,
        action: "Correct the age split so it sums to individuals served.",
        metrics: [{ label: "Difference", value: fmt.int(ageSum - r.individuals) }],
        source: "Shelf monthly reports",
      });
    }
  }
  return out;
}

/** Policy events within the watch window (start between 6 months before and 3 after). */
export function policyWatch(asOf: string, events: PolicyEvent[] = research.policy): PolicyEvent[] {
  const from = addMonths(asOf, -6);
  const to = addMonths(asOf, 3);
  return events
    .filter((e) => {
      const m = e.start.slice(0, 7);
      return m >= from && m <= to;
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}

function policyAlerts(asOf: string): Alert[] {
  return policyWatch(asOf).map((e) => ({
    key: `policy:${e.id}`,
    scope: "network" as const,
    severity: e.direction.startsWith("+") ? ("warning" as const) : ("info" as const),
    category: "policy" as const,
    title: `${e.program}: ${e.name}`,
    detail: `${e.affected}. Expected direction: ${e.direction} ${e.notes}`,
    action: e.direction.startsWith("+")
      ? "Brief affected shelves; watch visits in the following months. Q5 found SNAP months coincided with activity swings that could not be attributed (D-053)."
      : "Context only. Note it in shelf communications if relevant.",
    metrics: [
      { label: "Effective", value: e.start },
      { label: "Level", value: e.level },
    ],
    source: `${e.publisher}: ${e.source}`,
    url: e.url,
  }));
}

function countyAlerts(c: County): Alert[] {
  const out: Alert[] = [];
  const base = { scope: "county" as const, fips: c.fips };
  if (c.robust) {
    out.push({
      ...base,
      key: `equity:${c.fips}:robust`,
      severity: "warning",
      category: "equity",
      title: `${c.name}: on the Q6 audit-first list`,
      detail:
        "Need is above the median and activity per resident is 25+ points lower on all three signals, under every robustness test. This is a call list for local checks, not proof of unmet need (D-052).",
      action: "Start with a conversation: hours, transport, language, unreported shelves. Offer reporting help.",
      metrics: [
        { label: "Need percentile", value: fmt.num(c.need_percentile, 0), field: "need_percentile" },
        { label: "Minimum gap", value: `${fmt.num(c.minimum_gap, 0)} pts`, field: "minimum_gap_pp" },
      ],
      source: "outputs/tables/q6_need_index.csv · q6_robust_set.csv",
    });
  }
  if (feiReady && c.fei?.quintile === 5) {
    out.push({
      ...base,
      key: `equity:${c.fips}:fei`,
      severity: "info",
      category: "equity",
      title: `${c.name}: FEI top quintile`,
      detail: "Residents here face the most barriers between need and the food-shelf network (FEI, higher = more barriers).",
      action: "Review access options: a mobile stop, extended hours or transport support.",
      metrics: [{ label: "FEI", value: fmt.num(c.fei.fei, 1), field: "fei" }],
      source: "outputs/tables/fei_counties.csv (A4)",
    });
  }
  if (c.lila_without_site >= 2) {
    out.push({
      ...base,
      key: `siting:${c.fips}`,
      severity: "info",
      category: "equity",
      title: `${c.name}: ${c.lila_without_site} LILA tracts with no reporting shelf`,
      detail: "Low-income, low-access tracts (USDA 2019, 1 and 10 miles) where no shelf reported in 2024. No shelf in a tract does not prove residents lack service.",
      action: "Check catchments, hours and mobile stops; consider a new-shelf scenario.",
      metrics: [
        { label: "LILA tracts", value: fmt.int(c.lila_tracts), field: "lila_tracts" },
        { label: "Without a shelf", value: fmt.int(c.lila_without_site), field: "lila_without_site" },
      ],
      source: "outputs/tables/q8_county_footprint_gaps.csv",
    });
  }
  const pf = c.forecast.PoundsTotal;
  if (pf?.yhat && pf.lo80 != null && pf.hi80 != null && (pf.hi80 - pf.lo80) / pf.yhat > 0.6) {
    out.push({
      ...base,
      key: `forecast:${c.fips}:band`,
      severity: "info",
      category: "forecast",
      title: `${c.name}: wide August forecast band`,
      detail: `The 80% band for pounds is ${fmt.int(pf.lo80)}–${fmt.int(pf.hi80)} lb around ${fmt.int(pf.yhat)} lb. Small or volatile counties are hard to forecast.`,
      action: "Plan with a buffer; avoid allocating to the point forecast alone.",
      metrics: [
        { label: "Forecast lb", value: fmt.int(pf.yhat), field: "PoundsReg (Q7 forecast)" },
        { label: "Band width", value: fmt.pct((pf.hi80 - pf.lo80) / pf.yhat) },
      ],
      source: "outputs/forecasts/q7_august2026_wide.csv",
    });
  }
  if (c.sites_2024 === 0) {
    out.push({
      ...base,
      key: `nosite:${c.fips}`,
      severity: "info",
      category: "equity",
      title: `${c.name}: no reporting food shelf`,
      detail: "No shelf in this county reported to the statewide network in 2022–July 2026. Residents may travel to neighbouring counties.",
      action: "Confirm local options with neighbouring shelves before any siting decision.",
      metrics: [{ label: "Reporting shelves (2024)", value: "0", field: "n_sites" }],
      source: "outputs/tables/q1_county_concentration.csv",
    });
  }
  return out;
}

export interface AlertContext {
  shelves: Shelf[];
  reports: ShelfReport[];
  asOf: string;
}

export function computeAlerts(ctx: AlertContext): { alerts: Alert[]; outlooks: ShelfOutlook[] } {
  const outlooks = ctx.shelves.filter((s) => s.active).map((s) => shelfOutlook(s, ctx.reports, ctx.asOf));
  const alerts = [
    ...outlooks.flatMap((o) => shelfAlerts(o, ctx.asOf)),
    ...research.counties.flatMap(countyAlerts),
    ...policyAlerts(ctx.asOf),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title));
  return { alerts, outlooks };
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  serious: "Serious",
  warning: "Warning",
  info: "Info",
};

export function equityNote(): string {
  return feiReady
    ? "FEI from A4's build (outputs/tables/fei_counties.csv)."
    : `${EQUITY_SHORT}: Q6 need percentile, shown until A4's FEI tables land. It is not FEI.`;
}

export { equityValue };
