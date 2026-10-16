"use client";

import { useMemo, useState } from "react";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";

export interface SeriesPoint {
  month: string;
  value: number | null;
}

export interface ForecastBand {
  month: string;
  yhat: number;
  lo80: number;
  hi80: number;
  lo95: number;
  hi95: number;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** One series over time (one axis, never two), with an optional forecast fan at the end. */
export function TimeChart({
  points,
  forecast,
  color = "var(--sig-households)",
  label,
  height = 220,
  format = fmt.compact,
}: {
  points: SeriesPoint[];
  forecast?: ForecastBand | null;
  color?: string;
  label: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const W = 640;
  const H = height;
  const m = { l: 48, r: 14, t: 12, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const all = useMemo(() => {
    const rows = points.map((p) => ({ ...p, forecast: false as boolean }));
    if (forecast) rows.push({ month: forecast.month, value: forecast.yhat, forecast: true });
    return rows;
  }, [points, forecast]);
  const max = niceMax(
    Math.max(1, ...all.map((p) => p.value ?? 0), forecast ? forecast.hi95 : 0),
  );
  const x = (i: number) => m.l + (i * (W - m.l - m.r)) / Math.max(1, all.length - 1);
  const y = (v: number) => m.t + (1 - v / max) * (H - m.t - m.b);
  const observed = all.filter((p) => !p.forecast);
  let line = "";
  observed.forEach((p, i) => {
    if (p.value == null) return;
    line += `${line && observed[i - 1]?.value != null ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(all.length / 7);
  const fi = all.length - 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label} by month`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - m.l) / (W - m.l - m.r)) * Math.max(1, all.length - 1));
          setHover(Math.max(0, Math.min(all.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--muted)" className="tabular">
              {format(t)}
            </text>
          </g>
        ))}
        {all.map((p, i) =>
          i === fi || (i % labelEvery === 0 && fi - i >= Math.ceil(labelEvery * 0.6)) ? (
            <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
              {monthLabel(p.month)}
            </text>
          ) : null,
        )}
        {forecast && (
          <g>
            <line x1={x(fi - 1)} x2={x(fi)} y1={y(observed[observed.length - 1]?.value ?? forecast.yhat)} y2={y(forecast.yhat)} stroke={color} strokeWidth={2} strokeDasharray="4 3" />
            <rect x={x(fi) - 9} width={18} y={y(forecast.hi95)} height={Math.max(1, y(forecast.lo95) - y(forecast.hi95))} rx={4} fill={color} opacity={0.16} />
            <rect x={x(fi) - 9} width={18} y={y(forecast.hi80)} height={Math.max(1, y(forecast.lo80) - y(forecast.hi80))} rx={4} fill={color} opacity={0.32} />
            <circle cx={x(fi)} cy={y(forecast.yhat)} r={5} fill="var(--surface)" stroke={color} strokeWidth={2} />
          </g>
        )}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 2" />
            {all[hover].value != null && <circle cx={x(hover)} cy={y(all[hover].value!)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > all.length / 2 ? "translateX(-105%)" : "translateX(8px)" }}
        >
          <div className="font-semibold text-ink">
            {monthLabel(all[hover].month, "long")}
            {all[hover].forecast && <span className="ml-1 text-[10px] font-semibold text-muted">FORECAST</span>}
          </div>
          <div className="tabular text-ink-2">
            {label}: <span className="font-semibold text-ink">{all[hover].value == null ? "—" : fmt.int(all[hover].value!)}</span>
          </div>
          {all[hover].forecast && forecast && (
            <div className="tabular text-muted">
              80%: {fmt.int(forecast.lo80)}–{fmt.int(forecast.hi80)} · 95%: {fmt.int(forecast.lo95)}–{fmt.int(forecast.hi95)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface StackPart {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Horizontal stacked bar with a 2px surface gap between segments and a direct legend. */
export function StackedBar({
  parts,
  total,
  height = 14,
  format = (v: number) => fmt.num(v, 1),
}: {
  parts: StackPart[];
  total?: number;
  height?: number;
  format?: (v: number) => string;
}) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex w-full gap-[2px] overflow-hidden rounded" style={{ height }}>
        {parts.map((p) => (
          <div
            key={p.key}
            title={`${p.label}: ${format(p.value)}`}
            style={{ width: `${sum ? (p.value / sum) * 100 : 0}%`, background: p.color }}
            className="first:rounded-l last:rounded-r"
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-2">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label} <span className="tabular font-semibold text-ink">{format(p.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars; one color, values labelled in text ink. */
export function BarList({
  rows,
  color = "var(--seq-3)",
  format = (v: number) => fmt.num(v, 0),
  max,
  onSelect,
}: {
  rows: { key: string; label: string; value: number | null; note?: string }[];
  color?: string;
  format?: (v: number) => string;
  max?: number;
  onSelect?: (key: string) => void;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            onClick={() => onSelect?.(r.key)}
            className="group grid w-full grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-surface-2"
          >
            <span className="truncate text-[13px] text-ink">{r.label}</span>
            <span className="h-2.5 rounded-r bg-surface-2">
              <span className="block h-full rounded-r" style={{ width: `${((r.value ?? 0) / top) * 100}%`, background: color }} />
            </span>
            <span className="tabular min-w-[48px] text-right text-[12.5px] font-semibold text-ink">
              {r.value == null ? "—" : format(r.value)}
            </span>
          </button>
          {r.note && <p className="pl-1 text-[11.5px] text-muted">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Pillar breakdown as bars on a 0–1 scale, one row per pillar (BEI dashboard style). */
export function PillarBars({
  rows,
}: {
  rows: { key: string; label: string; value: number | null | undefined; color: string; weight?: number }[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[92px_1fr_40px] items-center gap-2.5 text-[12.5px]">
          <span className="flex items-center gap-1.5 truncate text-ink-2">
            <span className="grid h-4 w-4 place-items-center rounded text-[9.5px] font-bold text-white" style={{ background: r.color }}>
              {r.key}
            </span>
            {r.label}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(1, r.value ?? 0)) * 100}%`, background: r.color }}
            />
          </span>
          <span className="tabular text-right font-semibold text-ink">{r.value == null ? "—" : fmt.num(r.value, 2)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Radar of 0–1 pillar scores. An optional comparison polygon (e.g. the state median) is drawn as a dashed outline. */
export function Radar({
  axes,
  values,
  compare,
  compareLabel,
  color = "var(--accent)",
  size = 220,
}: {
  axes: { key: string; label: string }[];
  values: (number | null | undefined)[];
  compare?: (number | null | undefined)[];
  compareLabel?: string;
  color?: string;
  size?: number;
}) {
  const c = size / 2;
  const R = size / 2 - 30;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v] as const;
  };
  const poly = (vals: (number | null | undefined)[]) =>
    vals.map((v, i) => pt(i, Math.max(0, Math.min(1, v ?? 0))).map((x) => x.toFixed(1)).join(",")).join(" ");
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox={`-34 -4 ${size + 68} ${size + 8}`} className="h-auto w-full max-w-[300px]" role="img" aria-label="Pillar radar chart">
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon key={r} points={poly(axes.map(() => r))} fill="none" stroke="var(--line)" strokeWidth={1} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.18);
          return (
            <g key={a.key}>
              <line x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--ink-2)">
                {a.label}
              </text>
            </g>
          );
        })}
        {compare && <polygon points={poly(compare)} fill="none" stroke="var(--muted)" strokeWidth={1.4} strokeDasharray="4 3" />}
        <polygon points={poly(values)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {values.map((v, i) => {
          const [x, y] = pt(i, Math.max(0, Math.min(1, v ?? 0)));
          return <circle key={i} cx={x} cy={y} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={1.5} />;
        })}
      </svg>
      {compare && compareLabel && (
        <figcaption className="mt-1 flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: color }} /> This area
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 border-t border-dashed border-[var(--muted)]" /> {compareLabel}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
