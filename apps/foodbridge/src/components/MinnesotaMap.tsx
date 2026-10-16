"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { containsPoint, fitProjection, pathFor } from "@/lib/geo";
import { countiesByFips, research } from "@/lib/research";
import type { GeoJSONGeometry } from "@/lib/types";

const W = 560;
const H = 620;
const SEQ = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];
const DIV = ["var(--div-neg)", "color-mix(in srgb, var(--div-neg) 45%, var(--div-mid))", "var(--div-mid)", "color-mix(in srgb, var(--div-pos) 45%, var(--div-mid))", "var(--div-pos)"];

export interface MapPin {
  lon: number;
  lat: number;
  label: string;
  kind?: "new" | "shelf" | "county";
  radiusMiles?: number[];
  count?: number;
}

export interface MapDot {
  lon: number;
  lat: number;
  r: number;
  color: string;
  title?: string;
}

export interface MinnesotaMapProps {
  values: Record<string, number | null | undefined>;
  scale?: "sequential" | "diverging";
  legendTitle: string;
  legendNote?: string;
  format?: (v: number) => string;
  selected?: string | null;
  onSelect?: (fips: string) => void;
  highlight?: Set<string>;
  pins?: MapPin[];
  dots?: MapDot[];
  onMapClick?: (lon: number, lat: number, fips: string | null) => void;
  tooltip?: (fips: string) => ReactNode;
  ariaLabel?: string;
  height?: number;
  /** Alternative units to color (e.g. tracts); county outlines are drawn on top. */
  geometry?: Record<string, GeoJSONGeometry>;
  unitName?: (id: string) => string;
  /** Zoom to one county (FIPS); other counties stay drawn and are clipped by the frame. */
  focus?: string | null;
}

function quantileBreaks(values: number[], k = 5): number[] {
  const s = [...values].sort((a, b) => a - b);
  return Array.from({ length: k - 1 }, (_, i) => {
    const pos = ((i + 1) / k) * (s.length - 1);
    const lo = Math.floor(pos);
    return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
  });
}

export function MinnesotaMap({
  values,
  scale = "sequential",
  legendTitle,
  legendNote,
  format = (v) => v.toFixed(0),
  selected,
  onSelect,
  highlight,
  pins = [],
  dots = [],
  onMapClick,
  tooltip,
  ariaLabel,
  geometry,
  unitName,
  focus,
}: MinnesotaMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ fips: string; x: number; y: number } | null>(null);
  const counties = research.geometry;
  const geoms = geometry ?? counties;
  const projection = useMemo(
    () =>
      focus && counties[focus]
        ? fitProjection([counties[focus]], W, H, 70)
        : fitProjection(Object.values(counties), W, H, 10),
    [counties, focus],
  );
  const paths = useMemo(
    () => Object.entries(geoms).map(([fips, g]) => ({ fips, d: pathFor(g, projection) })),
    [geoms, projection],
  );
  const outlines = useMemo(
    () => (geometry ? Object.entries(counties).map(([fips, g]) => ({ fips, d: pathFor(g, projection) })) : []),
    [geometry, counties, projection],
  );
  const nameOf = (id: string) => unitName?.(id) ?? `${countiesByFips[id]?.name ?? id} County`;

  const finite = Object.values(values).filter((v): v is number => v != null && Number.isFinite(v));
  const classes = useMemo(() => {
    if (!finite.length) return { breaks: [] as number[], colorOf: () => "var(--nodata)" };
    if (scale === "diverging") {
      const abs = finite.map(Math.abs).sort((a, b) => a - b);
      const t1 = abs[Math.floor(abs.length * 0.33)] || 1;
      const t2 = abs[Math.floor(abs.length * 0.66)] || 2;
      const breaks = [-t2, -t1, t1, t2];
      return {
        breaks,
        colorOf: (v: number) => DIV[v < -t2 ? 0 : v < -t1 ? 1 : v <= t1 ? 2 : v <= t2 ? 3 : 4],
      };
    }
    const breaks = quantileBreaks(finite);
    return {
      breaks,
      colorOf: (v: number) => SEQ[breaks.filter((b) => v > b).length],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(finite), scale]);

  const palette = scale === "diverging" ? DIV : SEQ;
  const legend = classes.breaks.length
    ? palette.map((color, i) => {
        const lo = i === 0 ? Math.min(...finite) : classes.breaks[i - 1];
        const hi = i === palette.length - 1 ? Math.max(...finite) : classes.breaks[i];
        return { color, label: `${format(lo)}–${format(hi)}` };
      })
    : [];

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y] as const;
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapClick) return;
    const p = toSvg(e.clientX, e.clientY);
    if (!p) return;
    const [lon, lat] = projection.invert(p[0], p[1]);
    const fips = Object.entries(counties).find(([, g]) => containsPoint(g, lon, lat))?.[0] ?? null;
    onMapClick(lon, lat, fips);
  };

  const hovered = hover ? { name: nameOf(hover.fips) } : null;
  const hv = hover ? values[hover.fips] : null;

  return (
    <div className="relative min-w-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "hidden" }}
        className={`h-auto w-full rounded-lg ${onMapClick ? "cursor-crosshair" : ""}`}
        role="img"
        aria-label={ariaLabel ?? `Minnesota county map: ${legendTitle}`}
        onClick={handleClick}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="nodata-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--nodata)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>
        <g>
          {paths.map(({ fips, d }) => {
            const v = values[fips];
            const fill = v == null || !Number.isFinite(v) ? "url(#nodata-hatch)" : classes.colorOf(v);
            return (
              <path
                key={fips}
                d={d}
                fill={fill}
                stroke="var(--surface)"
                strokeWidth={geometry ? 0.25 : 1}
                onMouseMove={(e) => {
                  const p = toSvg(e.clientX, e.clientY);
                  if (p) setHover({ fips, x: p[0], y: p[1] });
                }}
                onClick={(e) => {
                  if (!onMapClick) {
                    e.stopPropagation();
                    onSelect?.(fips);
                  }
                }}
                className={onSelect && !onMapClick ? "cursor-pointer" : undefined}
                aria-label={`${nameOf(fips)}: ${v == null ? "no data" : format(v)}`}
              />
            );
          })}
        </g>
        {outlines.length > 0 && (
          <g pointerEvents="none">
            {outlines.map((o) => (
              <path key={o.fips} d={o.d} fill="none" stroke="var(--surface)" strokeWidth={1.1} opacity={0.9} />
            ))}
          </g>
        )}
        {highlight && (
          <g pointerEvents="none">
            {paths
              .filter((p) => highlight.has(p.fips))
              .map((p) => (
                <path key={p.fips} d={p.d} fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="4 2" />
              ))}
          </g>
        )}
        {selected && (
          <g pointerEvents="none">
            {paths
              .filter((p) => p.fips === selected)
              .map((p) => (
                <path key={p.fips} d={p.d} fill="none" stroke="var(--ink)" strokeWidth={3} />
              ))}
          </g>
        )}
        <g pointerEvents="none">
          {dots.map((d, i) => {
            const [x, y] = projection.project(d.lon, d.lat);
            return <circle key={i} cx={x} cy={y} r={d.r} fill={d.color} stroke="var(--surface)" strokeWidth={0.6} opacity={0.9} />;
          })}
        </g>
        <g pointerEvents="none">
          {pins.map((pin, i) => {
            const [x, y] = projection.project(pin.lon, pin.lat);
            return (
              <g key={i}>
                {(pin.radiusMiles ?? []).map((m, j) => (
                  <circle
                    key={j}
                    cx={x}
                    cy={y}
                    r={projection.milesToPx(m)}
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                ))}
                {pin.kind === "county" ? (
                  <>
                    <circle cx={x} cy={y} r={4 + Math.sqrt(pin.count ?? 1) * 2.2} fill="var(--lime)" fillOpacity={0.85} stroke="var(--deep)" strokeWidth={1} />
                    <text x={x} y={y + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#143f35">
                      {pin.count}
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx={x} cy={y} r={pin.kind === "new" ? 7 : 5} fill={pin.kind === "new" ? "var(--critical)" : "var(--deep)"} stroke="white" strokeWidth={2} />
                    {pin.kind === "new" && (
                      <text x={x + 10} y={y - 8} fontSize={12} fontWeight={700} fill="var(--ink)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">
                        {pin.label}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {hover && hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-lg"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: `translate(${hover.x > W * 0.6 ? "-110%" : "12px"}, -50%)`,
          }}
        >
          <div className="font-semibold text-ink">{hovered.name}</div>
          <div className="text-ink-2">
            {legendTitle}: <span className="tabular font-semibold text-ink">{hv == null ? "no data" : format(hv)}</span>
          </div>
          {tooltip?.(hover.fips)}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-ink-2">
        <span className="font-semibold text-ink">{legendTitle}</span>
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-4 rounded-sm" style={{ background: l.color }} />
            <span className="tabular">{l.label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <svg width="16" height="12" aria-hidden>
            <rect width="16" height="12" fill="url(#nodata-hatch)" />
          </svg>
          No data
        </span>
        {legendNote && <span className="w-full text-muted">{legendNote}</span>}
      </div>
    </div>
  );
}
