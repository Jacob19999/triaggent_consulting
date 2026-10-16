// Deterministic briefing used when no model key is configured or the model call fails.
// It assembles the same retrieved facts without any language model.

import { monthLabel } from "../calendar";
import { runTool, type SnapshotT } from "./tools";

type Events = { events: { name: string; program: string; effective: string; expected_direction: string; url: string; source: string }[] };
type Alerts = { alerts: { severity: string; title: string; where?: string; action: string }[] };

export function offlineBriefing(mode: string, snap: SnapshotT, county?: string): string {
  const lines: string[] = [];
  const events = [...(runTool("get_policy_events", {}, snap) as Events).events].sort((a, b) =>
    b.effective.localeCompare(a.effective),
  );
  const alerts = (runTool("get_alerts", { min_severity: "warning" }, snap) as Alerts).alerts;
  lines.push(`## Headline`);
  lines.push(
    `Offline briefing for ${monthLabel(snap.asOf, "long")} (no AI model is configured, so this lists the facts without commentary).`,
  );
  if (mode === "county" && county) {
    const p = runTool("get_county_profile", { county }, snap) as Record<string, unknown>;
    if (!("error" in p)) {
      lines.push(`## ${String(p.county)} County`);
      lines.push("```json\n" + JSON.stringify({ fei: p.fei, q6: p.q6, access: p.access }, null, 2) + "\n```");
    }
  }
  if (snap.shelf && mode === "shelf") {
    const s = snap.shelf;
    lines.push(`## Your shelf`);
    lines.push(
      `- ${s.name} (${s.county}). Forecast for ${s.forecastMonth}: ${s.forecastVisits ?? "—"} visits (80% band ${s.forecastVisitsBand ?? "—"}), ${s.forecastPounds ?? "—"} lb (80% band ${s.forecastPoundsBand ?? "—"}) [FoodBridge forecast].`,
    );
  }
  lines.push(`## Policy events near ${monthLabel(snap.asOf)}`);
  if (events.length) for (const e of events.slice(0, 8)) lines.push(`- **${e.effective}** · ${e.program}: ${e.name}. Expected: ${e.expected_direction} [${e.source}](${e.url})`);
  else lines.push("- None in the window.");
  lines.push(`## Alerts to act on`);
  if (alerts.length) for (const a of alerts.slice(0, 10)) lines.push(`- **${a.severity}** · ${a.where ? `${a.where}: ` : ""}${a.title}. Next step: ${a.action}`);
  else lines.push("- No warning-level alerts.");
  lines.push(`## Sources`);
  lines.push("- docs/reference/policy_events.csv · FoodBridge alert rules · outputs/ research tables");
  return lines.join("\n");
}
