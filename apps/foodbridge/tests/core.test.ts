import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeAlerts } from "@/lib/alerts";
import { allocate } from "@/lib/allocate";
import { addMonths, workdays } from "@/lib/calendar";
import { buildDemoData, DEMO_AS_OF } from "@/lib/demo";
import { forecastNext } from "@/lib/forecast";
import { haversineMiles } from "@/lib/geo";
import { prioritize } from "@/lib/priority";
import { research } from "@/lib/research";
import { decay, DEFAULT_MONEY, feiImpact, runScenario } from "@/lib/scenario";
import type { FeiTractPayload } from "@/lib/types";

describe("calendar", () => {
  it("matches the Q7 working-day calendar (Aug 2026 = 21, Jul 2026 = 22)", () => {
    expect(workdays("2026-08")).toBe(21);
    expect(workdays("2026-07")).toBe(22);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

describe("forecast", () => {
  it("weights the last three working-day rates 1:2:3", () => {
    const h = [
      { month: "2026-05", value: workdays("2026-05") * 10 },
      { month: "2026-06", value: workdays("2026-06") * 20 },
      { month: "2026-07", value: workdays("2026-07") * 30 },
    ];
    const f = forecastNext(h, "2026-08")!;
    expect(f.yhat).toBeCloseTo(((1 * 10 + 2 * 20 + 3 * 30) / 6) * 21, 6);
    expect(f.band).toBe("default");
    expect(f.lo80).toBeLessThan(f.yhat);
    expect(f.hi95).toBeGreaterThan(f.hi80);
  });
  it("drops a missing month with its weight", () => {
    const f = forecastNext(
      [
        { month: "2026-05", value: workdays("2026-05") * 10 },
        { month: "2026-07", value: workdays("2026-07") * 30 },
      ],
      "2026-08",
    )!;
    expect(f.yhat).toBeCloseTo(((1 * 10 + 3 * 30) / 4) * 21, 6);
  });
});

describe("allocate", () => {
  const ids = research.counties.filter((c) => c.robust).map((c) => c.fips);
  it("drafts plus reserve equal the pool exactly", () => {
    const a = allocate(research.counties, { total: 123457, reserve: 7, ids, needWeight: 35 });
    expect(a.rows.reduce((s, r) => s + r.pounds, 0) + a.reservePounds).toBe(123457);
  });
  it("need weight 0 reproduces the demand-only split", () => {
    const a = allocate(research.counties, { total: 100000, reserve: 0, ids, needWeight: 0 });
    for (const r of a.rows) expect(Math.abs(r.pounds - r.demandPounds)).toBeLessThanOrEqual(1);
  });
  it("refuses a county with no forecast instead of treating it as zero", () => {
    const wilkin = research.counties.find((c) => c.name === "Wilkin")!;
    expect(() => allocate(research.counties, { total: 1000, reserve: 0, ids: [wilkin.fips] })).toThrow();
  });
});

describe("scenario", () => {
  it("uses A4's decay bands at the edges", () => {
    expect(decay(1, true)).toBe(1);
    expect(decay(1.01, true)).toBe(0.6);
    expect(decay(10, true)).toBe(0.1);
    expect(decay(10.01, true)).toBe(0);
    expect(decay(30, false)).toBe(0.1);
    expect(decay(30.1, false)).toBe(0);
  });
  it("brings residents closer and never raises FEI", () => {
    const chippewa = research.counties.find((c) => c.name === "Chippewa")!;
    const tracts = research.fei.status === "ready" ? loadFeiTracts().tracts : [];
    const r = runScenario(
      {
        lon: chippewa.centroid![0],
        lat: chippewa.centroid![1],
        county: chippewa.fips,
        type: "brick_and_mortar",
        householdsPerMonth: 200,
        poundsPerMonth: 9000,
        money: DEFAULT_MONEY.brick_and_mortar,
      },
      tracts,
    );
    expect(r.residentsCloser).toBeGreaterThan(0);
    expect(r.poundsPerLowIncomeAfter!).toBeGreaterThan(r.poundsPerLowIncomeBefore!);
    if (r.fei.status === "ready") {
      expect(r.fei.countyAfter!).toBeLessThanOrEqual(r.fei.countyBefore! + 1e-9);
      expect(r.fei.stateAfter!).toBeLessThanOrEqual(r.fei.stateBefore! + 1e-9);
    }
    expect(r.dollars.annualPounds).toBe(108000);
    expect(r.dollars.annualMeals).toBeCloseTo(90000, 6);
  });
});

function loadFeiTracts(): FeiTractPayload {
  return JSON.parse(readFileSync(path.join(__dirname, "../public/data/fei-tracts.json"), "utf8"));
}

describe.runIf(research.fei.status === "ready")("FEI consistency with the build", () => {
  it("recomputes T from published inputs and bounds within rounding", () => {
    const { tracts } = loadFeiTracts();
    const norm = research.fei.meta!.normalization as Record<string, { bounds: [number, number] }>;
    const n = (key: string, x: number) => {
      const [lo, hi] = norm[key].bounds;
      return Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    };
    let worst = 0;
    for (const t of tracts) {
      if (t.T == null || t.d == null || t.d_bm == null || t.theta == null || t.beyond == null) continue;
      const T = 0.5 * n("miles_nearest", t.d) + 0.3 * t.beyond + 0.2 * n("brick_excess_miles", Math.max(0, t.d_bm - t.theta));
      worst = Math.max(worst, Math.abs(T - t.T));
    }
    expect(worst).toBeLessThan(2e-3);
  });
  it("recomputes S from published access and bounds within rounding", () => {
    const { tracts } = loadFeiTracts();
    const [lo, hi] = (research.fei.meta!.normalization as Record<string, { bounds: [number, number] }>).lbs_per_lowinc_resident.bounds;
    let worst = 0;
    for (const t of tracts) {
      if (t.S == null || t.A == null) continue;
      const S = 1 - Math.max(0, Math.min(1, (t.A - lo) / (hi - lo)));
      worst = Math.max(worst, Math.abs(S - t.S));
    }
    expect(worst).toBeLessThan(2e-3);
  });
  it("a far-away shelf changes nothing", () => {
    const { tracts } = loadFeiTracts();
    const { impact } = feiImpact(
      { lon: -60, lat: 30, county: "27023", type: "mobile", householdsPerMonth: 100, poundsPerMonth: 5000, money: DEFAULT_MONEY.mobile },
      tracts,
    );
    expect(impact.status).toBe("ready");
    expect(impact.stateAfter).toBeCloseTo(impact.stateBefore!, 9);
  });
});

describe("alerts on the demo network", () => {
  const demo = buildDemoData();
  const { alerts, outlooks } = computeAlerts({ shelves: demo.shelves, reports: demo.reports, asOf: DEMO_AS_OF });
  const has = (shelf: string, category: string) =>
    alerts.some((a) => a.shelfId === shelf && a.category === category);
  it("flags each built-in demo situation", () => {
    expect(has("demo-chippewa-a", "stock")).toBe(true);
    expect(has("demo-wadena-a", "reporting")).toBe(true);
    expect(has("demo-lyon-a", "capacity")).toBe(true);
    expect(has("demo-hennepin-b", "demand")).toBe(true);
    expect(has("demo-todd-a", "turnaways")).toBe(true);
    expect(has("demo-st-louis-a", "data_quality")).toBe(true);
  });
  it("every alert carries an action and a source", () => {
    for (const a of alerts) {
      expect(a.action.length).toBeGreaterThan(5);
      expect(a.source.length).toBeGreaterThan(3);
    }
  });
  it("prioritization puts manager overrides first", () => {
    const shelves = demo.shelves.map((s) => (s.id === "demo-olmsted-a" ? { ...s, priority_status: "urgent" as const } : s));
    const ol = computeAlerts({ shelves, reports: demo.reports, asOf: DEMO_AS_OF }).outlooks;
    expect(prioritize(ol)[0].outlook.shelf.id).toBe("demo-olmsted-a");
    expect(outlooks.length).toBe(demo.shelves.length);
  });
  it("demo shelves are labelled and never report beyond the as-of month", () => {
    expect(demo.shelves.every((s) => s.is_demo && s.name.startsWith("Demo shelf"))).toBe(true);
    expect(demo.reports.every((r) => r.month <= DEMO_AS_OF)).toBe(true);
  });
});

describe("geo", () => {
  it("haversine is about 69 miles per degree of latitude", () => {
    expect(haversineMiles(-94, 45, -94, 46)).toBeCloseTo(69.1, 0);
  });
});
