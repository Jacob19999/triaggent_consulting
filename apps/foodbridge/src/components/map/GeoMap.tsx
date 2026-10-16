"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { gradientCss, type Scale } from "@/lib/ramps";
import { cx } from "../ui";
import type { LeafletMapProps } from "./LeafletMap";

export type { Basemap, MapMarker } from "./LeafletMap";

/** Leaflet touches `window` on import, so the map loads in the browser only. */
export const GeoMap = dynamic<LeafletMapProps>(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[var(--map-bg)] text-[12px] text-muted">Loading map…</div>
  ),
});

/** Floating glass panel inside a map workspace. */
export function MapPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-[var(--glass)] shadow-[var(--shadow-lg)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GradientLegend({
  title,
  scale,
  format,
  low,
  high,
  note,
  nodata = true,
}: {
  title: ReactNode;
  scale: Scale;
  format: (v: number) => string;
  low?: string;
  high?: string;
  note?: ReactNode;
  nodata?: boolean;
}) {
  return (
    <div className="min-w-[220px]">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>
      <div className="h-2.5 rounded-full" style={{ background: gradientCss(scale.stops) }} />
      <div className="tabular mt-1 flex justify-between text-[10.5px] text-ink-2">
        {scale.ticks.map((t, i) => (
          <span key={i}>{format(t)}</span>
        ))}
      </div>
      {(low || high) && (
        <div className="mt-0.5 flex justify-between text-[10.5px] text-muted">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
      {nodata && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted">
          <span className="inline-block h-2.5 w-3.5 rounded-sm bg-[var(--nodata)] ring-1 ring-line" /> No data
        </div>
      )}
      {note && <div className="mt-1.5 max-w-[260px] text-[10.5px] leading-snug text-muted">{note}</div>}
    </div>
  );
}

export function CategoryLegend({ title, items }: { title: ReactNode; items: { label: string; color: string; hatch?: boolean }[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>
      <ul className="space-y-1 text-[11.5px] text-ink-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-4 rounded-sm ring-1 ring-line"
              style={{
                background: i.hatch
                  ? `repeating-linear-gradient(45deg, ${i.color} 0 2px, transparent 2px 5px)`
                  : i.color,
              }}
            />
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal legend for a bar under or above a map (never over it). */
export function LegendBar({
  title,
  scale,
  format,
  low,
  high,
  note,
  className,
}: {
  title: ReactNode;
  scale: Scale;
  format: (v: number) => string;
  low?: string;
  high?: string;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-[min(100%,260px)] max-w-[420px]", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{title}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] text-muted">
          <span className="h-2.5 w-3 rounded-sm bg-[var(--nodata)] ring-1 ring-line" /> No data
        </span>
      </div>
      <div className="h-2.5 rounded-sm ring-1 ring-inset ring-black/10" style={{ background: gradientCss(scale.stops) }} />
      <div className="tabular relative mt-1 h-4 text-[10.5px] text-ink-2">
        {scale.ticks.map((t, i) => (
          <span key={i} className="absolute" style={{ left: `${(i / (scale.ticks.length - 1)) * 100}%`, transform: `translateX(${i === 0 ? "0" : i === scale.ticks.length - 1 ? "-100%" : "-50%"})` }}>{format(t)}</span>
        ))}
      </div>
      {(low || high) && (
        <div className="mt-1 flex justify-between gap-3 text-[10.5px] text-muted">
          <span>{low}</span><span className="text-right">{high}</span>
        </div>
      )}
      {note && <span className="text-[11px] leading-snug text-muted">{note}</span>}
    </div>
  );
}
