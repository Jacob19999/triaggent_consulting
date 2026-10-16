import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NETWORK_AS_OF, SITE_TYPES, siteTypesFrom, type NetworkPayload } from "@/lib/networks";
import { sitePointsFrom } from "@/lib/sitePoints";

const read = (name: string) => JSON.parse(readFileSync(path.join(__dirname, "../public/data", name), "utf8"));

describe("site points (D-063)", () => {
  const raw = read("sites.json");
  const sites = sitePointsFrom(raw);
  const networks = read("networks.json") as NetworkPayload;

  it("covers the network's reporting sites in the as-of month", () => {
    expect(sites.month).toBe(NETWORK_AS_OF);
    const reporting = networks.counties.reduce((s, c) => s + (c.rows.find((r) => r[0] === NETWORK_AS_OF)?.[1] ?? 0), 0);
    expect(sites.sites).toBe(reporting);
    expect(sites.placed + sites.unplaced).toBe(sites.sites);
    expect(sites.points).toHaveLength(sites.placed);
    expect(sites.points.filter((p) => !p.approx)).toHaveLength(sites.exact);
  });

  it("never places more sites of a type in a county than the type table counts", () => {
    const mix = siteTypesFrom(networks);
    for (const p of sites.points) expect(mix.counties[p.county]?.[p.type]?.sites ?? 0).toBeGreaterThan(0);
    for (const [fips, cells] of Object.entries(mix.counties))
      for (const t of SITE_TYPES) expect(sites.points.filter((p) => p.county === fips && p.type === t).length).toBeLessThanOrEqual(cells[t]?.sites ?? 0);
  });

  it("carries location, type and precision only, inside Minnesota", () => {
    expect(Object.keys(raw.meta)).not.toContain("names");
    for (const rows of Object.values(raw.counties) as number[][][]) for (const r of rows) expect(r).toHaveLength(4);
    expect(sites.points.every((p) => p.lon > -97.3 && p.lon < -89.4 && p.lat > 43.4 && p.lat < 49.5)).toBe(true);
  });
});
