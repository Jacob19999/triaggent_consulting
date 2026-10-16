"use client";

// Visuals for the judging deck (/present). Each one is read in a glance by a generalist judge:
// plain words on the chart, direct labels instead of legends, and motion only where it carries
// the point (dots that move when a measure changes, bars that grow, a line that draws).

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { cx, Icon } from "../ui";

/* ------------------------------------------------------------------ utilities */

export function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Animates from the last shown value to the new one (from 0 on first show). */
export function useCountUp(target: number | null | undefined, ms = 1000): number | null {
  const shown = useRef(0);
  const [v, setV] = useState<number | null>(target == null ? null : 0);
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) {
      setV(null);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      shown.current = target;
      setV(target);
      return;
    }
    const from = shown.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const val = from + (target - from) * (1 - (1 - k) ** 3);
      shown.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function CountUp({ value, format = fmt.int, ms }: { value: number | null | undefined; format?: (v: number) => string; ms?: number }) {
  const v = useCountUp(value, ms);
  return <span className="tabular">{v == null ? "—" : format(v)}</span>;
}

/** Rounds a span to 1, 2 or 5 × 10^k so axis ticks read cleanly. */
export function niceStep(span: number, target = 4): number {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * mag;
}

export function linearTicks(lo: number, hi: number, format: (v: number) => string, target = 4) {
  const step = niceStep(hi - lo, target);
  const out: { v: number; label: string }[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push({ v, label: format(v) });
  return out;
}

/* ------------------------------------------------------------------ step tabs */

/** The slide's build steps; → on the keyboard walks them before the next slide. */
export function StepTabs({ steps, step, onStep }: { steps: string[]; step: number; onStep: (i: number) => void }) {
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Story steps">
      {steps.map((s, i) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={i === step}
          onClick={() => onStep(i)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors",
            i === step ? "bg-accent text-[var(--accent-ink)]" : i < step ? "text-ink hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          <span
            className={cx(
              "tabular grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-bold",
              i === step ? "bg-black/15" : i < step ? "bg-[var(--accent-soft)] text-accent" : "bg-surface-3",
            )}
          >
            {i < step ? "✓" : i + 1}
          </span>
          {s}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ agreement meter */

export interface MeterRow {
  label: string;
  value: number | null | undefined;
  color: string;
}

/** Rank correlations as positions on a −1…+1 track a generalist can read: none in the middle. */
export function AgreementMeter({ rows, scaleWords = ["opposite", "none", "same direction"] }: { rows: MeterRow[]; scaleWords?: [string, string, string] }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3">
      {rows.map((r) => {
        const v = r.value ?? 0;
        const pos = ((Math.max(-1, Math.min(1, v)) + 1) / 2) * 100;
        return (
          <div key={r.label} className="contents">
            <span className="text-[15px] font-semibold text-ink">{r.label}</span>
            <div className="relative h-8">
              <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-surface-3" />
              <div className="absolute top-1/2 h-5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded bg-line-strong" style={{ left: "50%" }} />
              <div
                className="fb-slide-x absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full"
                style={{ left: `${Math.min(50, pos)}%`, width: `${Math.abs(pos - 50)}%`, background: r.color, opacity: 0.6 }}
              />
              <div
                className="fb-slide-x absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_3px_var(--surface)]"
                style={{ left: `${pos}%`, background: r.color }}
              />
            </div>
            <span className="tabular w-[58px] text-right text-[20px] font-semibold text-ink">
              <CountUp value={r.value} format={(x) => (x > 0.005 ? "+" : x < -0.005 ? "−" : "") + Math.abs(x).toFixed(2)} ms={900} />
            </span>
          </div>
        );
      })}
      <span />
      <div className="flex justify-between text-[11.5px] font-medium text-muted">
        <span>−1 {scaleWords[0]}</span>
        <span>0 {scaleWords[1]}</span>
        <span>+1 {scaleWords[2]}</span>
      </div>
      <span />
    </div>
  );
}

/* ------------------------------------------------------------------ scatter */

export interface Axis {
  domain: [number, number];
  log?: boolean;
  ticks: { v: number; label: string }[];
  title: string;
}

export interface ScatterPoint {
  id: string;
  x: number | null | undefined;
  y: number | null | undefined;
  label?: string;
  tone?: "base" | "hot" | "dim";
  title?: string;
}

const unit = (a: Axis) => (v: number) => {
  const [d0, d1] = a.domain;
  const t = a.log
    ? (Math.log10(Math.max(v, d0)) - Math.log10(d0)) / (Math.log10(d1) - Math.log10(d0))
    : (v - d0) / (d1 - d0);
  return Math.max(0, Math.min(1, t));
};

/** One dot per county; when an axis changes, the dots travel to their new place. */
export function Scatter({
  points,
  x,
  y,
  trend,
  color = "var(--accent)",
  ariaLabel,
  children,
}: {
  points: ScatterPoint[];
  x: Axis;
  y: Axis;
  /** Straight trend line from [x0, y0] to [x1, y1] in data units. */
  trend?: [[number, number], [number, number]] | null;
  color?: string;
  ariaLabel: string;
  children?: ReactNode;
}) {
  const [ref, size] = useBoxSize<HTMLDivElement>();
  const ux = unit(x);
  const uy = unit(y);
  const pad = { l: 58, r: 20, t: 30, b: 40 };
  const pw = Math.max(1, size.w - pad.l - pad.r);
  const ph = Math.max(1, size.h - pad.t - pad.b);
  const placed = points
    .filter((p) => p.x != null && p.y != null && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p, i) => ({ ...p, i, px: pad.l + ux(p.x!) * pw, py: pad.t + (1 - uy(p.y!)) * ph }));

  // Direct labels, nudged apart so they never sit on top of each other.
  const labelled = placed.filter((p) => p.label).sort((a, b) => a.py - b.py);
  const spots: { id: string; x: number; y: number; left: boolean; text: string }[] = [];
  for (const p of labelled) {
    const left = p.px > pad.l + pw * 0.7;
    let ly = p.py;
    for (let guard = 0; guard < 20; guard++) {
      const clash = spots.find((s) => s.left === left && Math.abs(s.x - p.px) < 150 && Math.abs(s.y - ly) < 17);
      if (!clash) break;
      ly = clash.y + 17;
    }
    if (ly > pad.t + ph) continue;
    spots.push({ id: p.id, x: p.px, y: ly, left, text: p.label! });
  }

  return (
    <div ref={ref} className="relative h-full w-full select-none" role="img" aria-label={ariaLabel}>
      {size.w > 0 && (
        <>
          <div className="absolute text-[12.5px] font-semibold text-ink-2" style={{ left: pad.l, top: 2 }}>
            ↑ {y.title}
          </div>
          {y.ticks.map((t) => {
            const ty = pad.t + (1 - uy(t.v)) * ph;
            return (
              <div key={`y${t.v}`} className="fb-slide-x">
                <div className="absolute h-px bg-line transition-[top] duration-700" style={{ left: pad.l, right: pad.r, top: ty }} />
                <span className="tabular absolute -translate-y-1/2 text-right text-[12px] text-muted transition-[top] duration-700" style={{ right: size.w - pad.l + 8, top: ty }}>
                  {t.label}
                </span>
              </div>
            );
          })}
          {x.ticks.map((t) => {
            const tx = pad.l + ux(t.v) * pw;
            return (
              <div key={`x${t.v}`}>
                <div className="absolute w-px bg-line" style={{ left: tx, top: pad.t, height: ph }} />
                <span className="tabular absolute -translate-x-1/2 text-[12px] text-muted" style={{ left: tx, top: pad.t + ph + 6 }}>
                  {t.label}
                </span>
              </div>
            );
          })}
          <div className="absolute text-right text-[12.5px] font-semibold text-ink-2" style={{ right: pad.r, bottom: 0 }}>
            {x.title} →
          </div>
          {trend && (
            <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h} aria-hidden>
              <line
                key={`${trend[0][0]}-${trend[1][0]}`}
                className="fb-draw"
                pathLength={1}
                x1={pad.l + ux(trend[0][0]) * pw}
                y1={pad.t + (1 - uy(trend[0][1])) * ph}
                x2={pad.l + ux(trend[1][0]) * pw}
                y2={pad.t + (1 - uy(trend[1][1])) * ph}
                stroke="var(--ink-2)"
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.65}
              />
            </svg>
          )}
          {placed.map((p) => {
            const s = p.tone === "hot" ? 15 : 11;
            return (
              <div
                key={p.id}
                title={p.title}
                className="fb-dot absolute rounded-full"
                style={{
                  left: p.px,
                  top: p.py,
                  width: s,
                  height: s,
                  marginLeft: -s / 2,
                  marginTop: -s / 2,
                  background: p.tone === "hot" ? "var(--hot)" : color,
                  opacity: p.tone === "dim" ? 0.18 : p.tone === "hot" ? 1 : 0.8,
                  boxShadow: p.tone === "hot" ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--hot)" : "0 0 0 1px var(--surface)",
                  animationDelay: `${(p.i % 60) * 9}ms`,
                  zIndex: p.tone === "hot" ? 2 : 1,
                }}
              />
            );
          })}
          {spots.map((s) => (
            <span
              key={`l-${s.id}`}
              className="fb-dot pointer-events-none absolute z-[3] whitespace-nowrap text-[12.5px] font-semibold text-ink"
              style={{
                left: s.left ? s.x - 10 : s.x + 10,
                top: s.y,
                transform: `translate(${s.left ? "-100%" : "0"}, -50%)`,
                textShadow: "0 0 3px var(--paper), 0 0 6px var(--paper)",
                animation: "none",
              }}
            >
              {s.text}
            </span>
          ))}
          {children}
        </>
      )}
    </div>
  );
}

/** Least-squares line over the points, for a visual trend only (the statistic is a rank correlation). */
export function fitLine(pts: { x: number; y: number }[], x0: number, x1: number): [[number, number], [number, number]] | null {
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  return [
    [x0, my + b * (x0 - mx)],
    [x1, my + b * (x1 - mx)],
  ];
}

/* ------------------------------------------------------------------ bars */

export interface BarRow {
  label: ReactNode;
  value: number;
  color: string;
  strong?: boolean;
}

/** Horizontal bars that grow in; the value sits at the end of each bar. */
export function CompareBars({ rows, max, format, delay = 0, compact }: { rows: BarRow[]; max?: number; format: (v: number) => string; delay?: number; compact?: boolean }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[minmax(120px,170px)_1fr] items-center gap-3">
          <span className={cx("text-[14px] leading-tight", r.strong ? "font-semibold text-ink" : "text-ink-2")}>{r.label}</span>
          <span className="flex items-center gap-2">
            <span
              className={cx("fb-grow-x block rounded-md", compact ? "h-[16px]" : "h-[22px]")}
              style={{ width: `${Math.max(2, (r.value / top) * 82)}%`, background: r.color, animationDelay: `${delay + i * 120}ms` }}
            />
            <span className={cx("tabular fb-rise text-[17px]", r.strong ? "font-bold text-ink" : "font-semibold text-ink-2")} style={{ animationDelay: `${delay + i * 120 + 500}ms` }}>
              {format(r.value)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ verdicts */

export type VerdictTone = "clear" | "borderline" | "unclear";

const VERDICT_STYLE: Record<VerdictTone, { bg: string; fg: string; mark: string; word: string }> = {
  clear: { bg: "var(--accent)", fg: "var(--accent-ink)", mark: "✓", word: "Clear" },
  borderline: { bg: "var(--hot)", fg: "#1b1200", mark: "~", word: "Borderline" },
  unclear: { bg: "var(--surface-3)", fg: "var(--muted)", mark: "–", word: "No clear link" },
};

/** One plain-language finding: an icon for how sure we are, the effect in words, the range in small type. */
export function Verdict({ tone, label, text, detail, style }: { tone: VerdictTone; label: string; text: ReactNode; detail?: ReactNode; style?: CSSProperties }) {
  const v = VERDICT_STYLE[tone];
  return (
    <div className="fb-rise flex items-start gap-3" style={style}>
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px] font-bold" style={{ background: v.bg, color: v.fg }} aria-label={v.word}>
        {v.mark}
      </span>
      <span className="min-w-0">
        <span className="block text-[15.5px] leading-snug text-ink">
          <b>{label}:</b> {text}
        </span>
        {detail && <span className="tabular mt-0.5 block text-[12.5px] text-muted">{detail}</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ line with events */

export interface StoryEvent {
  month: string;
  title: string;
  sub: string;
}

/** Monthly line that draws in, with pinned events and an optional forecast point. */
export function LineStory({
  points,
  events = [],
  forecast,
  format,
  color = "var(--sig-households)",
  eventDelay = 1200,
  showEvents = true,
  ariaLabel,
}: {
  points: { month: string; value: number | null }[];
  events?: StoryEvent[];
  forecast?: { month: string; value: number; label: ReactNode };
  format: (v: number) => string;
  color?: string;
  /** Milliseconds before event pins appear (long enough for the line to draw on first show). */
  eventDelay?: number;
  /** Space for the pins is always reserved, so revealing them does not rescale the line. */
  showEvents?: boolean;
  ariaLabel: string;
}) {
  const id = useId().replace(/:/g, "");
  const [ref, size] = useBoxSize<HTMLDivElement>();
  const months = [...points.map((p) => p.month), ...(forecast ? [forecast.month] : [])];
  const vals = [...points.map((p) => p.value), forecast?.value].filter((v): v is number => v != null && Number.isFinite(v));
  const step = niceStep(Math.max(...vals) - Math.min(...vals), 3);
  const lo = Math.max(0, Math.floor((Math.min(...vals) * 0.92) / step) * step);
  const hi = Math.ceil((Math.max(...vals) * 1.04) / step) * step;
  const pad = { l: 58, r: forecast ? 150 : 20, t: events.length > 1 ? 104 : events.length ? 60 : 14, b: 28 };
  const pw = Math.max(1, size.w - pad.l - pad.r);
  const ph = Math.max(1, size.h - pad.t - pad.b);
  const X = (i: number) => pad.l + (months.length > 1 ? i / (months.length - 1) : 0) * pw;
  const Y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * ph;
  const pts = points.map((p, i) => (p.value == null ? null : ([X(i), Y(p.value)] as const)));
  let d = "";
  pts.forEach((p, i) => {
    if (!p) return;
    d += `${d && pts[i - 1] ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  });
  const first = pts.find(Boolean);
  const last = [...pts].reverse().find(Boolean);
  const area = first && last ? `${d}L${last[0].toFixed(1)},${pad.t + ph}L${first[0].toFixed(1)},${pad.t + ph}Z` : "";
  const ticks = linearTicks(lo, hi, format, 3);
  const years = months.map((m, i) => ({ m, i })).filter(({ m, i }) => m.endsWith("-01") || i === 0);

  return (
    <div ref={ref} className="relative h-full w-full" role="img" aria-label={ariaLabel}>
      {size.w > 0 && (
        <>
          {ticks.map((t) => (
            <div key={t.v}>
              <div className="absolute h-px bg-line" style={{ left: pad.l, right: pad.r, top: Y(t.v) }} />
              <span className="tabular absolute -translate-y-1/2 text-right text-[12px] text-muted" style={{ right: size.w - pad.l + 8, top: Y(t.v) }}>
                {t.label}
              </span>
            </div>
          ))}
          {years.map(({ m, i }) => (
            <span key={m} className="tabular absolute text-[12px] text-muted" style={{ left: X(i), top: pad.t + ph + 7 }}>
              {m.slice(0, 4)}
            </span>
          ))}
          <svg className="absolute left-0 top-0" width={size.w} height={size.h} aria-hidden>
            <defs>
              <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={0.28} />
                <stop offset="1" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <g className="fb-reveal-x">
              <path d={area} fill={`url(#g${id})`} />
              <path d={d} fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
            </g>
            {forecast && last && (
              <line
                x1={last[0]}
                y1={last[1]}
                x2={X(months.length - 1)}
                y2={Y(forecast.value)}
                stroke="var(--accent)"
                strokeWidth={2.6}
                strokeDasharray="5 5"
                className="fb-rise"
                style={{ animationDelay: "1.5s" }}
              />
            )}
            {(showEvents ? events : []).map((e) => {
              const i = months.indexOf(e.month);
              const v = points[i]?.value;
              if (i < 0 || v == null) return null;
              return <line key={e.month} x1={X(i)} x2={X(i)} y1={pad.t - 6} y2={pad.t + ph} stroke="var(--hot)" strokeWidth={1.5} strokeDasharray="3 4" />;
            })}
          </svg>
          {(showEvents ? events : []).map((e, k) => {
            const i = months.indexOf(e.month);
            const v = points[i]?.value;
            if (i < 0 || v == null) return null;
            const x = X(i);
            const shift = x < size.w * 0.45 ? "-12%" : "-88%";
            return (
              <div key={e.month}>
                <span
                  className="fb-dot absolute h-3.5 w-3.5 rounded-full shadow-[0_0_0_3px_var(--surface)]"
                  style={{ left: x, top: Y(v), marginLeft: -7, marginTop: -7, background: "var(--hot)", animationDelay: `${eventDelay + k * 250}ms`, zIndex: 2 }}
                />
                <div className="absolute" style={{ left: x, top: (k % 2) * 48, transform: `translateX(${shift})` }}>
                  <div
                    className="fb-rise rounded-lg border border-[var(--hot)] bg-surface px-2.5 py-1.5 text-center shadow-[var(--shadow)]"
                    style={{ animationDelay: `${eventDelay + k * 250}ms` }}
                  >
                    <div className="whitespace-nowrap text-[12.5px] font-semibold text-ink">{e.title}</div>
                    <div className="whitespace-nowrap text-[11.5px] text-ink-2">{e.sub}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {forecast && (
            <>
              <span
                className="fb-ping absolute h-4 w-4 rounded-full"
                style={{ left: X(months.length - 1), top: Y(forecast.value), marginLeft: -8, marginTop: -8, background: "var(--accent)", animationDelay: "1.8s" }}
              />
              <span
                className="fb-dot absolute h-4 w-4 rounded-full shadow-[0_0_0_3px_var(--surface)]"
                style={{ left: X(months.length - 1), top: Y(forecast.value), marginLeft: -8, marginTop: -8, background: "var(--accent)", animationDelay: "1.6s", zIndex: 2 }}
              />
              <div className="absolute" style={{ left: X(months.length - 1) + 14, top: Y(forecast.value), transform: "translateY(-50%)" }}>
                <div className="fb-rise" style={{ animationDelay: "1.8s" }}>
                  {forecast.label}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Q7 run rate */

export interface PaceStep {
  month: string;
  value: number;
  workdays: number;
  perDay: number;
  weight: number;
}

/** Three months of pace per working day, weighted 1:2:3 toward July, then August's calendar. */
export function PaceStory({
  steps,
  perDay,
  target,
  days,
  yhat,
  stage,
  unit,
}: {
  steps: PaceStep[];
  perDay: number;
  target: string;
  days: { day: number; dow: number; work: boolean }[];
  yhat: number;
  stage: number;
  unit: string;
}) {
  const top = Math.max(perDay, ...steps.map((s) => s.perDay)) * 1.12;
  const workCount = days.filter((d) => d.work).length;
  const lead = days[0]?.dow ?? 0;
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
      <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface p-5">
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Statewide {unit} per working day</div>
        <div className="relative mt-3 min-h-[150px] flex-1">
          <div className="absolute inset-0 grid grid-cols-3 items-end gap-5">
            {steps.map((s, i) => (
              <div key={s.month} className="flex h-full flex-col items-center justify-end">
                <span
                  className={cx("fb-fade tabular mb-1 rounded-md px-2 py-0.5 text-[14px] font-bold", stage >= 1 ? "bg-[var(--accent)] text-[var(--accent-ink)] opacity-100" : "opacity-0")}
                >
                  weight × {s.weight}
                </span>
                <span className="tabular fb-rise text-[18px] font-semibold text-ink" style={{ animationDelay: `${i * 150 + 400}ms` }}>
                  {fmt.int(s.perDay)}
                </span>
                <div className="relative mt-1.5 w-full max-w-[120px]" style={{ height: `${(s.perDay / top) * 70}%` }}>
                  <div className="fb-grow-y absolute inset-0 rounded-t-lg bg-[var(--sig-households)]" style={{ animationDelay: `${i * 150}ms` }} />
                </div>
                <span className="mt-2 text-[15px] font-semibold text-ink">{monthLabel(s.month, "short").split(" ")[0]}</span>
                <span className="tabular text-[12px] text-muted">
                  {fmt.compact(s.value)} ÷ {s.workdays} days
                </span>
              </div>
            ))}
          </div>
          <div
            className={cx("fb-fade pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-[var(--accent)]", stage >= 1 ? "opacity-100" : "opacity-0")}
            style={{ bottom: `calc(${(perDay / top) * 70}% + 48px)` }}
          />
        </div>
        <p className={cx("fb-fade mt-3 text-[14px] text-ink-2", stage >= 1 ? "opacity-100" : "opacity-60")}>
          {stage >= 1 ? (
            <>
              Weights <b className="text-ink">1 : 2 : 3</b> give a weighted pace of{" "}
              <b className="tabular rounded bg-[var(--accent)] px-1.5 text-[var(--accent-ink)]">{fmt.int(perDay)} a day</b> (dashed line): July counts three times as much as May.
            </>
          ) : (
            <>Divide each month by its working days, so a short month does not look like a slow month.</>
          )}
        </p>
      </div>

      <div className={cx("fb-fade flex min-h-0 flex-col rounded-2xl border bg-surface p-5", stage >= 2 ? "border-accent opacity-100" : "border-line opacity-35")}>
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{monthLabel(target, "long")}: {workCount} working days</div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map((d) => (
            <span
              key={d.day}
              className={cx("tabular grid h-7 place-items-center rounded-md text-[12px] font-semibold", d.work ? "text-[var(--accent-ink)]" : "bg-surface-2 text-muted")}
              style={d.work ? { background: "var(--accent)", opacity: stage >= 2 ? 1 : 0.6, transition: `opacity .3s ${d.day * 25}ms` } : undefined}
            >
              {d.day}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <div className="tabular text-[15px] text-ink-2">
            {fmt.int(perDay)} / day × {workCount} days =
          </div>
          <div className="tabular text-[clamp(30px,3.4vw,46px)] font-bold leading-tight tracking-[-0.02em] text-ink">
            {stage >= 2 ? <CountUp value={yhat} /> : "?"} <span className="text-[0.45em] font-semibold text-muted">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ indexed lines */

export interface IndexSeries {
  label: string;
  color: string;
  points: { month: string; value: number | null }[];
}

/** Several monthly series rebased to the average of their first year = 100, labelled at the line ends. */
export function IndexLines({ series, ariaLabel }: { series: IndexSeries[]; ariaLabel: string }) {
  const [ref, size] = useBoxSize<HTMLDivElement>();
  const months = series[0]?.points.map((p) => p.month) ?? [];
  const rebased = series.map((s) => {
    const base = s.points.filter((p) => p.month.slice(0, 4) === months[0]?.slice(0, 4) && p.value != null);
    const mean = base.reduce((a, p) => a + (p.value as number), 0) / (base.length || 1);
    return { ...s, idx: s.points.map((p) => (p.value == null || !mean ? null : (100 * p.value) / mean)) };
  });
  const all = rebased.flatMap((s) => s.idx).filter((v): v is number => v != null);
  const step = niceStep(Math.max(...all) - Math.min(...all), 4);
  const lo = Math.floor(Math.min(...all, 100) / step) * step;
  const hi = Math.ceil(Math.max(...all) / step) * step;
  const pad = { l: 46, r: 190, t: 12, b: 28 };
  const pw = Math.max(1, size.w - pad.l - pad.r);
  const ph = Math.max(1, size.h - pad.t - pad.b);
  const X = (i: number) => pad.l + (months.length > 1 ? i / (months.length - 1) : 0) * pw;
  const Y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * ph;
  const ticks = linearTicks(lo, hi, (v) => fmt.num(v, 0), 4);
  const years = months.map((m, i) => ({ m, i })).filter(({ m }) => m.endsWith("-01"));
  // End labels, pushed apart when two series finish close together.
  const ends = rebased
    .map((s) => {
      const k = s.idx.length - 1 - [...s.idx].reverse().findIndex((v) => v != null);
      return { s, k, v: s.idx[k] as number, y: Y(s.idx[k] as number) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 44) ends[i].y = ends[i - 1].y + 44;
  return (
    <div ref={ref} className="relative h-full w-full" role="img" aria-label={ariaLabel}>
      {size.w > 0 && (
        <>
          {ticks.map((t) => (
            <div key={t.v}>
              <div className={cx("absolute h-px", t.v === 100 ? "bg-line-strong" : "bg-line")} style={{ left: pad.l, right: pad.r, top: Y(t.v) }} />
              <span className="tabular absolute -translate-y-1/2 text-right text-[12px] text-muted" style={{ right: size.w - pad.l + 8, top: Y(t.v) }}>
                {t.label}
              </span>
            </div>
          ))}
          {years.map(({ m, i }) => (
            <span key={m} className="tabular absolute text-[12px] text-muted" style={{ left: X(i), top: pad.t + ph + 7 }}>
              {m.slice(0, 4)}
            </span>
          ))}
          <svg className="absolute left-0 top-0" width={size.w} height={size.h} aria-hidden>
            <g className="fb-reveal-x">
              {rebased.map((s) => {
                let d = "";
                s.idx.forEach((v, i) => {
                  if (v == null) return;
                  d += `${d && s.idx[i - 1] != null ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
                });
                return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />;
              })}
            </g>
          </svg>
          {ends.map(({ s, k, v, y }) => (
            <div key={s.label} className="absolute" style={{ left: X(k) + 12, top: y, transform: "translateY(-50%)" }}>
              <div className="fb-rise" style={{ animationDelay: "1.4s" }}>
                <div className="tabular text-[22px] font-bold leading-none" style={{ color: s.color }}>
                  {v >= 100 ? "+" : "−"}
                  {fmt.num(Math.abs(v - 100), 0)}%
                </div>
                <div className="text-[12.5px] font-medium text-ink-2">{s.label}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ small pieces */

/** Gradient key under a map: plain words at each end, optional numbers. */
export function RampKey({ stops, low, high, title, ticks }: { stops: string[]; low: string; high: string; title?: string; ticks?: string[] }) {
  return (
    <div className="w-[min(100%,300px)] shrink-0">
      {title && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>}
      <div className="h-2.5 rounded-full" style={{ background: `linear-gradient(to right, ${stops.join(", ")})` }} />
      {ticks && (
        <div className="tabular mt-0.5 flex justify-between text-[10.5px] text-ink-2">
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      )}
      <div className="mt-0.5 flex justify-between text-[11.5px] font-medium text-ink-2">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function KeyChip({ color, label, hatch, ring }: { color: string; label: string; hatch?: boolean; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
      <span
        className={cx("inline-block h-3 w-3", ring ? "rounded-full" : "rounded-sm")}
        style={{
          background: hatch ? `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 5px)` : color,
          boxShadow: hatch ? `inset 0 0 0 1px ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

/** One large figure with a plain caption; counts up when it appears. */
export function Headline({ value, format, label, sub, color, delay = 0 }: { value: number | null | undefined; format?: (v: number) => string; label: ReactNode; sub?: ReactNode; color?: string; delay?: number }) {
  return (
    <div className="fb-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="tabular mt-1 text-[clamp(34px,4vw,56px)] font-bold leading-none tracking-[-0.03em]" style={{ color: color ?? "var(--ink)" }}>
        <CountUp value={value} format={format} />
      </div>
      {sub && <div className="mt-1.5 text-[14px] leading-snug text-ink-2">{sub}</div>}
    </div>
  );
}
