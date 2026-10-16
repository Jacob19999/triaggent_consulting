"use client";

// Map controls that live in a page's sidebar (BEI dashboard style), never over the map.

import { LAYER_GROUPS, LAYERS, type LayerDef, type Unit } from "@/lib/mapLayers";
import { cx, Segmented, Toggle } from "../ui";
import type { Basemap } from "./GeoMap";

export interface OverlayState {
  outlines: boolean;
  audit: boolean;
  lila: boolean;
  shelves: boolean;
}

export interface MapSettings {
  basemap: Basemap;
  labels: boolean;
  colorSafe: boolean;
  opacity: number;
}

export const DEFAULT_SETTINGS: MapSettings = { basemap: "auto", labels: true, colorSafe: false, opacity: 0.78 };

export function GeographySwitch({ unit, onUnit, tractsReady }: { unit: Unit; onUnit: (u: Unit) => void; tractsReady: boolean }) {
  return (
    <Segmented<Unit>
      className="w-full"
      label="Geography"
      value={unit}
      onChange={onUnit}
      options={[
        { value: "tract", label: tractsReady ? "Census tracts" : "Tracts (loading…)", icon: "dashboard", disabled: !tractsReady },
        { value: "county", label: "Counties", icon: "map" },
      ]}
    />
  );
}

/** Radio list of layers, grouped. Layers without data at this geography are shown but disabled. */
export function LayerList({
  unit,
  layerId,
  onLayer,
  allowed = () => true,
}: {
  unit: Unit;
  layerId: string;
  onLayer: (id: string) => void;
  allowed?: (l: LayerDef) => boolean;
}) {
  const available = (l: LayerDef) => (unit === "tract" ? !!l.tract : !!l.county);
  return (
    <div className="space-y-3">
      {LAYER_GROUPS.map((g) => {
        const rows = LAYERS.filter((l) => l.group === g && allowed(l));
        if (!rows.length) return null;
        return (
          <div key={g}>
            <div className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">{g}</div>
            <div className="space-y-px">
              {rows.map((l) => {
                const ok = available(l);
                const active = l.id === layerId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={!ok}
                    onClick={() => onLayer(l.id)}
                    title={ok ? l.note : `${l.label}: county only. Switch to counties to show it.`}
                    aria-pressed={active}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left text-[12.5px] transition-colors",
                      active ? "bg-[var(--accent-soft)] font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      !ok && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-ink-2",
                    )}
                  >
                    <span className={cx("grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border", active ? "border-accent" : "border-line-strong")} aria-hidden>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    {l.forecast && <span className="rounded border border-dashed border-current px-1 text-[9px] font-semibold text-muted">FC</span>}
                    {!ok && <span className="text-[10px] text-muted">county</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OverlayControls({
  unit,
  overlays,
  onOverlays,
  shelves = true,
}: {
  unit: Unit;
  overlays: OverlayState;
  onOverlays: (o: OverlayState) => void;
  shelves?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {unit === "tract" && <Toggle checked={overlays.outlines} onChange={(v) => onOverlays({ ...overlays, outlines: v })} label="County boundaries" />}
      <Toggle
        checked={overlays.audit}
        onChange={(v) => onOverlays({ ...overlays, audit: v })}
        label="Q6 audit-first counties"
        hint="Dashed outline: a call list for local checks (D-052)."
      />
      <Toggle
        checked={overlays.lila}
        onChange={(v) => onOverlays({ ...overlays, lila: v })}
        label="USDA LILA tracts"
        hint="Hatched: low income and low access, 2019 atlas."
      />
      {shelves && (
        <Toggle
          checked={overlays.shelves}
          onChange={(v) => onOverlays({ ...overlays, shelves: v })}
          label="Shelves in this workspace"
          hint="Count per county at its centre, never a location."
        />
      )}
    </div>
  );
}

export function StyleControls({ settings, onSettings }: { settings: MapSettings; onSettings: (s: MapSettings) => void }) {
  return (
    <div className="space-y-2">
      <label className="block text-[12px] text-ink-2">
        Basemap
        <select
          aria-label="Basemap"
          value={settings.basemap}
          onChange={(e) => onSettings({ ...settings, basemap: e.target.value as Basemap })}
          className="mt-1 h-8 w-full rounded-lg border border-line-strong bg-surface px-2 text-[12.5px] text-ink"
        >
          <option value="auto">Auto (follows theme)</option>
          <option value="dark">Dark canvas</option>
          <option value="light">Light canvas</option>
          <option value="streets">Streets</option>
          <option value="satellite">Imagery</option>
          <option value="none">None</option>
        </select>
      </label>
      <Toggle checked={settings.labels} onChange={(v) => onSettings({ ...settings, labels: v })} label="Place names above colors" />
      <Toggle
        checked={settings.colorSafe}
        onChange={(v) => onSettings({ ...settings, colorSafe: v })}
        label="Color-vision-safe ramp"
        hint="Blue → yellow → red instead of green → red."
      />
      <label className="block text-[12px] text-ink-2">
        Fill opacity <span className="tabular text-muted">{Math.round(settings.opacity * 100)}%</span>
        <input
          type="range"
          min={0.3}
          max={0.95}
          step={0.05}
          value={settings.opacity}
          onChange={(e) => onSettings({ ...settings, opacity: Number(e.target.value) })}
          className="mt-1 w-full"
        />
      </label>
    </div>
  );
}
