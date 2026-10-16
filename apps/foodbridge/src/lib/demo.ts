// Synthetic demo network. Every shelf and report here is invented for demonstration,
// named "Demo shelf", and flagged is_demo. Monthly levels are scaled from county
// aggregates in the research bundle (Q7 forecast per reporting site) and shaped by the
// statewide monthly pattern; they are not The Food Group's site data.

import { addMonths, monthRange, workdays } from "./calendar";
import { research } from "./research";
import type { County, Shelf, ShelfReport, ShelfRequest, ShelfType } from "./types";

export const DEMO_AS_OF = research.meta.observed_end; // "2026-07"
const DEMO_START = "2025-01";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoSpec {
  county: string;
  suffix: string;
  type: ShelfType;
  scale: number;
  quirk?: "low_stock" | "surge" | "capacity" | "overdue" | "turnaways" | "data_quality";
}

const SPECS: DemoSpec[] = [
  { county: "Hennepin", suffix: "A", type: "brick_and_mortar", scale: 1.1 },
  { county: "Hennepin", suffix: "B", type: "brick_and_mortar", scale: 0.8, quirk: "surge" },
  { county: "Ramsey", suffix: "A", type: "brick_and_mortar", scale: 1.0 },
  { county: "Anoka", suffix: "A", type: "mobile", scale: 0.6 },
  { county: "Chippewa", suffix: "A", type: "brick_and_mortar", scale: 1.0, quirk: "low_stock" },
  { county: "Lyon", suffix: "A", type: "brick_and_mortar", scale: 1.0, quirk: "capacity" },
  { county: "Wadena", suffix: "A", type: "brick_and_mortar", scale: 1.0, quirk: "overdue" },
  { county: "Todd", suffix: "A", type: "outreach", scale: 0.9, quirk: "turnaways" },
  { county: "Nobles", suffix: "A", type: "brick_and_mortar", scale: 1.0 },
  { county: "Swift", suffix: "A", type: "brick_and_mortar", scale: 0.9 },
  { county: "St. Louis", suffix: "A", type: "brick_and_mortar", scale: 1.0, quirk: "data_quality" },
  { county: "Stearns", suffix: "A", type: "brick_and_mortar", scale: 1.0 },
  { county: "Olmsted", suffix: "A", type: "brick_and_mortar", scale: 0.9 },
  { county: "Beltrami", suffix: "A", type: "tribal", scale: 0.8 },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Statewide visits per working day, indexed to the last three observed months = 1. */
function statewideIndex(): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const h of research.history) {
    if (h.HouseholdsTotal != null) rates[h.month] = h.HouseholdsTotal / h.workdays;
  }
  const last = [0, 1, 2].map((k) => rates[addMonths(DEMO_AS_OF, -k)]).filter(Boolean);
  const base = last.reduce((s, v) => s + v, 0) / last.length;
  return Object.fromEntries(Object.entries(rates).map(([m, r]) => [m, r / base]));
}

export interface DemoData {
  shelves: Shelf[];
  reports: ShelfReport[];
  requests: ShelfRequest[];
}

export function buildDemoData(): DemoData {
  const rand = mulberry32(20261017);
  const index = statewideIndex();
  const counties = Object.fromEntries(research.counties.map((c) => [c.name, c])) as Record<string, County>;
  const shelves: Shelf[] = [];
  const reports: ShelfReport[] = [];
  const created = "2026-01-05T15:00:00.000Z";

  for (const spec of SPECS) {
    const county = counties[spec.county];
    if (!county) continue;
    const fc = county.forecast;
    const sites = Math.max(1, fc.HouseholdsTotal?.sites ?? county.sites_2024 ?? 1);
    const target = addMonths(DEMO_AS_OF, 1);
    const perDay = ((fc.HouseholdsTotal?.yhat ?? 300) / workdays(target) / sites) * spec.scale;
    const indPerHh = (fc.IndividualsTotal?.yhat ?? 2.5) / Math.max(1, fc.HouseholdsTotal?.yhat ?? 1);
    const lbsPerHh = (fc.PoundsTotal?.yhat ?? 40) / Math.max(1, fc.HouseholdsTotal?.yhat ?? 1);
    const ages = {
      c: fc.ChildrenTotal?.yhat ?? 1,
      a: fc.AdultsTotal?.yhat ?? 1,
      s: fc.SeniorsTotal?.yhat ?? 1,
    };
    const ageTotal = ages.c + ages.a + ages.s;
    const id = `demo-${slug(spec.county)}-${spec.suffix.toLowerCase()}`;
    const avgHouseholds = perDay * 21;
    shelves.push({
      id,
      name: `Demo shelf — ${spec.county} ${spec.suffix}`,
      county_fips: county.fips,
      type: spec.type,
      capacity_households: Math.round(avgHouseholds * (spec.quirk === "capacity" ? 1.02 : 1.3)),
      storage_lbs: Math.round(avgHouseholds * lbsPerHh * 1.6),
      hours: spec.type === "mobile" ? "2nd & 4th Tuesday, 3–6 pm" : "Mon/Wed 10–4 · Thu 2–7",
      contact_name: "Demo coordinator",
      active: true,
      is_demo: true,
      priority_status: null,
      manager_note: null,
      created_at: created,
    });

    let inventory = avgHouseholds * lbsPerHh * 1.1;
    const months = monthRange(DEMO_START, DEMO_AS_OF);
    months.forEach((month, i) => {
      if (spec.quirk === "overdue" && month === DEMO_AS_OF) return;
      const noise = 1 + (rand() - 0.5) * 0.14;
      const surge = spec.quirk === "surge" && i >= months.length - 3 ? 1 + 0.3 * (i - months.length + 4) : 1;
      const households = Math.max(
        5,
        Math.round(perDay * (index[month] ?? 1) * workdays(month) * noise * surge),
      );
      let individuals = Math.round(households * indPerHh * (1 + (rand() - 0.5) * 0.06));
      if (spec.quirk === "data_quality" && month === addMonths(DEMO_AS_OF, -1)) {
        individuals = Math.round(households * 0.8); // keyed visits above individuals (flag)
      }
      const children = Math.round((individuals * ages.c) / ageTotal);
      const seniors = Math.round((individuals * ages.s) / ageTotal);
      const adults = individuals - children - seniors;
      const pounds = Math.round(households * lbsPerHh * (1 + (rand() - 0.5) * 0.1));
      const receivedFactor = spec.quirk === "low_stock" && i >= months.length - 4 ? 0.72 : 0.97 + rand() * 0.08;
      const received = Math.round(pounds * receivedFactor);
      inventory = Math.max(0, inventory + received - pounds);
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
        pounds_received: received,
        inventory_lbs: Math.round(inventory),
        volunteer_hours: Math.round(households * (0.35 + rand() * 0.1)),
        turned_away:
          spec.quirk === "turnaways" && month >= addMonths(DEMO_AS_OF, -1)
            ? Math.round(households * (month === DEMO_AS_OF ? 0.07 : 0.03))
            : 0,
        notes: null,
        submitted_at: `${addMonths(month, 1)}-08T16:00:00.000Z`,
        submitted_by: "demo",
      });
    });
  }

  const requests: ShelfRequest[] = [
    {
      id: "demo-req-1",
      shelf_id: "demo-chippewa-a",
      kind: "food",
      urgency: "high",
      message: "Shelf-stable protein is running low ahead of the school-year start. Requesting an extra delivery.",
      pounds_requested: 2500,
      status: "open",
      response: null,
      created_at: "2026-08-03T14:10:00.000Z",
      updated_at: "2026-08-03T14:10:00.000Z",
    },
    {
      id: "demo-req-2",
      shelf_id: "demo-todd-a",
      kind: "volunteers",
      urgency: "normal",
      message: "Need two more drivers for the outreach route on Thursdays.",
      pounds_requested: null,
      status: "in_progress",
      response: "Posting to the regional volunteer list this week.",
      created_at: "2026-07-28T18:30:00.000Z",
      updated_at: "2026-07-30T13:00:00.000Z",
    },
  ];
  return { shelves, reports, requests };
}
