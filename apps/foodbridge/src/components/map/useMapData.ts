"use client";

import { useCallback, useMemo } from "react";
import { useFeiTracts } from "@/lib/feiTracts";
import { layerValues, mergeTracts, type LayerDef, type TractRow, type Unit } from "@/lib/mapLayers";
import { makeScale, type Scale } from "@/lib/ramps";
import { research } from "@/lib/research";
import type { GeoJSONGeometry } from "@/lib/types";
import { useTheme } from "../theme";

/** Tract FEI rows merged with USDA flags, plus tract outlines. Loads on first use. */
export function useTractRows() {
  const { data, error } = useFeiTracts();
  const rows = useMemo(() => (data ? mergeTracts(data.tracts) : null), [data]);
  const byId = useMemo(() => new Map((rows ?? []).map((t) => [t.geoid, t])), [rows]);
  const lilaGeoms = useMemo(() => {
    if (!data || !rows) return {} as Record<string, GeoJSONGeometry>;
    return Object.fromEntries(rows.filter((t) => t.lila === 1 && data.geometry[t.geoid]).map((t) => [t.geoid, data.geometry[t.geoid]]));
  }, [data, rows]);
  return { rows, byId, geometry: data?.geometry ?? null, lilaGeoms, error };
}

export const auditGeoms: Record<string, GeoJSONGeometry> = Object.fromEntries(
  research.counties.filter((c) => c.robust && research.geometry[c.fips]).map((c) => [c.fips, research.geometry[c.fips]]),
);

/** Values, scale and a fill function for one layer at one geography. */
export function useLayerFill(
  layer: LayerDef,
  unit: Unit,
  tracts: TractRow[] | null,
  colorSafe: boolean,
  override?: Record<string, number | null> | null,
): { values: Record<string, number | null>; scale: Scale; fill: (id: string) => string | null } {
  const theme = useTheme();
  const values = useMemo(() => override ?? layerValues(layer, unit, tracts), [override, layer, unit, tracts]);
  const scale = useMemo(
    () =>
      makeScale(Object.values(values), layer.ramp, theme, {
        domain: layer.domain,
        invert: layer.invert,
        colorSafe,
      }),
    [values, layer, theme, colorSafe],
  );
  const fill = useCallback(
    (id: string) => {
      const v = values[id];
      if (v == null || !Number.isFinite(v)) return null;
      if (layer.categories && !(unit === "county" && layer.id === "lila"))
        return layer.categories.find((c) => c.value === v)?.color ?? null;
      return scale.color(v);
    },
    [values, scale, layer, unit],
  );
  return { values, scale, fill };
}
