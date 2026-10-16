// Transparent shelf prioritization: a weighted sum of five 0–1 parts, each shown to the
// manager. The manager's status override always sorts first; the score never moves food
// on its own.

import type { ShelfOutlook } from "./alerts";
import { countiesByFips, equityValue, feiReady } from "./research";
import type { PriorityStatus } from "./types";

export interface PriorityWeights {
  equity: number;
  stock: number;
  demand: number;
  capacity: number;
  reporting: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = { equity: 30, stock: 25, demand: 15, capacity: 15, reporting: 15 };

export const PRIORITY_PARTS: { key: keyof PriorityWeights; label: string; help: string }[] = [
  {
    key: "equity",
    label: feiReady ? "Access equity (FEI)" : "Need screen (Q6 placeholder)",
    help: feiReady
      ? "County FEI ÷ 100. Higher = more barriers between need and the network."
      : "County Q6 need percentile ÷ 100, until FEI lands.",
  },
  { key: "stock", label: "Stock risk", help: "1 − coverage of next month's forecast pounds, floored at 0." },
  { key: "demand", label: "Demand growth", help: "Forecast visits vs the 6-month average; +30% or more scores 1." },
  { key: "capacity", label: "Capacity strain", help: "Upper 80% forecast visits ÷ capacity; 80% scores 0, 120% scores 1." },
  { key: "reporting", label: "Reporting gap", help: "1 when the latest month's report is missing." },
];

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export interface PriorityRow {
  outlook: ShelfOutlook;
  parts: Record<keyof PriorityWeights, number>;
  score: number; // 0–100
  status: PriorityStatus | null;
}

export function prioritize(outlooks: ShelfOutlook[], weights: PriorityWeights = DEFAULT_WEIGHTS): PriorityRow[] {
  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  const statusRank: Record<PriorityStatus, number> = { urgent: 0, support: 1, monitor: 2, stable: 3 };
  return outlooks
    .map((o) => {
      const county = countiesByFips[o.shelf.county_fips];
      const eq = county ? equityValue(county) : null;
      const parts = {
        equity: eq == null ? 0 : clamp(eq / 100),
        stock: o.coverage == null ? 0 : clamp(1 - o.coverage),
        demand: o.growth == null ? 0 : clamp(o.growth / 0.3),
        capacity: o.utilization == null ? 0 : clamp((o.utilization - 0.8) / 0.4),
        reporting: o.overdue ? 1 : 0,
      };
      const score =
        (100 / total) *
        (Object.keys(parts) as (keyof PriorityWeights)[]).reduce((s, k) => s + weights[k] * parts[k], 0);
      return { outlook: o, parts, score, status: o.shelf.priority_status };
    })
    .sort((a, b) => {
      const ra = a.status ? statusRank[a.status] : 4;
      const rb = b.status ? statusRank[b.status] : 4;
      return ra - rb || b.score - a.score;
    });
}
