// Which counties currently carry an open alert, for the county-briefing picker.
// Shelf alerts count toward their county; resolved alerts do not. Network (no fips) alerts do not.

import { SEVERITY_ORDER, type Alert, type Severity } from "./alerts";

export interface CountyAlertRollup {
  fips: string;
  name: string;
  count: number;
  severity: Severity;
  /** Title of the highest-severity open alert. */
  title: string;
}

export function rollupCountyAlerts(
  counties: { fips: string; name: string }[],
  alerts: Pick<Alert, "key" | "fips" | "severity" | "title">[],
  isResolved: (key: string) => boolean,
): CountyAlertRollup[] {
  const names = new Map(counties.map((c) => [c.fips, c.name]));
  const acc = new Map<string, CountyAlertRollup>();
  for (const a of alerts) {
    if (!a.fips || isResolved(a.key)) continue;
    const name = names.get(a.fips);
    if (!name) continue;
    const cur = acc.get(a.fips);
    if (!cur) {
      acc.set(a.fips, { fips: a.fips, name, count: 1, severity: a.severity, title: a.title });
      continue;
    }
    cur.count += 1;
    if (SEVERITY_ORDER[a.severity] < SEVERITY_ORDER[cur.severity]) {
      cur.severity = a.severity;
      cur.title = a.title;
    }
  }
  return [...acc.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.name.localeCompare(b.name),
  );
}
