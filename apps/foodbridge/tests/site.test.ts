import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { research } from "@/lib/research";
import { countyRates, distanceAssociation, evaluateSite, forecastNewSite, optimizeSites, TYPE_REACH } from "@/lib/siteModel";
import type { FeiTractPayload } from "@/lib/types";

const feiTracts = (): FeiTractPayload["tracts"] =>
  research.fei.status === "ready"
    ? (JSON.parse(readFileSync(path.join(__dirname, "../public/data/fei-tracts.json"), "utf8")) as FeiTractPayload).tracts
    : [];

describe("site forecast", () => {
  const chippewa = research.counties.find((c) => c.name === "Chippewa")!;
  it("farther counties record fewer visits per low-income resident (sign of the association)", () => {
    const a = distanceAssociation();
    expect(a.n).toBeGreaterThan(50);
    expect(a.perMile).toBeLessThan(0);
  });
  it("uses the county's own forecast ratios, and the state's for Wilkin", () => {
    expect(countyRates(chippewa.fips).fromState).toBe(false);
    const wilkin = research.counties.find((c) => c.name === "Wilkin")!;
    expect(countyRates(wilkin.fips).fromState).toBe(true);
  });
  it("splits visits into shifted and induced, and ages add up to individuals", () => {
    const f = forecastNewSite(chippewa.centroid![0], chippewa.centroid![1], "brick_and_mortar");
    expect(f.visits).toBeGreaterThan(0);
    expect(f.visits).toBeCloseTo(f.shifted + f.induced, 6);
    expect(f.induced).toBeLessThanOrEqual(f.shifted * 0.5 + 1e-9);
    expect(f.children + f.adults + f.seniors).toBeCloseTo(f.individuals, 6);
    expect(f.visitsLo).toBeLessThanOrEqual(f.visits);
    expect(f.visitsHi).toBeGreaterThanOrEqual(f.visits);
  });
  it("a mobile stop reaches a fixed share of a brick-and-mortar shelf", () => {
    const [x, y] = chippewa.centroid!;
    const b = forecastNewSite(x, y, "brick_and_mortar");
    const m = forecastNewSite(x, y, "mobile");
    expect(m.visits / b.visits).toBeCloseTo(TYPE_REACH.mobile, 6);
  });
  it("evaluates a site end to end with non-negative new value", () => {
    const e = evaluateSite({ lon: chippewa.centroid![0], lat: chippewa.centroid![1], county: chippewa.fips, type: "brick_and_mortar", feiTracts: feiTracts() });
    expect(e.result.dollars.travelSavings).toBeGreaterThanOrEqual(0);
    expect(e.result.dollars.newFoodValue).toBeGreaterThanOrEqual(0);
    expect(e.result.lowIncomeNewlyWithin).toBeLessThanOrEqual(e.result.residentsNewlyWithin);
  });
});

describe("optimal sites", () => {
  it("returns spaced, ranked candidates inside the chosen counties", async () => {
    const counties = research.counties.filter((c) => c.robust).map((c) => c.fips);
    const t0 = Date.now();
    const picks = await optimizeSites({ objective: "reach", type: "brick_and_mortar", feiTracts: feiTracts(), counties, count: 3, spacingMiles: 10 });
    expect(Date.now() - t0).toBeLessThan(20000);
    expect(picks.length).toBeGreaterThan(0);
    for (let i = 1; i < picks.length; i++) expect(picks[i - 1].score).toBeGreaterThanOrEqual(picks[i].score);
    for (const p of picks) expect(counties).toContain(p.county);
  });
  it("statewide FEI search finishes and never raises FEI", async () => {
    const t0 = Date.now();
    const picks = await optimizeSites({ objective: "fei", type: "brick_and_mortar", feiTracts: feiTracts(), count: 5 });
    const ms = Date.now() - t0;
    console.log(`statewide FEI search: ${ms} ms, top county ${picks[0]?.county}, score ${picks[0]?.score}`);
    expect(picks.length).toBe(5);
    for (const p of picks) {
      const fei = p.evaluation.result.fei;
      if (fei.status === "ready") expect(fei.stateAfter!).toBeLessThanOrEqual(fei.stateBefore! + 1e-9);
    }
  }, 60000);
});
