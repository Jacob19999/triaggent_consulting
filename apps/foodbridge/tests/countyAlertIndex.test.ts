import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeAlerts, SEVERITY_ORDER } from "@/lib/alerts";
import { rollupCountyAlerts } from "@/lib/countyAlertIndex";
import { buildNetworkData, NETWORK_AS_OF, type NetworkPayload } from "@/lib/networks";
import { research } from "@/lib/research";

describe("rollupCountyAlerts", () => {
  const counties = [
    { fips: "1", name: "Aaa" },
    { fips: "2", name: "Bbb" },
  ];

  it("keeps the worst open alert and drops resolved, network, and unknown counties", () => {
    const rows = rollupCountyAlerts(
      counties,
      [
        { key: "a", fips: "1", severity: "info", title: "Info one" },
        { key: "b", fips: "1", severity: "critical", title: "Out of stock" },
        { key: "c", fips: "1", severity: "warning", title: "Warn" },
        { key: "d", fips: "2", severity: "serious", title: "Resolved shelf" },
        { key: "e", fips: undefined, severity: "critical", title: "Network policy" },
        { key: "f", fips: "999", severity: "critical", title: "Not a county" },
      ],
      (key) => key === "d",
    );
    expect(rows).toEqual([{ fips: "1", name: "Aaa", count: 3, severity: "critical", title: "Out of stock" }]);
  });

  it("sorts by severity, then county name", () => {
    const rows = rollupCountyAlerts(
      [
        { fips: "1", name: "Zulu" },
        { fips: "2", name: "Alpha" },
        { fips: "3", name: "Bravo" },
      ],
      [
        { key: "a", fips: "1", severity: "warning", title: "Z" },
        { key: "b", fips: "2", severity: "warning", title: "A" },
        { key: "c", fips: "3", severity: "info", title: "B" },
      ],
      () => false,
    );
    expect(rows.map((r) => r.name)).toEqual(["Alpha", "Zulu", "Bravo"]);
    expect(rows.every((r, i) => i === 0 || SEVERITY_ORDER[rows[i - 1].severity] <= SEVERITY_ORDER[r.severity])).toBe(true);
  });

  it("rolls county-network alerts up to their county", () => {
    const payload = JSON.parse(readFileSync(path.join(__dirname, "../public/data/networks.json"), "utf8")) as NetworkPayload;
    const net = buildNetworkData(payload);
    const { alerts } = computeAlerts({ shelves: net.shelves, reports: net.reports, asOf: NETWORK_AS_OF });
    const rows = rollupCountyAlerts(research.counties, alerts, () => false);
    const shelfAlert = alerts.find((a) => a.scope === "shelf")!;
    const row = rows.find((r) => r.fips === shelfAlert.fips);
    expect(row).toBeDefined();
    expect(SEVERITY_ORDER[row!.severity]).toBeLessThanOrEqual(SEVERITY_ORDER[shelfAlert.severity]);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((r) => r.name === "Wilkin")).toBe(true);
  });
});
