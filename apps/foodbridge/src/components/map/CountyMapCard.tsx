"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";
import { fmt } from "@/lib/format";
import { makeScale, type RampId } from "@/lib/ramps";
import { countiesByFips, research } from "@/lib/research";
import type { GeoJSONGeometry } from "@/lib/types";
import { useTheme } from "../theme";
import { Card } from "../ui";
import { GeoMap, LegendBar } from "./GeoMap";

/** A card with a basemap choropleth: counties by default, or any units passed as `geometry`. */
export function CountyMapCard({
  title,
  subtitle,
  actions,
  values,
  legendTitle,
  format = (v) => fmt.num(v, 0),
  ramp = "risk",
  domain,
  low = "Fewer barriers",
  high = "More barriers",
  highlight,
  selected,
  onSelect,
  href,
  geometry,
  unitName,
  extra,
  note,
  height = 470,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  values: Record<string, number | null | undefined>;
  legendTitle: ReactNode;
  format?: (v: number) => string;
  ramp?: RampId;
  domain?: [number, number];
  low?: string;
  high?: string;
  highlight?: Set<string>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  href?: (id: string) => string;
  geometry?: Record<string, GeoJSONGeometry>;
  unitName?: (id: string) => string;
  extra?: (id: string) => ReactNode;
  note?: ReactNode;
  height?: number;
  className?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const scale = useMemo(() => makeScale(Object.values(values), ramp, theme, { domain }), [values, ramp, theme, domain]);
  const fill = useCallback(
    (id: string) => {
      const v = values[id];
      return v == null || !Number.isFinite(v) ? null : scale.color(v);
    },
    [values, scale],
  );
  const highlightKey = highlight ? [...highlight].sort().join(",") : "";
  const dashed = useMemo(
    () =>
      highlightKey
        ? Object.fromEntries(highlightKey.split(",").filter((f) => research.geometry[f]).map((f) => [f, research.geometry[f]]))
        : undefined,
    [highlightKey],
  );
  const name = (id: string) => unitName?.(id) ?? `${countiesByFips[id]?.name ?? id} County`;
  return (
    <Card title={title} subtitle={subtitle} actions={actions} icon="map" padded={false} className={className}>
      <div className="relative overflow-hidden border-t border-line" style={{ height }}>
        <GeoMap
          geometry={geometry ?? research.geometry}
          fill={fill}
          selected={selected}
          onSelect={(id) => (onSelect ? onSelect(id) : href ? router.push(href(id)) : undefined)}
          outlines={geometry ? research.geometry : undefined}
          dashed={dashed}
          basemap={theme === "dark" ? "dark" : "light"}
          ariaLabel={`Minnesota map: ${typeof legendTitle === "string" ? legendTitle : "index"}`}
          fitPadding={[12, 52, 12, 12]}
          hoverCard={(id) => {
            const v = values[id];
            return (
              <div>
                <div className="font-semibold text-ink">{name(id)}</div>
                <div className="mt-1 flex justify-between gap-4 text-ink-2">
                  <span>{legendTitle}</span>
                  <span className="tabular font-semibold text-ink">{v == null ? "no data" : format(v)}</span>
                </div>
                {extra?.(id)}
              </div>
            );
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-b-[var(--radius-card)] border-t border-line px-4 py-3 sm:px-5">
        <LegendBar title={legendTitle} scale={scale} format={format} low={low} high={high} />
        {note && <span className="max-w-[460px] text-[11.5px] leading-snug text-muted">{note}</span>}
      </div>
    </Card>
  );
}
