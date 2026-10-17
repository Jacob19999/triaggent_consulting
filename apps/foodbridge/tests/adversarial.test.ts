import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { clock, SLIDES } from "@/lib/presentation";
import { PRESENTER_DETAILS } from "@/lib/presentationNotes";
import { allocate } from "@/lib/allocate";
import { addMonths, monthDays, workdays } from "@/lib/calendar";
import { forecastNext } from "@/lib/forecast";
import { research } from "@/lib/research";
import { DEFAULT_MONEY, runScenario } from "@/lib/scenario";
import { evaluateSite, forecastNewSite, optimizeSites } from "@/lib/siteModel";
import { shelfOutlook } from "@/lib/alerts";
import type { FeiTractPayload, Shelf, ShelfReport } from "@/lib/types";

describe("forecast adversarial cases", () => {
  it("scales underprediction errors by the prediction, matching the applied interval", () => {
    const history = Array.from({ length: 12 }, (_, i) => {
      const month = addMonths("2024-01", i);
      return { month, value: 2 ** i * workdays(month) };
    });
    const f = forecastNext(history)!;
    expect(f.band).toBe("backtest");
    // For doubling working-day rates, the 1:2:3 rule predicts 17/48 of the next rate.
    expect(f.hi80 / f.yhat).toBeCloseTo(48 / 17, 10);
  });
  it("includes observed zeros and can give a positive upper bound at a zero forecast", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({ month: addMonths("2024-01", i), value: i === 5 ? 100 : 0 }));
    const f = forecastNext(history)!;
    expect(f.backtests).toBe(9);
    expect(f.band).toBe("backtest");
    expect(f.yhat).toBe(0);
    expect(f.hi95).toBeGreaterThan(0);
  });
  it("uses neither target nor future observations in points or calibration", () => {
    const h = Array.from({ length: 12 }, (_, i) => ({ month: addMonths("2024-01", i), value: i * 20 }));
    expect(forecastNext([...h, { month: "2025-01", value: 1e9 }], "2024-11")).toEqual(forecastNext(h, "2024-11"));
  });
  it("observes next year's New Year on December 31", () => {
    expect(workdays("2021-12")).toBe(21);
    expect(monthDays("2021-12").find((d) => d.day === 31)?.work).toBe(false);
  });
});

describe("allocation conservation", () => {
  const counties = research.counties.filter((c) => (c.forecast.PoundsTotal?.yhat ?? 0) > 0 && (c.poverty_persons ?? 0) > 0);
  const ids = counties.map((c) => c.fips);
  it.each([1, 37, 100001])("conserves both the draft and demand comparison for pool %i", (total) => {
    const a = allocate(counties, { total, reserve: 7, ids, needWeight: 35 });
    expect(a.rows.reduce((s, r) => s + r.pounds, 0)).toBe(a.available);
    expect(a.rows.reduce((s, r) => s + r.demandPounds, 0)).toBe(a.available);
    expect(a.rows.reduce((s, r) => s + r.pounds - r.demandPounds, 0)).toBe(0);
  });
  it("reports exactly zero movement for a demand-only draft", () => {
    const a = allocate(counties, { total: 37, reserve: 0, ids, needWeight: 0 });
    expect(a.rows.every((r) => r.pounds === r.demandPounds)).toBe(true);
  });
});

describe("site scenario accounting", () => {
  const c = research.counties.find((c) => c.name === "Chippewa")!;
  const base = { lon: c.centroid![0], lat: c.centroid![1], county: c.fips, type: "brick_and_mortar" as const };
  it("does not infer additional visits or additional food from county associations", () => {
    const e = evaluateSite(base);
    expect(e.forecast.shifted).toBeGreaterThan(0);
    expect(e.forecast.induced).toBe(0);
    expect(e.result.input.additionalPoundsPerMonth).toBe(0);
    expect(e.result.dollars.newFoodValue).toBe(0);
    expect(e.result.poundsPerLowIncomeAfter).toBe(e.result.poundsPerLowIncomeBefore);
  });
  it("makes uplift an explicit sensitivity and retains age coherence", () => {
    const f = forecastNewSite(base.lon, base.lat, base.type, research.tracts, { additionalVisitsPct: 25, additionalSupplyPct: 0 });
    expect(f.induced / f.shifted).toBeCloseTo(0.25, 10);
    expect(f.children + f.adults + f.seniors).toBeCloseTo(f.individuals, 8);
  });
  it("credits avoided trips only for shifted visits and charges additional trips", () => {
    const r = runScenario({ ...base, householdsPerMonth: 150, poundsPerMonth: 1000,
      shiftedVisitsPerMonth: 100, milesSavedPerVisit: 2, newVisitMiles: 3,
      inducedPoundsPerMonth: 400, additionalPoundsPerMonth: 200,
      money: { ...DEFAULT_MONEY.brick_and_mortar, mileageRate: 1, valuePerLb: 1 } }, [], []);
    expect(r.dollars.travelSavings).toBe(100 * 12 * 2 * 2);
    expect(r.dollars.additionalTravelCost).toBe(50 * 12 * 2 * 3);
    expect(r.dollars.newFoodValue).toBe(200 * 12);
    expect(r.dollars.netNewValue).toBe(3600);
  });
  it("does not fabricate service or unit costs for a zero-sized site", () => {
    const r = runScenario({ ...base, householdsPerMonth: 0, poundsPerMonth: 0, money: DEFAULT_MONEY.brick_and_mortar });
    expect(r.residentsNewlyWithin).toBe(0);
    expect(r.dollars.costPerMeal).toBeNull();
    expect(r.dollars.costPerVisit).toBeNull();
  });
  it("preserves published top-quintile membership for a no-op, including rounded ties", () => {
    const tracts = (JSON.parse(readFileSync(path.join(__dirname, "../public/data/fei-tracts.json"), "utf8")) as FeiTractPayload).tracts;
    const r = runScenario({ ...base, householdsPerMonth: 0, poundsPerMonth: 0, money: DEFAULT_MONEY.brick_and_mortar }, tracts);
    expect(r.fei.status).toBe("ready");
    expect(r.fei.topQuintileResidentsAfter).toBe(r.fei.topQuintileResidentsBefore);
    expect(r.fei.stateAfter).toBe(r.fei.stateBefore);
  });
  it("includes supply-only FEI improvements in the map effects", () => {
    const tracts = (JSON.parse(readFileSync(path.join(__dirname, "../public/data/fei-tracts.json"), "utf8")) as FeiTractPayload).tracts;
    const r = runScenario({ ...base, householdsPerMonth: 100, poundsPerMonth: 10000,
      additionalPoundsPerMonth: 10000, money: DEFAULT_MONEY.brick_and_mortar }, tracts);
    const improved = r.affected.filter((t) => t.feiAfter != null && t.feiBefore != null && t.feiAfter < t.feiBefore);
    expect(improved.length).toBe(r.fei.tractsImproved);
    expect(improved.some((t) => t.milesBefore === t.milesAfter)).toBe(true);
  });
  it("rejects invalid budget denominators", () => {
    expect(() => evaluateSite({ ...base, money: { ...DEFAULT_MONEY.brick_and_mortar, lbPerMeal: 0 } })).toThrow("greater than zero");
  });
  it("does not silently rank by reach when FEI is unavailable", async () => {
    await expect(optimizeSites({ objective: "fei", type: base.type, feiTracts: [] })).rejects.toThrow("FEI");
  });
  it("uses manual sizing for the ranking as well as the selected option", async () => {
    const picks = await optimizeSites({ objective: "reach", type: base.type, feiTracts: [], counties: [c.fips], count: 1, manual: { visits: 17, pounds: 123 } });
    expect(picks).toHaveLength(1);
    expect(picks[0].evaluation.result.input.householdsPerMonth).toBe(17);
    expect(picks[0].evaluation.result.input.poundsPerMonth).toBe(123);
  });
});

describe("stock missingness", () => {
  const shelf = { id: "test", active: true } as Shelf;
  const report = { shelf_id: "test", month: "2026-07", households: 10, individuals: 20, pounds_distributed: 100, inventory_lbs: 50, pounds_received: null } as ShelfReport;
  it("does not treat unknown receipts as zero", () => {
    expect(shelfOutlook(shelf, [report], "2026-07").available).toBeNull();
  });
  it("does not treat stale inventory as current", () => {
    const o = shelfOutlook(shelf, [{ ...report, month: "2026-06", pounds_received: 10 }], "2026-07");
    expect(o.available).toBeNull();
    expect(o.daysOfSupply).toBeNull();
  });
});


describe("presenter rehearsal support", () => {
  it("covers every current slide without relying on old PDF slide numbers", () => {
    expect(Object.keys(PRESENTER_DETAILS).sort()).toEqual(SLIDES.map((s) => s.id).sort());
    for (const s of SLIDES) {
      expect(PRESENTER_DETAILS[s.id].explain.length).toBeGreaterThanOrEqual(2);
      expect(s.qa.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("rolls a rounded talk-clock minute over without showing :60", () => {
    expect(clock(59.6)).toBe("1:00");
    expect(clock(119.7)).toBe("2:00");
  });
});
