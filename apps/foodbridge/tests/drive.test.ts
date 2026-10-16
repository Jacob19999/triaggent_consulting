import { afterEach, describe, expect, it, vi } from "vitest";
import { driveCandidates, driveReach, loadDriveReach } from "@/lib/drive";
import type { FeiTract } from "@/lib/types";

const tract = (geoid: string, lat: number, extra: Partial<FeiTract> = {}): FeiTract => ({
  geoid,
  county: geoid.slice(0, 5),
  pop: 1000,
  lat,
  lon: -94,
  urban: 0,
  theta: 10,
  d_road: 20,
  min_road: 25,
  beyond_road: 0.5,
  ...extra,
});

describe("driving access", () => {
  const site = { lon: -94, lat: 45 };

  it("only routes tracts the site could serve better by road", () => {
    const near = tract("27001000100", 45.05); // ~3.5 mi straight line, 20 road mi today
    const covered = tract("27001000200", 45.3, { d_road: 2 }); // already 2 road mi from a shelf
    const picked = driveCandidates(site, [covered, near]);
    expect(picked.map((t) => t.geoid)).toEqual(["27001000100"]);
  });

  it("counts residents whose nearest shelf by road becomes the site", () => {
    const a = tract("27001000100", 45.05);
    const b = tract("27001000200", 45.1);
    const reach = driveReach([a, b], { miles: [5, 30], minutes: [8, 35] });
    expect(reach.tractsRouted).toBe(2);
    expect(reach.residentsCloser).toBe(1000); // only a: 5 < 20 road miles
    expect(reach.avgMinutesSaved).toBe(17);
    expect(reach.residentsNewlyWithin).toBe(500); // within θ = 10 road miles × share beyond today
    expect(reach.residentsWithin15Min).toBe(1000);
  });

  it("skips unroutable tracts", () => {
    const reach = driveReach([tract("27001000100", 45.05)], { miles: [null], minutes: [null] });
    expect(reach).toMatchObject({ tractsRouted: 0, residentsCloser: 0, avgMinutesSaved: 0 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("resolves null when routing is offline, so the planner keeps straight-line figures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    await expect(loadDriveReach(site, [tract("27001000100", 45.05)])).resolves.toBeNull();
  });
});
