// Hypothetical shelf requests for the county networks workspace. Each one is triggered by
// a real county pattern (sponsor totals at county grain, or a research table) and quotes
// the numbers that triggered it, so a reviewer can trace why that county "asked". The
// requests themselves are invented examples: no shelf sent them. Rules are deterministic,
// so every browser seeds the same inbox.
//
// Comparisons use three-month windows of clean months only (same reporting-site count as
// the as-of month, no blank fields): single months carry keying errors and batch reports
// that read as growth.

import { addMonths, monthLabel, monthRange } from "./calendar";
import { fmt } from "./format";
import { countiesByFips } from "./research";
import type { RequestStatus, Shelf, ShelfReport, ShelfRequest } from "./types";

interface Window {
  label: string; // e.g. "May–Jul 2026"
  households: number;
  individuals: number;
  pounds: number;
  children: number;
  seniors: number;
  months: number;
}

interface Row {
  shelf: Shelf;
  now: ShelfReport;
  recent: Window | null; // last three months
  prior: Window | null; // same three months a year earlier
  spring: Window | null; // three months before the recent pair (school in session)
  summer: Window | null; // the as-of month and the one before
}

type Draft = Pick<ShelfRequest, "kind" | "urgency" | "message" | "pounds_requested"> & {
  status?: RequestStatus;
  response?: string;
};

type Rule = (rows: Row[], used: Set<string>) => { row: Row; draft: Draft }[];

const growth = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b - 1 : null);
const per = (a: number, b: number) => (b > 0 ? a / b : null);
const round500 = (v: number) => Math.max(500, Math.round(v / 500) * 500);
const free = (used: Set<string>) => (r: Row) => !used.has(r.shelf.county_fips);
const top = <T>(rows: T[], score: (r: T) => number | null, n: number) =>
  rows
    .map((r) => [r, score(r)] as const)
    .filter((x): x is readonly [T, number] => x[1] != null && Number.isFinite(x[1]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([r]) => r);

// Network notes start "N reporting sites" and say "blank" when some site skipped a field.
const sitesIn = (r: ShelfReport) => Number(r.notes?.match(/^(\d+) reporting site/)?.[1] ?? NaN);
const clean = (r: ShelfReport | undefined, now: ShelfReport): r is ShelfReport =>
  !!r && !r.notes?.includes("blank") && (Number.isNaN(sitesIn(now)) || sitesIn(r) === sitesIn(now));

function windowOf(get: (m: string) => ShelfReport | undefined, now: ShelfReport, from: string, to: string): Window | null {
  const months = monthRange(from, to);
  const rows = months.map(get);
  if (!rows.every((r) => clean(r, now))) return null;
  // A month far below its neighbours (e.g. 2,929 lb between two 60,000 lb months) is a
  // keying or partial-report artifact; drop the whole window rather than read it as change.
  const dip = (vals: number[]) => {
    const median = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)];
    return vals.some((v) => v < 0.4 * median);
  };
  if (dip(rows.map((r) => r.households)) || dip(rows.map((r) => r.pounds_distributed))) return null;
  const sum = (k: keyof Pick<ShelfReport, "households" | "individuals" | "pounds_distributed" | "children" | "seniors">) =>
    (rows as ShelfReport[]).reduce((s, r) => s + r[k], 0);
  const label = from === to ? monthLabel(from) : `${monthLabel(from).split(" ")[0]}–${monthLabel(to)}`;
  return {
    label,
    households: sum("households"),
    individuals: sum("individuals"),
    pounds: sum("pounds_distributed"),
    children: sum("children"),
    seniors: sum("seniors"),
    months: months.length,
  };
}

const visitGrowth = (r: Row) => (r.recent && r.prior ? growth(r.recent.households, r.prior.households) : null);

/** Visits up on last year while pounds per visit fell: ask for one month of the pounds that
 * would restore last year's pounds per visit. */
const shortfall: Rule = (rows, used) =>
  top(
    rows.filter(free(used)).filter((r) => {
      if (!r.recent || !r.prior || r.recent.households / 3 < 300) return false;
      const p = growth(per(r.recent.pounds, r.recent.households), per(r.prior.pounds, r.prior.households));
      return (visitGrowth(r) ?? 0) >= 0.1 && p != null && p <= -0.08;
    }),
    visitGrowth,
    2,
  ).map((row, i) => {
    const { recent, prior } = row as Row & { recent: Window; prior: Window };
    const before = per(prior.pounds, prior.households)!;
    const after = per(recent.pounds, recent.households)!;
    const monthly = recent.households / recent.months;
    const lbs = round500((before - after) * monthly);
    return {
      row,
      draft: {
        kind: "food",
        urgency: "high",
        pounds_requested: lbs,
        message: `${recent.label} visits were ${fmt.int(recent.households)} (HouseholdsReg), ${fmt.signedPct(visitGrowth(row))} on ${prior.label}, while pounds per visit fell from ${fmt.num(before, 1)} to ${fmt.num(after, 1)} lb. Requesting about ${fmt.int(lbs)} lb of mixed shelf-stable product: one month at the recent pace (${fmt.int(monthly)} visits) back at last year's pounds per visit.`,
        ...(i === 0
          ? { status: "in_progress" as const, response: "Checking warehouse availability; we can cover part of this on the next scheduled truck and will confirm the balance this week." }
          : {}),
      },
    };
  });

/** Fastest sustained visit growth among larger networks: volunteer shifts. */
const volunteers: Rule = (rows, used) =>
  top(rows.filter(free(used)).filter((r) => (r.recent?.households ?? 0) / 3 >= 1000), visitGrowth, 1)
    .filter((r) => (visitGrowth(r) ?? 0) > 0.05)
    .map((row) => ({
      row,
      draft: {
        kind: "volunteers",
        urgency: "normal",
        pounds_requested: null,
        message: `Visits over ${row.recent!.label} were ${fmt.int(row.recent!.households)}, ${fmt.signedPct(visitGrowth(row))} on ${row.prior!.label}, serving ${fmt.int(row.now.individuals)} individuals in ${monthLabel(row.now.month)} alone (IndividualsReg). Distribution days are running long; asking for help recruiting additional volunteer shifts through the fall.`,
      },
    }));

/** Children served per month rose once school let out: kid-friendly product. */
const summerKids: Rule = (rows, used) => {
  const lift = (r: Row) => (r.spring && r.summer ? growth(r.summer.children / r.summer.months, r.spring.children / r.spring.months) : null);
  return top(rows.filter(free(used)).filter((r) => (r.summer?.children ?? 0) / 2 >= 200), lift, 1)
    .filter((r) => (lift(r) ?? 0) > 0.1)
    .map((row) => ({
      row,
      draft: {
        kind: "food",
        urgency: "normal",
        pounds_requested: null,
        message: `Children served averaged ${fmt.int(row.summer!.children / row.summer!.months)} a month in ${row.summer!.label}, up from ${fmt.int(row.spring!.children / row.spring!.months)} in ${row.spring!.label} (ChildrenReg, ${fmt.signedPct(lift(row))}) with school out. Requesting kid-friendly, no-cook items (cereal, shelf-stable milk, snacks) until school meals restart.`,
      },
    }));
};

/** Rural county where many residents live beyond 10 miles of a reporting shelf: mobile stop. */
const transport: Rule = (rows, used) =>
  top(
    rows.filter(free(used)).filter((r) => countiesByFips[r.shelf.county_fips]?.nonmetro),
    (r) => countiesByFips[r.shelf.county_fips]?.share_beyond_10 ?? null,
    1,
  ).map((row) => {
    const c = countiesByFips[row.shelf.county_fips];
    return {
      row,
      draft: {
        kind: "transport",
        urgency: "high",
        pounds_requested: null,
        message: `${fmt.pct(c.share_beyond_10, 0)} of residents live more than 10 miles from the nearest reporting shelf (2024 network, straight line; ${fmt.num(c.mean_miles, 1)} mi on average). Requesting a monthly mobile distribution stop or refrigerated van time to reach the outer townships.`,
      },
    };
  });

/** Largest sustained pounds growth: cold storage to hold the extra volume. */
const equipment: Rule = (rows, used) => {
  const g = (r: Row) => (r.recent && r.prior ? growth(r.recent.pounds, r.prior.pounds) : null);
  return top(rows.filter(free(used)).filter((r) => (r.recent?.pounds ?? 0) / 3 >= 20000), g, 1)
    .filter((r) => (g(r) ?? 0) > 0.1)
    .map((row) => ({
      row,
      draft: {
        kind: "equipment",
        urgency: "normal",
        pounds_requested: null,
        status: "fulfilled",
        response: "Approved: one reach-in freezer from the equipment grant pool; delivery coordinated with the county lead.",
        message: `Pounds distributed over ${row.recent!.label} were ${fmt.int(row.recent!.pounds)} lb against ${fmt.int(row.prior!.pounds)} lb in ${row.prior!.label} (PoundsReg, ${fmt.signedPct(g(row))}). Cold storage is the bottleneck for produce and dairy; requesting a freezer or cooler.`,
      },
    }));
};

/** Highest share of seniors among individuals served: senior-friendly boxes. */
const seniors: Rule = (rows, used) =>
  top(rows.filter(free(used)).filter((r) => (r.recent?.individuals ?? 0) / 3 >= 500), (r) => per(r.recent!.seniors, r.recent!.individuals), 1).map((row) => ({
    row,
    draft: {
      kind: "food",
      urgency: "low",
      pounds_requested: null,
      message: `Seniors were ${fmt.pct(per(row.recent!.seniors, row.recent!.individuals), 0)} of individuals served over ${row.recent!.label} (SeniorsReg ${fmt.int(row.recent!.seniors)} of IndividualsReg ${fmt.int(row.recent!.individuals)}). Requesting pre-packed, low-sodium senior boxes that are easier to carry for drive-up pickup.`,
    },
  }));

/** Q6 audit-first county: outreach funding to check hours, transport and unreported shelves. */
const outreach: Rule = (rows, used) =>
  top(rows.filter(free(used)).filter((r) => countiesByFips[r.shelf.county_fips]?.robust), (r) => countiesByFips[r.shelf.county_fips]?.minimum_gap ?? null, 1).map((row) => {
    const c = countiesByFips[row.shelf.county_fips];
    return {
      row,
      draft: {
        kind: "funding",
        urgency: "normal",
        pounds_requested: null,
        message: `${c.name} is on the Q6 audit-first list (need percentile ${fmt.num(c.need_percentile, 0)}, activity at least ${fmt.num(c.minimum_gap, 0)} points lower on every signal). Requesting a small outreach grant for evening hours and flyers in partner clinics. The flag is a call list for local checks, not proof of unmet need.`,
      },
    };
  });

/** The as-of month has a field some sites left blank: reporting help. */
const reporting: Rule = (rows, used) =>
  rows
    .filter(free(used))
    .filter((r) => r.now.notes?.includes("blank"))
    .slice(0, 1)
    .map((row) => ({
      row,
      draft: {
        kind: "other",
        urgency: "low",
        pounds_requested: null,
        message: `Some of our sites left fields blank in the ${monthLabel(row.now.month)} report. Asking for a short walkthrough of the monthly reporting form so every site submits visits, individuals by age and pounds.`,
      },
    }));

const RULES: Rule[] = [shortfall, transport, summerKids, volunteers, equipment, outreach, seniors, reporting];

export function hypotheticalRequests(shelves: Shelf[], reports: ShelfReport[], asOf: string): ShelfRequest[] {
  const byKey = new Map(reports.map((r) => [`${r.shelf_id}|${r.month}`, r]));
  const rows: Row[] = shelves.flatMap((shelf) => {
    const now = byKey.get(`${shelf.id}|${asOf}`);
    if (!now) return [];
    const get = (m: string) => byKey.get(`${shelf.id}|${m}`);
    return [
      {
        shelf,
        now,
        recent: windowOf(get, now, addMonths(asOf, -2), asOf),
        prior: windowOf(get, now, addMonths(asOf, -14), addMonths(asOf, -12)),
        spring: windowOf(get, now, addMonths(asOf, -4), addMonths(asOf, -2)),
        summer: windowOf(get, now, addMonths(asOf, -1), asOf),
      },
    ];
  });
  const used = new Set<string>();
  const out: ShelfRequest[] = [];
  const next = addMonths(asOf, 1);
  for (const rule of RULES) {
    for (const { row, draft } of rule(rows, used)) {
      used.add(row.shelf.county_fips);
      // Spread over the first two weeks after the as-of month, newest first in the inbox.
      const stamp = `${next}-${String(14 - out.length).padStart(2, "0")}T15:00:00.000Z`;
      const { status = "open", response = null, ...rest } = draft;
      out.push({
        ...rest,
        id: `hyp-${draft.kind}-${row.shelf.county_fips}`,
        shelf_id: row.shelf.id,
        status,
        response,
        created_at: stamp,
        updated_at: stamp,
        hypothetical: true,
      });
    }
  }
  return out;
}
