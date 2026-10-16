import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runTool } from "@/lib/agent/tools";
import { research } from "@/lib/research";

const FORBIDDEN = [/"site_key"/, /"block_geoid"/, /INTPT/i, /"fi_rate"/, /"fi_persons"/, /"cost_per_meal"/, /"child_fi_rate"/, /"sites_in_tract"/, /\/Users\//];

describe("research bundle", () => {
  const files = ["../data/research.json", "../public/data/fei-tracts.json", "../public/data/networks.json"].map((f) => readFileSync(path.join(__dirname, f), "utf8"));
  it("contains no forbidden field or local path", () => {
    for (const text of files) for (const re of FORBIDDEN) expect(re.test(text), String(re)).toBe(false);
  });
  it("has 87 counties and no observed month at or after the forecast target", () => {
    expect(research.counties).toHaveLength(87);
    expect(research.history.every((h) => h.month < research.meta.forecast_target)).toBe(true);
    expect(research.meta.forecast_target).toBe("2026-08");
  });
  it("keeps Wilkin's forecast missing, not zero", () => {
    const w = research.counties.find((c) => c.name === "Wilkin")!;
    expect(w.forecast.PoundsTotal?.yhat).toBeNull();
  });
});

describe("agent tools", () => {
  const snap = { workspace: "demo" as const, asOf: "2026-07", alerts: [] };
  it("county profile names its sources and labels the forecast", () => {
    const p = runTool("get_county_profile", { county: "Chippewa" }, snap) as Record<string, Record<string, unknown>>;
    expect(p.august_2026_forecast.file).toMatch(/q7_august2026_wide/);
    expect(String(p.august_2026_forecast.label)).toMatch(/not an actual/);
  });
  it("policy events carry primary-source URLs", () => {
    const e = runTool("get_policy_events", { from: "2025-01", to: "2026-12" }, snap) as { events: { url: string }[] };
    expect(e.events.length).toBeGreaterThan(3);
    expect(e.events.every((x) => /^https?:\/\//.test(x.url))).toBe(true);
  });
  it("unknown counties return an error instead of a guess", () => {
    expect(runTool("get_county_profile", { county: "Atlantis" }, snap)).toHaveProperty("error");
  });
});
