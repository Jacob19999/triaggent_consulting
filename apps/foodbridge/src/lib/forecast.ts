// Shelf-level next-month forecast. It mirrors the team's submitted county model (D-045):
// the last three monthly working-day rates weighted 1:2:3 toward the latest month, times
// the target month's working days. A missing month drops out with its weight.
// Bands come from the shelf's own one-step-ahead backtest errors (absolute relative error
// quantiles, the D-037 design). With too little history a stated default band is used.

import { addMonths, workdays } from "./calendar";

export interface Point {
  month: string;
  value: number | null;
}

export interface Forecast {
  month: string;
  yhat: number;
  lo80: number;
  hi80: number;
  lo95: number;
  hi95: number;
  method: "recent3_weighted";
  band: "backtest" | "default";
  backtests: number;
  /** Mean absolute percentage error of the one-step backtests (null if none). */
  mape: number | null;
}

const WEIGHTS = [1, 2, 3];
const DEFAULT_BAND = { q80: 0.2, q95: 0.35 };
const MIN_BACKTESTS = 6;

function pointForecast(history: Point[], target: string): number | null {
  // History is ordered; use the three months before the target, by calendar.
  let num = 0;
  let den = 0;
  for (let k = 1; k <= 3; k++) {
    const month = addMonths(target, -k);
    const row = history.find((h) => h.month === month);
    if (!row || row.value == null || !Number.isFinite(row.value)) continue;
    const w = WEIGHTS[3 - k];
    num += w * (row.value / workdays(month));
    den += w;
  }
  if (den === 0) return null;
  return (num / den) * workdays(target);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function forecastNext(history: Point[], target?: string): Forecast | null {
  const ordered = [...history].filter((h) => h.month).sort((a, b) => a.month.localeCompare(b.month));
  if (!ordered.length) return null;
  const month = target ?? addMonths(ordered[ordered.length - 1].month, 1);
  const yhat = pointForecast(ordered, month);
  if (yhat == null) return null;

  // One-step-ahead backtests on the shelf's own history (each uses only earlier months).
  const errors: number[] = [];
  for (const row of ordered) {
    if (row.value == null || row.value <= 0 || row.month >= month) continue;
    const prior = ordered.filter((h) => h.month < row.month);
    if (prior.length < 3) continue;
    const pred = pointForecast(prior, row.month);
    if (pred == null) continue;
    errors.push(Math.abs(pred - row.value) / row.value);
  }
  const sorted = [...errors].sort((a, b) => a - b);
  const useBacktest = sorted.length >= MIN_BACKTESTS;
  const q80 = useBacktest ? quantile(sorted, 0.8) : DEFAULT_BAND.q80;
  const q95 = useBacktest ? Math.max(quantile(sorted, 0.95), q80) : DEFAULT_BAND.q95;
  return {
    month,
    yhat,
    lo80: Math.max(0, yhat * (1 - q80)),
    hi80: yhat * (1 + q80),
    lo95: Math.max(0, yhat * (1 - q95)),
    hi95: yhat * (1 + q95),
    method: "recent3_weighted",
    band: useBacktest ? "backtest" : "default",
    backtests: sorted.length,
    mape: sorted.length ? sorted.reduce((s, e) => s + e, 0) / sorted.length : null,
  };
}

export function trailingMean(history: Point[], before: string, months: number): number | null {
  const values: number[] = [];
  for (let k = 1; k <= months; k++) {
    const row = history.find((h) => h.month === addMonths(before, -k));
    if (row?.value != null && Number.isFinite(row.value)) values.push(row.value);
  }
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
