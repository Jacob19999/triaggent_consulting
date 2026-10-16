import { addMonths } from "../calendar";
import { fmt } from "../format";
import { research } from "../research";

/** Dated context for the user turn: what is already tracked, and the network's latest month
 * (statewide totals from q4_state_month.csv, compared in code, never by the model). */
export function policyWatchTask(asOf: string, today: string): string {
  const last = research.history.find((h) => h.month === research.meta.observed_end);
  const prior = research.history.find((h) => h.month === addMonths(research.meta.observed_end, -12));
  const yoy = (k: "HouseholdsTotal" | "PoundsTotal" | "IndividualsTotal") =>
    last?.[k] != null && prior?.[k] ? fmt.signedPct(last[k]! / prior[k]! - 1, 1) : "n/a";
  const tracked = research.policy
    .map((e) => `- ${e.id} | ${e.start} | ${e.level} | ${e.program} | ${e.name}`)
    .join("\n");
  const q5 = research.findings.sections.find((s) => s.id === "q5")?.lead ?? "";
  return [
    `Today is ${today}. The network's operational data ends ${research.meta.observed_end}; the workspace as-of month is ${asOf}.`,
    `Search window: changes announced or taking effect from ${addMonths(today.slice(0, 7), -6)} through ${addMonths(today.slice(0, 7), 9)}. Newest first.`,
    "",
    `Network context, ${research.meta.observed_end} (statewide broad reporting network; do not restate as a forecast):`,
    `- ${last?.sites ?? "n/a"} reporting sites; visits (HouseholdsReg) ${fmt.int(last?.HouseholdsTotal)} (${yoy("HouseholdsTotal")} vs a year earlier); pounds distributed (PoundsReg) ${fmt.int(last?.PoundsTotal)} (${yoy("PoundsTotal")}); individuals served (IndividualsReg) ${fmt.int(last?.IndividualsTotal)} (${yoy("IndividualsTotal")}).`,
    `- Team finding on SNAP (Q5): ${q5.replace(/\*\*/g, "").slice(0, 600)}`,
    "",
    "Tracked timeline (id | start | level | program | name). Report only what is new about these:",
    tracked,
  ].join("\n");
}
