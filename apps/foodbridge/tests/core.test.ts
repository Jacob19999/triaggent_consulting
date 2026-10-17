import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeAlerts } from "@/lib/alerts";
import { allocate } from "@/lib/allocate";
import { addMonths, workdays } from "@/lib/calendar";
import { buildNetworkData, NETWORK_AS_OF, NETWORKS_SHA, SITE_TYPES, siteTypesFrom, type NetworkPayload } from "@/lib/networks";
import { forecastNext } from "@/lib/forecast";
import { haversineMiles } from "@/lib/geo";
import { prioritize } from "@/lib/priority";
import { DEFAULT_FEI_WEIGHTS, feiContributions, feiFromPillars } from "@/lib/pillars";
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

describe("FEI formula (D-069)", () => {
  it("multiplies need and access and matches the pipeline's hand case", () => {
    // Same case as tests/test_fei.py: Need = 0.68, Access = 0.45.
    expect(feiFromPillars({ N: 0.8, S: 0.2, T: 0.6, M: 0.5, V: 0.4 })).toBeCloseTo(100 * Math.sqrt(0.68 * 0.45), 9);
    expect(feiFromPillars({ N: 0, S: 1, T: 1, M: 1, V: 0 })).toBe(0);
    expect(feiFromPillars({ N: 0.5, S: null, T: 0.5, M: 0.5, V: 0.5 })).toBeNull();
    expect(DEFAULT_FEI_WEIGHTS.N + DEFAULT_FEI_WEIGHTS.V).toBeCloseTo(0.5, 12);
  });
  it("splits FEI into pillar points that add up to it", () => {
    const v = { N: 0.8, S: 0.2, T: 0.6, M: 0.5, V: 0.4 };
    const sum = feiContributions(v).reduce((s, p) => s + p.value, 0);
    expect(sum).toBeCloseTo(feiFromPillars(v)!, 9);
  });
});

describe.runIf(research.fei.status === "ready")("FEI consistency with the build", () => {
  it("recomputes tract FEI from the published pillars within rounding", () => {
    const { tracts } = loadFeiTracts();
    const w = research.fei.meta!.params as { weights: typeof DEFAULT_FEI_WEIGHTS };
    expect(w.weights).toEqual(DEFAULT_FEI_WEIGHTS);
    let worst = 0;
    for (const t of tracts) {
      const f = feiFromPillars(t);
      if (f == null || t.fei == null) continue;
      worst = Math.max(worst, Math.abs(f - t.fei));
    }
    expect(worst).toBeLessThan(0.05);
  });
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

describe("county networks (statewide extract, county grain)", () => {
  const payload = JSON.parse(readFileSync(path.join(__dirname, "../public/data/networks.json"), "utf8")) as NetworkPayload;
  const net = buildNetworkData(payload);
  const { alerts, outlooks } = computeAlerts({ shelves: net.shelves, reports: net.reports, asOf: NETWORK_AS_OF });
  it("has one labelled network per reporting county and nothing past the as-of month", () => {
    expect(net.shelves).toHaveLength(86);
    expect(net.shelves.some((s) => s.name.startsWith("Wilkin"))).toBe(false);
    expect(net.shelves.every((s) => s.is_demo && s.name.endsWith("County network"))).toBe(true);
    expect(net.reports.every((r) => r.month <= NETWORK_AS_OF && r.month < research.meta.forecast_target)).toBe(true);
  });
  it("seeds labelled hypothetical requests, one per county, each quoting real county numbers", () => {
    expect(net.requests.length).toBeGreaterThanOrEqual(5);
    expect(net.requests.every((r) => r.hypothetical && r.id.startsWith("hyp-"))).toBe(true);
    const shelfIds = new Set(net.shelves.map((s) => s.id));
    expect(net.requests.every((r) => shelfIds.has(r.shelf_id))).toBe(true);
    expect(new Set(net.requests.map((r) => r.shelf_id)).size).toBe(net.requests.length);
    expect(net.requests.every((r) => /\d/.test(r.message) && r.created_at > `${NETWORK_AS_OF}-31`)).toBe(true);
    expect(new Set(net.requests.map((r) => r.kind)).size).toBeGreaterThanOrEqual(4);
    expect(buildNetworkData(payload).requests).toEqual(net.requests); // deterministic
  });
  it("site-type counts add up to each network's reporting sites in the as-of month", () => {
    const mix = siteTypesFrom(payload);
    expect(mix.month).toBe(NETWORK_AS_OF);
    for (const c of payload.counties) {
      const sites = c.rows.find((r) => r[0] === NETWORK_AS_OF)?.[1] ?? 0;
      const typed = Object.values(mix.counties[c.fips] ?? {}).reduce((s, t) => s + (t?.sites ?? 0), 0);
      expect(typed).toBe(sites);
    }
    expect(Object.keys(mix.counties).every((f) => Object.keys(mix.counties[f]).every((t) => (SITE_TYPES as readonly string[]).includes(t)))).toBe(true);
  });
  it("year-earlier site types add up to the same month a year earlier", () => {
    const mix = siteTypesFrom(payload);
    const prior = mix.prior.month!;
    expect(prior).toBe(`${Number(NETWORK_AS_OF.slice(0, 4)) - 1}${NETWORK_AS_OF.slice(4)}`);
    for (const c of payload.counties) {
      const sites = c.rows.find((r) => r[0] === prior)?.[1] ?? 0;
      const typed = Object.values(mix.prior.counties[c.fips] ?? {}).reduce((s, t) => s + (t?.sites ?? 0), 0);
      expect(typed).toBe(sites);
    }
  });
  it("matches the bundle's fingerprint and the statewide history", () => {
    expect(payload.meta.sha256).toBe(NETWORKS_SHA);
    const july = net.reports.filter((r) => r.month === NETWORK_AS_OF).reduce((s, r) => s + r.households, 0);
    expect(july).toBe(research.history.find((h) => h.month === NETWORK_AS_OF)!.HouseholdsTotal);
  });
  it("leaves fields the extract lacks blank instead of inventing them", () => {
    expect(net.reports.every((r) => r.inventory_lbs == null && r.pounds_received == null && r.turned_away == null)).toBe(true);
    expect(net.shelves.every((s) => s.capacity_households == null && s.storage_lbs == null)).toBe(true);
    expect(alerts.some((a) => ["stock", "capacity", "turnaways"].includes(a.category))).toBe(false);
  });
  it("each network's run rate reproduces the submitted county forecast (D-045)", () => {
    for (const o of outlooks) {
      const fc = research.counties.find((c) => c.fips === o.shelf.county_fips)!.forecast;
      expect(o.households!.yhat / fc.HouseholdsTotal!.yhat! - 1).toBeCloseTo(0, 2);
      expect(o.pounds!.yhat / fc.PoundsTotal!.yhat! - 1).toBeCloseTo(0, 2);
    }
  });
  it("every alert carries an action and a source", () => {
    for (const a of alerts) {
      expect(a.action.length).toBeGreaterThan(5);
      expect(a.source.length).toBeGreaterThan(3);
    }
  });
  it("prioritization puts manager overrides first", () => {
    const pick = net.shelves[40].id;
    const shelves = net.shelves.map((s) => (s.id === pick ? { ...s, priority_status: "urgent" as const } : s));
    const ol = computeAlerts({ shelves, reports: net.reports, asOf: NETWORK_AS_OF }).outlooks;
    expect(prioritize(ol)[0].outlook.shelf.id).toBe(pick);
    expect(outlooks.length).toBe(net.shelves.length);
  });
});

describe("geo", () => {
  it("haversine is about 69 miles per degree of latitude", () => {
    expect(haversineMiles(-94, 45, -94, 46)).toBeCloseTo(69.1, 0);
  });
});
