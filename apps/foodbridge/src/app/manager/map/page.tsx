"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BarList, PillarBars, Radar } from "@/components/charts";
import { COUNTY_EVENT } from "@/components/CommandPalette";
import { useData } from "@/components/DataProvider";
import { CategoryLegend, GeoMap, GradientLegend, type MapMarker } from "@/components/map/GeoMap";
import { DEFAULT_SETTINGS, GeographySwitch, LayerList, OverlayControls, StyleControls, type MapSettings, type OverlayState } from "@/components/map/MapControls";
import { auditGeoms, useLayerFill, useTractRows } from "@/components/map/useMapData";
import { Badge, buttonClass, cx, ForecastBadge, Icon, Segmented, Select, SourceNote } from "@/components/ui";
import { useSiteTypes } from "@/components/useSiteTypes";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { layerById, type TractRow, type Unit } from "@/lib/mapLayers";
import { PILLARS } from "@/lib/pillars";
import { inkOn } from "@/lib/ramps";
import { countiesByFips, EQUITY_SHORT, equityValue, feiReady, research, SIGNAL_FIELD, SIGNAL_LABEL } from "@/lib/research";
import type { County, ForecastSignal, Pillar } from "@/lib/types";

const FC_FIELDS: ForecastSignal[] = ["HouseholdsTotal", "PoundsTotal", "IndividualsTotal", "ChildrenTotal", "AdultsTotal", "SeniorsTotal"];

const median = (xs: (number | null | undefined)[]) => {
  const s = xs.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const STATE_PILLARS = PILLARS.map((p) => median(research.counties.map((c) => c.fei?.[p.key] as number | null)));

const pillarsOf = (o: Partial<Record<Pillar, number | null | undefined>> | null | undefined) =>
  PILLARS.map((p) => ({ key: p.key, label: p.label, value: o?.[p.key] ?? null, color: p.color }));

function ScoreBadge({ value, color, label }: { value: number | null | undefined; color: string | null; label: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="tabular grid h-14 min-w-[68px] place-items-center rounded-xl px-2 text-[24px] font-bold shadow-[var(--shadow)]"
        style={{ background: color ?? "var(--surface-3)", color: color ? inkOn(color) : "var(--muted)" }}
      >
        {value == null ? "—" : fmt.num(value, 1)}
      </span>
      <span className="text-[12px] leading-snug text-muted">{label}</span>
    </div>
  );
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[12.5px]">
      <dt className="text-muted">{k}</dt>
      <dd className="tabular text-right font-semibold text-ink">{v}</dd>
    </div>
  );
}

function Section({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

type Tab = "layers" | "breakdown";

export default function MapExplorer() {
  const { data, session } = useData();
  const { mix: siteMix } = useSiteTypes();
  const tracts = useTractRows();
  const [unit, setUnit] = useState<Unit>("tract");
  const [layerId, setLayerId] = useState("fei");
  const [county, setCounty] = useState<string | null>(null);
  const [tract, setTract] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("layers");
  const [overlays, setOverlays] = useState<OverlayState>({ outlines: true, audit: false, lila: false, shelves: false });
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);

  // Tracts load after the page; show counties until they arrive.
  const shownUnit: Unit = unit === "tract" && !tracts.rows ? "county" : unit;
  const layer = layerById(layerId);
  useEffect(() => {
    if ((shownUnit === "tract" && !layer.tract) || (shownUnit === "county" && !layer.county)) setLayerId("fei");
  }, [shownUnit, layer]);

  const selectCounty = useCallback((fips: string, zoom = true) => {
    if (!countiesByFips[fips]) return;
    setCounty(fips);
    setTract(null);
    setTab("breakdown");
    if (zoom) setFocus(fips);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("county");
    if (q) selectCounty(q);
    const on = (e: Event) => selectCounty((e as CustomEvent<string>).detail);
    window.addEventListener(COUNTY_EVENT, on);
    return () => window.removeEventListener(COUNTY_EVENT, on);
  }, [selectCounty]);

  const { values, scale, fill } = useLayerFill(layer, shownUnit, tracts.rows, settings.colorSafe);
  const feiCounty = useLayerFill(layerById("fei"), "county", null, settings.colorSafe);
  const feiTract = useLayerFill(layerById("fei"), "tract", tracts.rows, settings.colorSafe);

  const geometry = shownUnit === "tract" && tracts.geometry ? tracts.geometry : research.geometry;
  const t: TractRow | null = tract ? (tracts.byId.get(tract) ?? null) : null;
  const c: County | null = county ? countiesByFips[county] : null;

  const onSelect = (id: string) => {
    if (shownUnit === "tract") {
      setTract(id);
      setCounty(id.slice(0, 5));
    } else {
      setCounty(id);
      setTract(null);
    }
    setTab("breakdown");
  };

  const markers: MapMarker[] = useMemo(() => {
    if (!overlays.shelves) return [];
    const counts = new Map<string, number>();
    let title = (n: number) => `${n} shelves in this workspace`;
    if (session.mode === "live") {
      data.shelves.filter((s) => s.active).forEach((s) => counts.set(s.county_fips, (counts.get(s.county_fips) ?? 0) + 1));
    } else {
      // County networks are one record per county, so count the sites reporting in the as-of month.
      if (!siteMix) return [];
      for (const [fips, types] of Object.entries(siteMix.counties)) {
        const n = Object.values(types).reduce((s, t) => s + (t?.sites ?? 0), 0);
        if (n) counts.set(fips, n);
      }
      const when = siteMix.month ? `, ${monthLabel(siteMix.month)}` : "";
      title = (n) => `${n} reporting site${n === 1 ? "" : "s"}${when}`;
    }
    return [...counts.entries()].flatMap(([fips, n]) => {
      const cc = countiesByFips[fips]?.centroid;
      return cc ? [{ id: `count-${fips}`, kind: "count" as const, lon: cc[0], lat: cc[1], label: String(n), size: 18 + Math.sqrt(n) * 5, title: title(n) }] : [];
    });
  }, [data.shelves, overlays.shelves, session.mode, siteMix]);

  const nameOf = (id: string) =>
    shownUnit === "tract" ? `${tracts.byId.get(id)?.name ?? id} · ${countiesByFips[id.slice(0, 5)]?.name ?? ""} County` : `${countiesByFips[id]?.name ?? id} County`;

  const hoverCard = (id: string) => {
    const v = values[id];
    const f = shownUnit === "tract" ? feiTract.values[id] : feiCounty.values[id];
    const row = shownUnit === "tract" ? tracts.byId.get(id) : null;
    return (
      <div className="min-w-[200px]">
        <div className="font-semibold text-ink">{nameOf(id)}</div>
        <div className="mt-1 flex items-center justify-between gap-4 text-ink-2">
          <span>{layer.short}</span>
          <span className="tabular font-semibold text-ink">
            {v == null ? "no data" : layer.categories && shownUnit === "tract" ? layer.categories.find((x) => x.value === v)?.label : layer.format(v)}
          </span>
        </div>
        {layer.id !== "fei" && (
          <div className="flex items-center justify-between gap-4 text-ink-2">
            <span>{EQUITY_SHORT}</span>
            <span className="tabular font-semibold text-ink">{f == null ? "—" : fmt.num(f, 1)}</span>
          </div>
        )}
        {row && (
          <div className="mt-1.5 flex gap-1">
            {PILLARS.map((p) => (
              <span key={p.key} className="flex-1" title={`${p.label} ${fmt.num(row[p.key], 2)}`}>
                <span className="block h-1 rounded-full bg-surface-3">
                  <span className="block h-full rounded-full" style={{ width: `${(row[p.key] ?? 0) * 100}%`, background: p.color }} />
                </span>
                <span className="mt-0.5 block text-center text-[9.5px] font-semibold text-muted">{p.key}</span>
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 text-[11px] text-muted">Click for the full breakdown</div>
      </div>
    );
  };

  const ranked = useMemo(
    () =>
      research.counties
        .map((x) => [x.fips, layer.county?.(x) ?? null] as const)
        .filter(([, v]) => v != null)
        .sort((a, b) => (layer.invert ? (a[1] ?? 0) - (b[1] ?? 0) : (b[1] ?? 0) - (a[1] ?? 0)))
        .slice(0, 10),
    [layer],
  );

  const legend =
    layer.categories && (shownUnit === "tract" || layer.id === "rural") ? (
      <CategoryLegend title={layer.short} items={layer.categories.map((x) => ({ label: x.label, color: x.color }))} />
    ) : (
      <GradientLegend
        title={
          <span className="inline-flex items-center gap-1.5">
            {layer.short} · {shownUnit === "tract" ? "census tracts" : "counties"} {layer.forecast && <ForecastBadge />}
          </span>
        }
        scale={scale}
        format={layer.format}
        low={layer.low}
        high={layer.high}
      />
    );

  const countyTracts = useMemo(
    () => (c && tracts.rows ? tracts.rows.filter((x) => x.county === c.fips).sort((a, b) => (b.fei ?? 0) - (a.fei ?? 0)) : []),
    [c, tracts.rows],
  );

  return (
    <div className="flex h-auto flex-col lg:h-[calc(100dvh-56px)] lg:flex-row">
      {/* flex-1 only at lg: in the stacked layout a 0% flex-basis leaves the map's h-full child at zero height. */}
      <div className="relative h-[68vh] min-h-[440px] lg:h-auto lg:flex-1">
        <GeoMap
          geometry={geometry}
          fill={fill}
          fillOpacity={settings.opacity}
          selected={shownUnit === "tract" ? tract : county}
          onSelect={onSelect}
          hoverCard={hoverCard}
          outlines={shownUnit === "tract" && overlays.outlines ? research.geometry : undefined}
          dashed={overlays.audit ? auditGeoms : undefined}
          hatch={overlays.lila ? tracts.lilaGeoms : undefined}
          ring={shownUnit === "tract" && county && !tract ? research.geometry[county] : null}
          markers={markers}
          focus={focus ? research.geometry[focus] : null}
          basemap={settings.basemap}
          showLabels={settings.labels}
          ariaLabel={`Minnesota ${shownUnit} map: ${layer.label}`}
          fitPadding={[20, 56, 20, 20]}
        />
      </div>

      <aside className="flex w-full shrink-0 flex-col border-l border-line bg-surface lg:h-full lg:w-[400px]">
        <div className="space-y-3 border-b border-line px-5 py-4">
          <label className="sr-only" htmlFor="county-find">
            Find a county
          </label>
          <Select
            id="county-find"
            value={c?.fips ?? ""}
            onChange={(e) => {
              if (e.target.value) selectCounty(e.target.value);
              else {
                setCounty(null);
                setTract(null);
                setFocus(null);
              }
            }}
          >
            <option value="">Statewide view</option>
            {research.counties.map((x) => (
              <option key={x.fips} value={x.fips}>
                {x.name} County
              </option>
            ))}
          </Select>
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">{legend}</div>
          <Segmented<Tab>
            className="w-full"
            label="Sidebar"
            value={tab}
            onChange={setTab}
            options={[
              { value: "layers", label: "Map layers", icon: "layers" },
              { value: "breakdown", label: c ? (t ? "Tract breakdown" : `${c.name} breakdown`) : "Breakdown", icon: "index" },
            ]}
          />
        </div>

        <div className="fb-scroll min-h-0 flex-1 overflow-y-auto">
          {tab === "layers" ? (
            <>
              <Section title="Geography">
                <GeographySwitch
                  unit={unit}
                  onUnit={(u) => {
                    setUnit(u);
                    setTract(null);
                  }}
                  tractsReady={!!tracts.rows}
                />
                <p className="mt-2 text-[11.5px] leading-snug text-muted">
                  {shownUnit === "tract"
                    ? "1,501 census tracts (2020). County-only measures are greyed out at this level (D-020)."
                    : "87 counties. Switch to census tracts for the detailed view."}
                </p>
              </Section>
              <Section title="Map layer">
                <LayerList unit={shownUnit} layerId={layer.id} onLayer={setLayerId} />
                <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-snug text-ink-2">{layer.note}</p>
              </Section>
              <Section title="Overlays">
                <OverlayControls unit={shownUnit} overlays={overlays} onOverlays={setOverlays} />
              </Section>
              <Section title="Map style">
                <StyleControls settings={settings} onSettings={setSettings} />
              </Section>
              <div className="px-5 py-4">
                <SourceNote>
                  County outlines: U.S. Census cartographic boundaries 2023. Tracts: 2020 Census. Basemap: Esri (incl. © OpenStreetMap
                  contributors). Distances run to the nearest reporting shelf only.
                </SourceNote>
              </div>
            </>
          ) : !c ? (
            <>
              <Section title="Statewide view">
                <p className="text-[13px] leading-relaxed text-ink-2">
                  Click any {shownUnit === "tract" ? "census tract" : "county"} on the map, or pick a county above, for its full
                  breakdown.
                </p>
              </Section>
              {ranked.length > 0 && (
                <Section title={`${layer.invert ? "Lowest" : "Highest"} counties: ${layer.short}`}>
                  <BarList
                    rows={ranked.map(([fips, v]) => ({ key: fips, label: countiesByFips[fips]?.name ?? fips, value: v }))}
                    onSelect={(f) => selectCounty(f)}
                    format={layer.format}
                    color={scale.color(scale.domain[1])}
                  />
                </Section>
              )}
              {feiReady && (
                <Section title="State median pillars (counties)">
                  <PillarBars rows={PILLARS.map((p, i) => ({ key: p.key, label: p.label, value: STATE_PILLARS[i], color: p.color }))} />
                </Section>
              )}
            </>
          ) : (
            <>
              <div className="border-b border-line px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {t && (
                      <button onClick={() => setTract(null)} className="mb-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline">
                        <Icon name="back" className="h-3 w-3" /> {c.name} County
                      </button>
                    )}
                    <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{t ? t.name : `${c.name} County`}</h2>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {t
                        ? `${c.name} County, Minnesota · ${t.urbanFlag === 1 ? "Urban" : "Rural"} · ${fmt.int(t.pop)} residents (2020)`
                        : `${c.nonmetro ? "Nonmetro" : "Metro"} · ${fmt.int(c.population)} residents · ${c.sites_2024} reporting shelves (2024)`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCounty(null);
                      setTract(null);
                      setFocus(null);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                    aria-label="Clear selection"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!t && c.robust && <Badge tone="demo">Q6 audit first</Badge>}
                  {!t && !c.robust && c.flagged && <Badge>Q6 watch</Badge>}
                  {!t && c.fei?.stable_high && <Badge tone="critical">Stable high FEI</Badge>}
                  {t?.lila === 1 && <Badge tone="critical">USDA LILA</Badge>}
                  {t && t.li === 1 && t.lila !== 1 && <Badge>Low-income tract</Badge>}
                  {t?.stable_high && <Badge tone="critical">Stable high FEI</Badge>}
                </div>
                <div className="mt-4">
                  <ScoreBadge
                    value={t ? t.fei : equityValue(c)}
                    color={t ? feiTract.fill(t.geoid) : feiCounty.fill(c.fips)}
                    label={
                      t
                        ? `Tract FEI · quintile ${t.quintile ?? "—"} · decile ${t.decile ?? "—"} of Minnesota tracts`
                        : `${EQUITY_SHORT} · rank ${c.fei?.rank ?? "—"} of 87 (1 = most barriers) · quintile ${c.fei?.quintile ?? "—"}`
                    }
                  />
                </div>
              </div>

              {feiReady && (
                <Section title="FEI pillar breakdown (0 = best, 1 = worst)">
                  <PillarBars rows={pillarsOf(t ?? c.fei)} />
                  <div className="mt-3">
                    <Radar
                      axes={PILLARS.map((p) => ({ key: p.key, label: p.label }))}
                      values={pillarsOf(t ?? c.fei).map((r) => r.value)}
                      compare={t ? pillarsOf(c.fei).map((r) => r.value) : STATE_PILLARS}
                      compareLabel={t ? `${c.name} County` : "State county median"}
                    />
                  </div>
                </Section>
              )}

              {t ? (
                <>
                  <Section title="Access">
                    <dl>
                      <Row k="Miles to nearest reporting shelf" v={fmt.num(t.d, 1)} />
                      <Row k="Miles to nearest brick-and-mortar shelf" v={fmt.num(t.d_bm, 1)} />
                      <Row k={`Residents beyond ${t.theta ?? (t.urbanFlag === 1 ? 1 : 10)} mi`} v={fmt.pct(t.beyond, 0)} />
                      <Row k="Pounds per low-income resident within reach" v={`${fmt.num(t.A, 0)} lb/yr`} />
                    </dl>
                  </Section>
                  <Section title="Demographics and flags">
                    <dl>
                      <Row k="Residents (2020)" v={fmt.int(t.pop)} />
                      <Row k="Children (2020)" v={fmt.int(t.children)} />
                      <Row k="USDA urban flag (SRAM 2025)" v={t.urbanFlag === 1 ? "Urban" : t.urbanFlag === 0 ? "Rural" : "—"} />
                      <Row k="USDA low-income tract" v={t.li === 1 ? "Yes" : t.li === 0 ? "No" : "—"} />
                      <Row k="USDA LILA (1 and 10 mi)" v={t.lila === 1 ? "Yes" : t.lila === 0 ? "No" : "—"} />
                    </dl>
                  </Section>
                  <Section title={`${c.name} County context`}>
                    <dl>
                      <Row k="County FEI" v={`${fmt.num(equityValue(c), 1)} (rank ${c.fei?.rank ?? "—"})`} />
                      <Row k="Below 200% of poverty (county)" v={fmt.pct(c.below_200_share, 1)} />
                      <Row
                        k={
                          <span className="inline-flex items-center gap-1">
                            Aug visits <ForecastBadge />
                          </span>
                        }
                        v={fmt.int(c.forecast.HouseholdsTotal?.yhat)}
                      />
                    </dl>
                  </Section>
                </>
              ) : (
                <>
                  <Section title="Need and access">
                    <dl>
                      <Row k="Need percentile (Q6)" v={fmt.num(c.need_percentile, 0)} />
                      <Row k="Below 200% of poverty" v={fmt.pct(c.below_200_share, 1)} />
                      <Row k="Residents below poverty" v={fmt.int(c.poverty_persons)} />
                      <Row k="Miles to nearest reporting shelf" v={fmt.num(c.fei?.miles_nearest ?? c.mean_miles, 1)} />
                      <Row k="Residents beyond threshold" v={`${fmt.int(c.fei?.beyond_residents)} (${fmt.pct(c.fei?.beyond_share)})`} />
                      <Row k="Pounds per low-income resident" v={`${fmt.num(c.fei?.lbs_per_lowinc, 0)} lb/yr`} />
                      <Row k="LILA tracts without a shelf" v={`${c.lila_without_site} of ${c.lila_tracts}`} />
                      <Row k="Minimum gap (need − activity)" v={`${fmt.num(c.minimum_gap, 0)} pts`} />
                    </dl>
                  </Section>
                  <Section
                    title={
                      <span className="inline-flex items-center gap-1.5">
                        {monthLabel(research.meta.forecast_target, "long")} <ForecastBadge />
                      </span>
                    }
                  >
                    {c.forecast.HouseholdsTotal?.yhat == null ? (
                      <p className="text-[12.5px] text-muted">No reporting history, so no forecast. The submission carries 0 (D-040).</p>
                    ) : (
                      <table className="tabular w-full text-[12.5px]">
                        <thead>
                          <tr className="text-left text-[11px] text-muted">
                            <th className="pb-1 font-medium">Field</th>
                            <th className="pb-1 text-right font-medium">Point</th>
                            <th className="pb-1 text-right font-medium">80% range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {FC_FIELDS.map((f) => {
                            const cell = c.forecast[f];
                            return (
                              <tr key={f} className="border-t border-line">
                                <td className="py-1 text-ink-2" title={SIGNAL_FIELD[f]}>
                                  {SIGNAL_LABEL[f]}
                                </td>
                                <td className="py-1 text-right font-semibold text-ink">{fmt.int(cell?.yhat)}</td>
                                <td className="py-1 text-right text-muted">
                                  {fmt.int(cell?.lo80)}–{fmt.int(cell?.hi80)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </Section>
                  {countyTracts.length > 0 && (
                    <Section title={`Highest-FEI tracts in ${c.name}`}>
                      <ul className="space-y-1">
                        {countyTracts.slice(0, 6).map((x) => (
                          <li key={x.geoid}>
                            <button
                              onClick={() => {
                                setUnit("tract");
                                setTract(x.geoid);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] hover:bg-surface-2"
                            >
                              <span
                                className="tabular grid h-6 w-10 place-items-center rounded text-[11.5px] font-bold"
                                style={{ background: feiTract.scale.color(x.fei ?? 0), color: inkOn(feiTract.scale.color(x.fei ?? 0)) }}
                              >
                                {fmt.num(x.fei, 0)}
                              </span>
                              <span className="flex-1 text-ink">{x.name}</span>
                              <span className="tabular text-muted">
                                {fmt.num(x.d, 1)} mi · {fmt.int(x.pop)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              )}

              <div className="space-y-2 px-5 py-4">
                <Link className={cx(buttonClass("primary"), "w-full")} href={`/manager/scenarios?county=${c.fips}`}>
                  <Icon name="target" /> Plan a new site in {c.name}
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link className={cx(buttonClass("secondary", "sm"), "w-full")} href={`/manager/allocation?county=${c.fips}`}>
                    <Icon name="truck" /> Allocate supply
                  </Link>
                  <Link className={cx(buttonClass("secondary", "sm"), "w-full")} href={`/manager/briefing?county=${c.fips}`}>
                    <Icon name="spark" /> Brief me
                  </Link>
                </div>
                <SourceNote>
                  FEI build {research.fei.source?.commit ? `(commit ${research.fei.source.commit})` : ""}: tract and county aggregates
                  only. Forecast: outputs/forecasts/q7_august2026_wide.csv (D-045); historical 80% ranges undercovered, treat as a
                  planning range.
                </SourceNote>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
