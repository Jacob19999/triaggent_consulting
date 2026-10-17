"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StackedBar } from "@/components/charts";
import { useData } from "@/components/DataProvider";
import { GeoMap, LegendBar, type MapMarker } from "@/components/map/GeoMap";
import { DEFAULT_SETTINGS, LayerList, OverlayControls, StyleControls, type MapSettings, type OverlayState } from "@/components/map/MapControls";
import { auditGeoms, useLayerFill, useTractRows } from "@/components/map/useMapData";
import { useDriveReach, useDriveReachMany } from "@/components/useDriveReach";
import { DRIVE_MINUTES_RING } from "@/lib/drive";
import { useTheme } from "@/components/theme";
import {
  Badge,
  Button,
  buttonClass,
  cx,
  Delta,
  ForecastBadge,
  Icon,
  Input,
  Progress,
  SectionLabel,
  Segmented,
  Select,
  SourceNote,
} from "@/components/ui";
import { containsPoint } from "@/lib/geo";
import { downloadText, fmt, toCsv } from "@/lib/format";
import { layerById } from "@/lib/mapLayers";
import { makeScale } from "@/lib/ramps";
import { countiesByFips, EQUITY_SHORT, feiReady, research } from "@/lib/research";
import { ASSUMPTION_NOTES, DEFAULT_MONEY, type MoneyAssumptions } from "@/lib/scenario";
import {
  evaluateSite,
  DEFAULT_SITE_ASSUMPTIONS,
  HUFF_EXPONENT,
  OBJECTIVES,
  optimizeSites,
  TYPE_REACH,
  MAX_ADDITIONAL_VISITS_PCT,
  type SiteAssumptions,
  type Candidate,
  type Objective,
} from "@/lib/siteModel";
import type { GeoJSONGeometry, ShelfType } from "@/lib/types";

const TYPES: { id: ShelfType; label: string; short: string; icon: string }[] = [
  { id: "brick_and_mortar", label: "Brick-and-mortar food shelf", short: "Food shelf", icon: "store" },
  { id: "mobile", label: "Mobile pantry stop", short: "Mobile", icon: "truck" },
  { id: "outreach", label: "Outreach / delivery", short: "Outreach", icon: "route" },
  { id: "campus", label: "College campus pantry", short: "Campus", icon: "book" },
  { id: "tribal", label: "Tribal program site", short: "Tribal", icon: "home" },
];

type View = "today" | "after" | "change";
type SideTab = "plan" | "impact" | "layers";
type ScopeKind = "state" | "county" | "topq";

interface Site {
  lon: number;
  lat: number;
  fips: string;
  label: string;
}

/** A box around points, padded by miles, as a focus geometry for the map. */
function boxAround(points: { lon: number; lat: number }[], miles: number): GeoJSONGeometry {
  const dy = miles / 69;
  const dx = miles / (69 * Math.cos((46.3 * Math.PI) / 180));
  const xs = points.map((p) => p.lon);
  const ys = points.map((p) => p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs) - dx, Math.max(...xs) + dx, Math.min(...ys) - dy, Math.max(...ys) + dy];
  return { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] };
}

function countyAt(lon: number, lat: number): string | null {
  return Object.entries(research.geometry).find(([, g]) => containsPoint(g, lon, lat))?.[0] ?? null;
}

function Kpi({ label, value, sub, tone, icon }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "forecast" | "good"; icon: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted">
        <Icon name={icon} className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
        {tone === "forecast" && <ForecastBadge />}
      </div>
      <div className={cx("mt-1.5 text-[21px] font-semibold leading-none tracking-[-0.02em]", tone === "good" ? "text-[var(--good-text)]" : "text-ink")}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

function Block({ title, icon, children, aside }: { title: ReactNode; icon: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent-soft)] text-accent">
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Line({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[12.5px]">
      <span className="text-muted">{k}</span>
      <span className={cx("tabular text-right", strong ? "font-semibold text-ink" : "text-ink-2")}>{v}</span>
    </div>
  );
}

/** Value against cost on one scale: bars share a baseline so lengths compare directly. */
function ValueBars({ rows }: { rows: { label: string; value: number; color: string; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="text-ink-2">{r.label}</span>
            <span className="tabular font-semibold text-ink">{fmt.usd(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-3">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: r.color }} />
          </div>
          {r.note && <div className="mt-0.5 text-[11px] text-muted">{r.note}</div>}
        </li>
      ))}
    </ul>
  );
}

export default function SitePlanner() {
  const { store, refresh, data } = useData();
  const theme = useTheme();
  const tracts = useTractRows();
  const [mode, setMode] = useState<"manual" | "optimize">("optimize");
  const [site, setSite] = useState<Site | null>(null);
  const [type, setType] = useState<ShelfType>("brick_and_mortar");
  const [sizing, setSizing] = useState<"auto" | "manual">("auto");
  const [manual, setManual] = useState({ visits: 150, pounds: 8000 });
  const [money, setMoney] = useState<MoneyAssumptions>(DEFAULT_MONEY.brick_and_mortar);
  const [assumptions, setAssumptions] = useState<SiteAssumptions>(DEFAULT_SITE_ASSUMPTIONS);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [view, setView] = useState<View>("today");
  const [layerId, setLayerId] = useState("fei");
  const [overlays, setOverlays] = useState<OverlayState>({ outlines: true, audit: false, lila: false, shelves: false });
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);
  const [focus, setFocusState] = useState<GeoJSONGeometry | null>(null);
  const setFocus = (fips: string | null) => setFocusState(fips ? research.geometry[fips] ?? null : null);
  const focusSite = (lon: number, lat: number, isRural: boolean) => setFocusState(boxAround([{ lon, lat }], isRural ? 32 : 12));

  const [objective, setObjective] = useState<Objective>("topq");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("state");
  const [scopeCounty, setScopeCounty] = useState("27023");
  const [spacing, setSpacing] = useState(15);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeRank, setActiveRank] = useState<number | null>(null);
  const cancel = useRef<{ cancelled: boolean } | null>(null);
  const hasSearched = useRef(false);
  const [tab, setTab] = useState<SideTab>("plan");

  useEffect(() => setMoney(DEFAULT_MONEY[type]), [type]);

  useEffect(() => {
    if (cancel.current) cancel.current.cancelled = true;
    setRunning(false);
    setCandidates([]);
    setActiveRank(null);
    if (hasSearched.current) {
      setSearchMessage("Settings changed. Run the search to rank options with these assumptions.");
      setSite((current) => current?.label.startsWith("Option") ? { ...current, label: "Selected location · settings changed" } : current);
    }
    return () => { if (cancel.current) cancel.current.cancelled = true; };
  }, [objective, type, money, assumptions, scopeKind, scopeCounty, spacing, sizing, manual]);

  const placeAt = useCallback((lon: number, lat: number, label?: string) => {
    const fips = countyAt(lon, lat);
    if (!fips) return;
    setSite({ lon, lat, fips, label: label ?? "Proposed site" });
    setSaved(null);
    setTab("impact");
    if (view === "today") setView("change");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("county");
    const c = q ? countiesByFips[q] : null;
    if (c?.centroid) {
      setMode("manual");
      setScopeCounty(c.fips);
      setSite({ lon: c.centroid[0], lat: c.centroid[1], fips: c.fips, label: `${c.name} County centre` });
      setFocus(c.fips);
      setView("change");
      setTab("impact");
    }
  }, []);

  const { evaluation, evaluationError } = useMemo(() => {
    if (!site) return { evaluation: null, evaluationError: null };
    try {
      return {
        evaluation: evaluateSite({
          lon: site.lon, lat: site.lat, county: site.fips, type, money, assumptions,
          feiTracts: tracts.rows ?? [], manual: sizing === "manual" ? manual : null,
        }),
        evaluationError: null,
      };
    } catch (e) {
      return { evaluation: null, evaluationError: e instanceof Error ? e.message : String(e) };
    }
  }, [site, type, money, assumptions, tracts.rows, sizing, manual]);

  const result = evaluation?.result ?? null;
  const fc = evaluation?.forecast ?? null;
  const saveKey = JSON.stringify({ input: result?.input, assumptions, name });
  const drive = useDriveReach(site, tracts.rows);
  const candidateSites = useMemo(() => candidates.map((c) => ({ lon: c.lon, lat: c.lat })), [candidates]);
  const candidateDrive = useDriveReachMany(candidateSites, tracts.rows);
  const county = site ? countiesByFips[site.fips] : null;
  const rural = county?.nonmetro ?? true;

  // Map values by view.
  const after = useMemo(() => {
    const m = new Map<string, { before: number; after: number }>();
    result?.affected.forEach((a) => a.feiBefore != null && a.feiAfter != null && m.set(a.geoid, { before: a.feiBefore, after: a.feiAfter }));
    return m;
  }, [result]);
  const unit = tracts.rows ? "tract" : "county";
  const layer = view === "today" ? layerById(layerId) : layerById("fei");
  const override = useMemo(() => {
    if (!tracts.rows || view === "today") return null;
    if (view === "after") return Object.fromEntries(tracts.rows.map((t) => [t.geoid, after.get(t.geoid)?.after ?? t.fei ?? null]));
    return Object.fromEntries(tracts.rows.map((t) => [t.geoid, after.has(t.geoid) ? after.get(t.geoid)!.before - after.get(t.geoid)!.after : null]));
  }, [tracts.rows, view, after]);
  const base = useLayerFill(layer, unit, tracts.rows, settings.colorSafe);
  const changeScale = useMemo(
    () => makeScale(Object.values(view === "change" && override ? override : {}), "gain", theme, { domain: [0, Math.max(0.5, ...Object.values(override ?? {}).map((v) => v ?? 0))] }),
    [override, view, theme],
  );
  const fill = useMemo(() => {
    if (view === "after") {
      // Same scale as "today" so colors compare directly.
      return (id: string) => {
        const v = override?.[id];
        return v == null ? null : base.scale.color(v);
      };
    }
    if (view === "change")
      return (id: string) => {
        const v = override?.[id];
        return v != null && v > 0 ? changeScale.color(v) : base.fill(id);
      };
    return base.fill;
  }, [view, override, base, changeScale]);
  const dim = useMemo(
    () => (view === "change" ? (id: string) => !((override?.[id] ?? 0) > 0) : undefined),
    [view, override],
  );

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = candidates.map((c) => ({
      id: `cand-${c.rank}`,
      kind: "candidate",
      lon: c.lon,
      lat: c.lat,
      label: String(c.rank),
      active: activeRank === c.rank,
      title: `Option ${c.rank}: ${countiesByFips[c.county]?.name} County`,
      onClick: () => {
        setActiveRank(c.rank);
        setSite({ lon: c.lon, lat: c.lat, fips: c.county, label: `Option ${c.rank}` });
        setView("change");
        setTab("impact");
        focusSite(c.lon, c.lat, !!countiesByFips[c.county]?.nonmetro);
      },
    }));
    if (site)
      out.push({
        id: "site",
        kind: "site",
        lon: site.lon,
        lat: site.lat,
        label: activeRank ? String(activeRank) : "+",
        ringsMiles: rural ? [10, 30] : [1, 10],
        title: site.label,
      });
    return out;
  }, [candidates, activeRank, site, rural]);

  const runOptimizer = async () => {
    if (!tracts.rows) return;
    hasSearched.current = true;
    cancel.current && (cancel.current.cancelled = true);
    const signal = { cancelled: false };
    cancel.current = signal;
    setRunning(true);
    setProgress(0);
    setSearchMessage(null);
    setCandidates([]);
    setActiveRank(null);
    const scope =
      scopeKind === "county"
        ? [scopeCounty]
        : scopeKind === "topq"
          ? research.counties.filter((c) => (c.fei?.quintile ?? 0) === 5).map((c) => c.fips)
          : [];
    try {
      const picks = await optimizeSites({
        objective,
        type,
        money,
        assumptions,
        manual: sizing === "manual" ? manual : null,
        feiTracts: tracts.rows,
        counties: scope,
        count: 5,
        spacingMiles: spacing,
        onProgress: setProgress,
        signal,
      });
      if (signal.cancelled) return;
      setRunning(false);
      setCandidates(picks);
      setSearchMessage(picks.length ? null : "No improving options under these settings. Try a wider area, another objective, or place a site manually.");
      if (picks[0]) {
        setActiveRank(1);
        setSite({ lon: picks[0].lon, lat: picks[0].lat, fips: picks[0].county, label: "Option 1" });
        setView("change");
        setFocusState(boxAround(picks, 25));
      }
    } catch (e) {
      if (!signal.cancelled) setSearchMessage(e instanceof Error ? e.message : String(e));
    } finally {
      if (!signal.cancelled) setRunning(false);
    }
  };

  const save = async () => {
    if (!result || !site || !fc) return;
    setSaving(true);
    setSaveError(null);
    try {
      await store.saveScenario({
        name: name || `${TYPES.find((t) => t.id === type)?.label} · ${county?.name} County`,
        kind: "new_shelf",
        payload: {
          input: result.input,
          assumptions,
          methodVersion: "scenario-assumptions-v2",
          summary: {
            county: county?.name,
            feiCountyBefore: result.fei.countyBefore ?? null,
            feiCountyAfter: result.fei.countyAfter ?? null,
            residentsNewlyWithin: result.residentsNewlyWithin,
            residentsCloser: result.residentsCloser,
            forecastVisits: result.input.householdsPerMonth,
            forecastPounds: result.input.poundsPerMonth,
            annualCost: result.dollars.annualCost,
            foodValue: result.dollars.foodValue,
            travelSavings: result.dollars.travelSavings,
            netNewValue: result.dollars.netNewValue,
            driveResidentsCloser: drive.reach?.residentsCloser ?? null,
            driveMinutesSaved: drive.reach?.avgMinutesSaved ?? null,
            driveResidentsNewlyWithin: drive.reach?.residentsNewlyWithin ?? null,
          },
        },
      });
      await refresh();
      setSaved(saveKey);
    } catch (e) {
      setSaveError(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const exportCandidates = () =>
    downloadText(
      "foodbridge-site-options.csv",
      toCsv(
        candidates.map((c) => ({
          option: c.rank,
          county: countiesByFips[c.county]?.name,
          tract_geoid: c.geoid,
          objective,
          additional_visits_pct: assumptions.additionalVisitsPct,
          additional_supply_pct: assumptions.additionalSupplyPct,
          method_version: "scenario-assumptions-v2",
          score: Math.round(c.score * 100) / 100,
          scenario_visits_month: c.evaluation.result.input.householdsPerMonth,
          scenario_PoundsReg_month: c.evaluation.result.input.poundsPerMonth,
          residents_newly_within: Math.round(c.evaluation.result.residentsNewlyWithin),
          county_fei_before: c.evaluation.result.fei.countyBefore?.toFixed(2) ?? "",
          county_fei_after: c.evaluation.result.fei.countyAfter?.toFixed(2) ?? "",
          net_new_value_year: Math.round(c.evaluation.result.dollars.netNewValue),
          annual_cost: Math.round(c.evaluation.result.dollars.annualCost),
        })),
      ),
    );

  const scenarios = data.scenarios.filter((s) => s.kind === "new_shelf");
  const improvedTracts = useMemo(
    () =>
      (result?.affected ?? [])
        .filter((a) => a.feiBefore != null && a.feiAfter != null && a.feiBefore - a.feiAfter > 1e-6)
        .sort((a, b) => b.feiBefore! - b.feiAfter! - (a.feiBefore! - a.feiAfter!))
        .slice(0, 5),
    [result],
  );
  const feiDrop = result?.fei.status === "ready" ? (result.fei.countyBefore ?? 0) - (result.fei.countyAfter ?? 0) : null;

  const hoverCard = (id: string) => {
    const t = tracts.byId.get(id);
    const a = after.get(id);
    const eff = result?.affected.find((x) => x.geoid === id);
    if (!t) return <div className="font-semibold text-ink">{countiesByFips[id]?.name ?? id} County</div>;
    return (
      <div>
        <div className="font-semibold text-ink">
          {t.name} · {countiesByFips[t.county]?.name} County
        </div>
        <div className="mt-1 space-y-0.5 text-ink-2">
          <div className="flex justify-between gap-4">
            <span>{EQUITY_SHORT}</span>
            <span className="tabular font-semibold text-ink">
              {a ? `${fmt.num(a.before, 1)} → ${fmt.num(a.after, 1)}` : fmt.num(t.fei, 1)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Miles to nearest shelf</span>
            <span className="tabular font-semibold text-ink">
              {eff ? `${fmt.num(eff.milesBefore, 1)} → ${fmt.num(eff.milesAfter, 1)}` : fmt.num(t.d, 1)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Residents</span>
            <span className="tabular text-ink">{fmt.int(t.pop)}</span>
          </div>
        </div>
        <div className="mt-1 text-[11px] text-muted">{mode === "manual" ? "Click to place the site here" : "Switch to manual to place a site"}</div>
      </div>
    );
  };

  const resultsContent = (
    <>
        {!result || !fc || !county ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-accent">
                <Icon name="target" className="h-6 w-6" />
              </span>
              <h2 className="mt-3 text-[15px] font-semibold text-ink">No site yet</h2>
              <p className="mt-1 max-w-[280px] text-[12.5px] text-muted">
                Run the search for ranked options, or switch to manual and click the map. The forecast, FEI change, reach and dollar
                value appear here.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{site?.label}</div>
                  <h2 className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">
                    {TYPES.find((t) => t.id === type)?.short} in {county.name} County
                  </h2>
                  <p className="tabular mt-0.5 text-[11.5px] text-muted">
                    {county.nonmetro ? "Nonmetro" : "Metro"} · {site!.lat.toFixed(3)}°, {site!.lon.toFixed(3)}° · catchment{" "}
                    {fmt.int(fc.catchmentResidents)} residents in {fc.catchmentTracts} tracts · map rings{" "}
                    {rural ? "10 mi (LILA) and 30 mi" : "1 mi (LILA) and 10 mi"}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
                  <Icon name="save" /> {saving ? "Saving…" : saved === saveKey ? "Saved" : "Save"}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Kpi
                  icon="users"
                  label="Visits"
                  value={fmt.int(sizing === "manual" ? manual.visits : fc.visits)}
                  sub={sizing === "manual" ? "Per month · your size" : `Per month · range ${fmt.int(fc.visitsLo)}–${fmt.int(fc.visitsHi)}`}
                />
                <Kpi
                  icon="index"
                  tone={feiDrop && feiDrop > 0 ? "good" : undefined}
                  label="County FEI"
                  value={result.fei.status === "ready" ? `−${fmt.num(feiDrop, 2)}` : "—"}
                  sub={result.fei.status === "ready" ? `${fmt.num(result.fei.countyBefore, 1)} → ${fmt.num(result.fei.countyAfter, 1)} · ${result.fei.tractsImproved} tracts improve` : result.fei.reason}
                />
                <Kpi icon="pin" label="New in reach" value={fmt.int(result.residentsNewlyWithin)} sub={`${fmt.int(result.lowIncomeNewlyWithin)} below 200% of poverty`} />
                <Kpi
                  icon="dollar"
                  label="Scenario value / yr"
                  value={fmt.usd(result.dollars.netNewValue)}
                  sub={`${fmt.usd(result.dollars.newValuePerDollar, 2)} per $1 of cost · gross ${fmt.usd(result.dollars.valuePerDollar, 2)}`}
                />
              </div>
              {sizing === "manual" && (
                <p className="mt-2 text-[11.5px] text-[var(--warning-text)]">Manual size in use: FEI and dollars use your visits and pounds.</p>
              )}
            </div>

            <Block title="Scenario activity" icon="history" aside={<Badge>Assumptions</Badge>}>
              <p className="mb-2 text-[11.5px] text-muted">Historical planning example at August 2026 forecast rates. Site activity and ranges are unvalidated scenarios. Visits = HouseholdsReg; pounds = PoundsReg.</p>
              <StackedBar
                parts={[
                  { key: "s", label: "Shifted from today's shelves", value: fc.shifted * (sizing === "manual" && fc.visits ? manual.visits / fc.visits : 1), color: "var(--seq-3)" },
                  { key: "i", label: "Assumed additional visits", value: fc.induced * (sizing === "manual" && fc.visits ? manual.visits / fc.visits : 1), color: "var(--accent)" },
                ]}
                format={(v) => fmt.int(v)}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Visits", sizing === "manual" ? manual.visits : fc.visits, "HouseholdsReg"],
                  ["Pounds", sizing === "manual" ? manual.pounds : fc.pounds, "PoundsReg"],
                  ["Individuals", fc.individuals * (sizing === "manual" && fc.visits ? manual.visits / fc.visits : 1), "IndividualsReg"],
                ].map(([k, v, f]) => (
                  <div key={k as string} className="rounded-lg bg-surface-2 px-2 py-2">
                    <div className="tabular text-[16px] font-semibold text-ink">{fmt.int(v as number)}</div>
                    <div className="text-[10.5px] text-muted" title={f as string}>
                      {k as string}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-medium text-muted">Individuals by age (ChildrenReg · AdultsReg · SeniorsReg)</div>
                <StackedBar
                  parts={[
                    { key: "c", label: "Children", value: fc.children * (sizing === "manual" && fc.visits ? manual.visits / fc.visits : 1), color: "var(--age-children)" },
                    { key: "a", label: "Adults", value: fc.adults * (sizing === "manual" && fc.visits ? manual.visits / fc.visits : 1), color: "var(--age-adults)" },
                    { key: "s", label: "Seniors", value: fc.seniors * (sizing === "manual" && fc.visits ? manual.visits / fc.visits : 1), color: "var(--age-seniors)" },
                  ]}
                  format={(v) => fmt.int(v)}
                />
              </div>
              <SourceNote>
                Rates: {county.name} County&apos;s August 2026 forecast per resident (D-045)
                {fc.stateRatesUsed ? "; counties without a forecast use the state rate" : ""}.
                Additional visits: {fc.assumedAdditionalVisitsPct}% of shifted visits, an editable assumption.
                Additional network food: {assumptions.additionalSupplyPct}% of site pounds. Relocation losses at existing sites are not modelled.
              </SourceNote>
            </Block>

            <Block title="Equity index (FEI) impact" icon="index">
              {result.fei.status === "ready" ? (
                <>
                  <Line k={`${county.name} County FEI`} v={<Delta before={result.fei.countyBefore} after={result.fei.countyAfter} digits={2} />} />
                  <Line k="Statewide FEI (population-weighted)" v={<Delta before={result.fei.stateBefore} after={result.fei.stateAfter} digits={3} />} />
                  <Line
                    k="Residents in top-quintile tracts"
                    v={<Delta before={result.fei.topQuintileResidentsBefore} after={result.fei.topQuintileResidentsAfter} digits={0} />}
                  />
                  <Line k="Tracts that improve" v={fmt.int(result.fei.tractsImproved)} strong />
                  {improvedTracts.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 text-[11px] font-medium text-muted">Largest tract improvements</div>
                      <ul className="space-y-1">
                        {improvedTracts.map((a) => {
                          const d = a.feiBefore! - a.feiAfter!;
                          const top = improvedTracts[0].feiBefore! - improvedTracts[0].feiAfter!;
                          return (
                            <li key={a.geoid} className="grid grid-cols-[96px_1fr_44px] items-center gap-2 text-[11.5px]">
                              <span className="truncate text-ink-2">Tract {a.geoid.slice(5, 9)}.{a.geoid.slice(9)}</span>
                              <span className="h-1.5 rounded-full bg-surface-3">
                                <span className="block h-full rounded-full" style={{ width: `${(d / top) * 100}%`, background: changeScale.color(d) }} />
                              </span>
                              <span className="tabular text-right font-semibold text-ink">−{fmt.num(d, 1)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12.5px] text-muted">{result.fei.reason}</p>
              )}
            </Block>

            <Block title="Access and reach" icon="pin">
              <Line k="Newly within 1 mile urban / 10 miles rural" v={fmt.int(result.residentsNewlyWithin)} strong />
              <Line k="… of them below 200% of poverty (county share)" v={fmt.int(result.lowIncomeNewlyWithin)} />
              <Line k="… of them children (county share)" v={fmt.int(result.childrenNewlyWithin)} />
              <Line k="Residents whose nearest shelf gets closer" v={fmt.int(result.residentsCloser)} />
              <Line k="Average miles saved (those residents)" v={`${fmt.num(result.avgMilesSavedCloser, 1)} mi`} />
              <Line k="Miles saved per visit (visit-weighted)" v={`${fmt.num(fc.milesSavedPerVisit, 1)} mi`} />
              <Line
                k="Pounds per low-income resident (county)"
                v={<Delta before={result.poundsPerLowIncomeBefore} after={result.poundsPerLowIncomeAfter} better="up" />}
              />
            </Block>

            <Block
              title="Driving access"
              icon="route"
              aside={drive.status === "loading" ? <Badge>routing…</Badge> : drive.status === "ready" ? <Badge tone="green">road network</Badge> : undefined}
            >
              {drive.status === "ready" && drive.reach ? (
                <>
                  <Line k="Newly within 1 road mile urban / 10 rural" v={fmt.int(drive.reach.residentsNewlyWithin)} strong />
                  <Line k="Residents whose nearest shelf by road gets closer" v={fmt.int(drive.reach.residentsCloser)} />
                  <Line k="Average drive saved (those residents)" v={`${fmt.num(drive.reach.avgMinutesSaved, 1)} min · ${fmt.num(drive.reach.avgMilesSaved, 1)} mi`} />
                  <Line k={`Residents within ${DRIVE_MINUTES_RING} minutes' drive`} v={fmt.int(drive.reach.residentsWithin15Min)} />
                  <SourceNote>
                    OSRM car routing on OpenStreetMap (© OpenStreetMap contributors, ODbL) from tract centroids, against each
                    tract&apos;s population-weighted road distance to today&apos;s nearest reporting shelf. Free-flow driving: no
                    transit, walking or congestion. {fmt.int(drive.reach.tractsRouted)} tracts routed.
                  </SourceNote>
                </>
              ) : drive.status === "loading" ? (
                <div className="space-y-2" aria-busy="true" aria-label="Routing on the road network">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-surface-3" />
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-muted">Road routing is offline right now; the figures above use straight-line miles.</p>
              )}
            </Block>

            <Block title="Dollar value" icon="dollar" aside={<Badge>per year</Badge>}>
              <ValueBars
                rows={[
                  { label: "Food distributed at the site (wholesale)", value: result.dollars.foodValue, color: "var(--seq-3)", note: `${fmt.int(result.dollars.annualPounds)} lb · ${fmt.int(result.dollars.annualMeals)} meals` },
                  { label: "Scenario additional value", value: result.dollars.netNewValue, color: "var(--accent)", note: `${fmt.usd(result.dollars.newFoodValue)} additional food + ${fmt.usd(result.dollars.travelSavings)} travel avoided − ${fmt.usd(result.dollars.additionalTravelCost)} additional travel` },
                  { label: "Annual cost (operating + start-up spread)", value: result.dollars.annualCost, color: "var(--serious)" },
                ]}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="text-[10.5px] text-muted">Cost per meal · per visit</div>
                  <div className="tabular text-[13px] font-semibold text-ink">
                    {fmt.usd(result.dollars.costPerMeal, 2)} · {fmt.usd(result.dollars.costPerVisit, 2)}
                  </div>
                </div>
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="text-[10.5px] text-muted">Cost per resident newly in reach</div>
                  <div className="tabular text-[13px] font-semibold text-ink">{fmt.usd(result.dollars.costPerResidentWithin)}</div>
                </div>
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="text-[10.5px] text-muted">Cost per county FEI point</div>
                  <div className="tabular text-[13px] font-semibold text-ink">{fmt.usd(result.dollars.costPerFeiPoint)}</div>
                </div>
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="text-[10.5px] text-muted">Net new value − cost</div>
                  <div className={cx("tabular text-[13px] font-semibold", result.dollars.netValue >= 0 ? "text-[var(--good-text)]" : "text-ink")}>
                    {fmt.usd(result.dollars.netValue)}
                  </div>
                </div>
              </div>
              <details className="mt-3 rounded-lg border border-line">
                <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-ink">Assumptions (edit to match your budget)</summary>
                <div className="space-y-3 border-t border-line p-3">
                  {ASSUMPTION_NOTES.map((a) => (
                    <div key={a.key} className="grid grid-cols-[110px_1fr] items-start gap-2">
                      <Input
                        type="number"
                        step="any"
                        aria-label={a.label}
                        value={money[a.key]}
                        onChange={(e) => setMoney({ ...money, [a.key]: Number(e.target.value) })}
                        className="h-8 text-[12.5px]"
                      />
                      <div className="text-[11px] leading-snug text-ink-2">
                        <span className="font-medium text-ink">
                          {a.label} ({a.unit})
                        </span>{" "}
                        <Badge tone={a.kind === "cited" ? "green" : a.kind === "example" ? "neutral" : "demo"}>{a.kind}</Badge>
                        <br />
                        {a.source}{" "}
                        {a.url && (
                          <a className="underline" href={a.url} target="_blank" rel="noreferrer noopener">
                            source
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              <SourceNote>
                Gross value counts all food at the site; most of it would otherwise be picked up elsewhere. Net new value counts only
                additional food for assumed new visits, plus avoided travel for shifted visits, less travel for new visits.
                Operating costs are placeholders. Estimates for comparing assumptions, not measured impact.
              </SourceNote>
            </Block>

            <div className="px-5 py-4">
              <SectionLabel>Saved site scenarios</SectionLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this scenario (optional)" className="mb-2 h-8 text-[12.5px]" />
              {scenarios.length === 0 ? (
                <p className="text-[12px] text-muted">None yet. Save one to compare later.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {scenarios.map((s) => {
                    const sum = (s.payload as { summary?: Record<string, number | string | null> }).summary ?? {};
                    return (
                      <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{s.name}</span>
                          <span className="tabular block text-muted">
                            FEI {sum.feiCountyBefore != null ? `${fmt.num(Number(sum.feiCountyBefore), 1)} → ${fmt.num(Number(sum.feiCountyAfter), 1)}` : "—"} ·{" "}
                            {fmt.int(Number(sum.residentsNewlyWithin))} in reach · {fmt.usd(Number(sum.annualCost))}/yr
                          </span>
                        </span>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-[var(--critical-text)]"
                          aria-label={`Delete ${s.name}`}
                          onClick={async () => {
                            await store.deleteScenario(s.id);
                            await refresh();
                          }}
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link href="/manager/allocation" className={cx(buttonClass("ghost", "sm"), "mt-3 w-full")}>
                <Icon name="truck" /> Supply allocation planner
              </Link>
            </div>
          </>
        )}
    </>
  );

  const planContent = (
    <>
      <div className="border-b border-line px-5 py-4">
        <Segmented<"manual" | "optimize">
          className="w-full"
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "optimize", label: "Find best sites", icon: "bolt" },
            { value: "manual", label: "Place manually", icon: "pin" },
          ]}
        />
      </div>
        <div className="border-b border-line px-5 py-4">
          <SectionLabel>Site type</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                aria-pressed={type === t.id}
                title={t.label}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11.5px] font-medium transition-colors",
                  type === t.id ? "border-accent bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:bg-surface-2",
                )}
              >
                <Icon name={t.icon} className={cx("h-4 w-4", type === t.id && "text-accent")} />
                {t.short}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">
            Reach vs a full-time food shelf: {Math.round(TYPE_REACH[type] * 100)}% (planning assumption).
          </p>
        </div>

        {mode === "optimize" ? (
          <div className="border-b border-line px-5 py-4">
            <SectionLabel>Optimize for</SectionLabel>
            <div className="space-y-1.5">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setObjective(o.id)}
                  aria-pressed={objective === o.id}
                  className={cx(
                    "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                    objective === o.id ? "border-accent bg-[var(--accent-soft)]" : "border-line hover:bg-surface-2",
                  )}
                >
                  <Icon name={o.icon} className={cx("mt-0.5 h-4 w-4 shrink-0", objective === o.id ? "text-accent" : "text-muted")} />
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink">{o.label}</span>
                    <span className="block text-[11px] leading-snug text-muted">{o.detail}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink-2">Search area</span>
                <Select value={scopeKind} onChange={(e) => setScopeKind(e.target.value as ScopeKind)}>
                  <option value="state">All of Minnesota</option>
                  <option value="topq">Counties in the top FEI quintile</option>
                  <option value="county">One county…</option>
                </Select>
              </label>
              {scopeKind === "county" && (
                <Select value={scopeCounty} onChange={(e) => setScopeCounty(e.target.value)} aria-label="County to search">
                  {research.counties.map((c) => (
                    <option key={c.fips} value={c.fips}>
                      {c.name} County
                    </option>
                  ))}
                </Select>
              )}
              <label className="block text-[12px] font-medium text-ink-2">
                Minimum spacing between options <span className="tabular text-muted">{spacing} mi</span>
                <input type="range" min={0} max={60} step={5} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="mt-1 w-full" />
              </label>
              <Button className="w-full" size="lg" onClick={runOptimizer} disabled={running || !tracts.rows}>
                <Icon name="bolt" /> {running ? "Searching tracts…" : tracts.rows ? "Find the 5 best sites" : "Loading tracts…"}
              </Button>
              {running && <><Progress value={progress} label="Search progress" /><Button variant="secondary" onClick={() => {
                if (cancel.current) cancel.current.cancelled = true;
                setRunning(false); setSearchMessage("Search cancelled. Adjust settings or run it again.");
              }}>Cancel search</Button></>}
              {searchMessage && <p role="status" className="text-[12px] text-ink-2">{searchMessage}</p>}
              {tracts.error && <p role="alert" className="text-[12px] text-[var(--critical-text)]">Could not load tract data. Reload the page to retry.</p>}
            </div>
            {candidates.length > 0 && (
              <div className="mt-4">
                <SectionLabel
                  action={
                    <button className="text-[11.5px] font-medium text-accent hover:underline" onClick={exportCandidates}>
                      Export CSV
                    </button>
                  }
                >
                  Ranked options
                </SectionLabel>
                <ol className="space-y-1.5">
                  {candidates.map((c, i) => {
                    const r = c.evaluation.result;
                    const isActive = activeRank === c.rank;
                    const road = candidateDrive[i];
                    return (
                      <li key={c.rank}>
                        <button
                          onClick={() => {
                            setActiveRank(c.rank);
                            setSite({ lon: c.lon, lat: c.lat, fips: c.county, label: `Option ${c.rank}` });
                            setView("change");
                            setTab("impact");
                            focusSite(c.lon, c.lat, !!countiesByFips[c.county]?.nonmetro);
                          }}
                          className={cx(
                            "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                            isActive ? "border-accent bg-[var(--accent-soft)]" : "border-line hover:bg-surface-2",
                          )}
                        >
                          <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold", isActive ? "bg-accent text-[var(--accent-ink)]" : "bg-surface-3 text-ink")}>
                            {c.rank}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium text-ink">
                              {countiesByFips[c.county]?.name} County
                              <span className="font-normal text-muted"> · tract {c.geoid.slice(5, 9)}</span>
                            </span>
                            <span className="tabular block text-[11px] text-muted">
                              {fmt.int(r.input.householdsPerMonth)} visits/mo · {fmt.compact(r.residentsNewlyWithin)} newly in reach
                              {r.fei.status === "ready" && ` · FEI −${fmt.num((r.fei.countyBefore ?? 0) - (r.fei.countyAfter ?? 0), 1)}`}
                            </span>
                            <span className="tabular block text-[11px] text-muted">
                              {road === undefined
                                ? "Routing by road…"
                                : road
                                  ? `${fmt.compact(road.residentsCloser)} closer by road · −${fmt.num(road.avgMinutesSaved, 1)} min drive`
                                  : "Road routing offline"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div className="border-b border-line px-5 py-4">
            <SectionLabel>Placement</SectionLabel>
            <p className="rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-2">
              <Icon name="pin" className="mr-1 inline h-3.5 w-3.5 text-accent" />
              Click anywhere on the map to drop the site. Results update instantly.
            </p>
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-medium text-ink-2">Or start at a county centre</span>
              <Select
                value=""
                onChange={(e) => {
                  const c = countiesByFips[e.target.value];
                  if (c?.centroid) {
                    setActiveRank(null);
                    setSite({ lon: c.centroid[0], lat: c.centroid[1], fips: c.fips, label: `${c.name} County centre` });
                    setFocus(c.fips);
                    setView("change");
                    setTab("impact");
                  }
                }}
              >
                <option value="">Choose a county…</option>
                {research.counties.map((c) => (
                  <option key={c.fips} value={c.fips}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        )}

        <div className="border-b border-line px-5 py-4">
          <SectionLabel>Site size</SectionLabel>
          <Segmented<"auto" | "manual">
            className="w-full"
            size="sm"
            label="Sizing"
            value={sizing}
            onChange={setSizing}
            options={[
              { value: "auto", label: "Use county rates" },
              { value: "manual", label: "Set my own" },
            ]}
          />
          {sizing === "manual" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-[11.5px] text-ink-2">
                Visits / month
                <Input type="number" min={0} value={manual.visits} onChange={(e) => setManual({ ...manual, visits: Math.max(0, Number(e.target.value)) })} />
              </label>
              <label className="block text-[11.5px] text-ink-2">
                PoundsReg / month
                <Input type="number" min={0} value={manual.pounds} onChange={(e) => setManual({ ...manual, pounds: Math.max(0, Number(e.target.value)) })} />
              </label>
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] leading-snug text-muted">
              Visits, pounds and ages come from the August 2026 county forecast for residents who would gain this site as their
              nearest shelf.
            </p>
          )}
          {fc && sizing === "manual" && (
            <button
              className="mt-2 text-[11.5px] font-medium text-accent hover:underline"
              onClick={() => setManual({ visits: Math.round(fc.visits), pounds: Math.round(fc.pounds) })}
            >
              Reset to forecast ({fmt.int(fc.visits)} visits · {fmt.int(fc.pounds)} lb)
            </button>
          )}
        </div>

        <div className="border-b border-line px-5 py-4">
          <SectionLabel>What are you assuming?</SectionLabel>
          <label className="block text-[12px] text-ink-2">
            Additional visits above shifted visits: {assumptions.additionalVisitsPct}%
            <input aria-label="Additional visits percent" type="range" min={0} max={MAX_ADDITIONAL_VISITS_PCT} step={5}
              value={assumptions.additionalVisitsPct} onChange={(e) => setAssumptions({ ...assumptions, additionalVisitsPct: Number(e.target.value) })} className="mt-1 w-full" />
          </label>
          <label className="mt-3 block text-[12px] text-ink-2">
            Site food added to the network: {assumptions.additionalSupplyPct}%
            <input aria-label="Additional network food percent" type="range" min={0} max={100} step={5}
              value={assumptions.additionalSupplyPct} onChange={(e) => setAssumptions({ ...assumptions, additionalSupplyPct: Number(e.target.value) })} className="mt-1 w-full" />
          </label>
          <p className="mt-2 text-[11.5px] text-muted">Both start at zero. A county correlation cannot tell us how many extra visits a new site creates. Only additional food raises the network supply total.</p>
        </div>

        <div className="px-5 py-4">
          <SourceNote>
            Approximation from tract averages: residents sit at tract centroids; distances are straight lines to the nearest
            reporting shelf (2024 network, validated shelf points, D-064), with driving access loaded separately from the road
            network; FEI change applies the FEI build&apos;s published formulas and bounds. Huff
            gravity share (exponent {HUFF_EXPONENT}); extra visits and supply are user assumptions.
            Ranked options are alternatives evaluated one at a time, not a joint expansion plan.
          </SourceNote>
        </div>
    </>
  );

  const optionIdx = candidates.findIndex((c) => c.rank === activeRank);
  const goOption = (i: number) => {
    const c = candidates[i];
    if (!c) return;
    setActiveRank(c.rank);
    setSite({ lon: c.lon, lat: c.lat, fips: c.county, label: `Option ${c.rank}` });
    setView("change");
    focusSite(c.lon, c.lat, !!countiesByFips[c.county]?.nonmetro);
  };

  const toolbarLegend =
    view === "change" ? (
      <LegendBar title="FEI improvement (points)" scale={changeScale} format={(v) => fmt.num(v, 1)} low="Small" high="Large" />
    ) : layer.categories && unit === "tract" ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{layer.short}</span>
        {layer.categories.map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
    ) : (
      <LegendBar
        title={view === "after" ? "FEI with the new site" : layer.short}
        scale={base.scale}
        format={layer.format}
        low={layer.low}
        high={layer.high}
      />
    );

  return (
    <div className="flex h-auto flex-col lg:h-[calc(100dvh-56px)] lg:flex-row">
      {/* ---------------- Map ---------------- */}
      {/* flex-1 only at lg: in the stacked layout a 0% flex-basis leaves the map's h-full child at zero height. */}
      <div className="flex min-h-0 min-w-0 flex-col lg:flex-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface px-4 py-2.5">
          <Segmented<View>
            label="Map view"
            value={view}
            onChange={setView}
            options={[
              { value: "today", label: "Today", icon: "map" },
              { value: "after", label: "With new site", icon: "pin", disabled: !site || !feiReady, title: "FEI with the new site" },
              { value: "change", label: "FEI change", icon: "index", disabled: !site || !feiReady, title: "Where FEI improves" },
            ]}
          />
          {mode === "manual" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11.5px] font-medium text-accent">
              <Icon name="pin" className="h-3.5 w-3.5" /> Click the map to place a site
            </span>
          )}
          <div className="min-w-[340px] flex-1">{toolbarLegend}</div>
        </div>
        <div className="relative h-[62vh] min-h-[420px] lg:h-auto lg:flex-1">
          <GeoMap
            geometry={tracts.geometry ?? research.geometry}
            fill={fill}
            dim={dim}
            fillOpacity={settings.opacity}
            hoverCard={hoverCard}
            outlines={tracts.geometry && overlays.outlines ? research.geometry : undefined}
            dashed={overlays.audit ? auditGeoms : undefined}
            hatch={overlays.lila ? tracts.lilaGeoms : undefined}
            markers={markers}
            onMapClick={
              mode === "manual"
                ? (lon, lat) => {
                    setActiveRank(null);
                    placeAt(lon, lat);
                  }
                : undefined
            }
            focus={focus}
            basemap={settings.basemap}
            showLabels={settings.labels}
            ariaLabel="Site planner map"
            fitPadding={[24, 56, 24, 24]}
          />
        </div>
      </div>

      {/* ---------------- Sidebar ---------------- */}
      <aside className="flex w-full shrink-0 flex-col border-l border-line bg-surface lg:h-full lg:w-[420px]">
        <div className="border-b border-line px-5 pb-3 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">Site planner</div>
          <h1 className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-ink">Where should a new site go?</h1>
          <Segmented<SideTab>
            className="mt-3 w-full"
            label="Sidebar"
            value={tab}
            onChange={setTab}
            options={[
              { value: "plan", label: "Plan", icon: "target" },
              { value: "impact", label: "Impact", icon: "dollar", disabled: !site },
              { value: "layers", label: "Layers", icon: "layers" },
            ]}
          />
        </div>
        <div className="fb-scroll min-h-0 flex-1 overflow-y-auto">
          {(saveError || evaluationError) && <p role="alert" className="p-4 text-[13px] text-[var(--critical-text)]">{saveError || evaluationError}</p>}
          {tab === "plan" && planContent}
          {tab === "impact" && (
            <>
              {candidates.length > 0 && optionIdx >= 0 && (
                <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-5 py-2 text-[12px]">
                  <button className="inline-flex items-center gap-1 font-medium text-accent hover:underline" onClick={() => setTab("plan")}>
                    <Icon name="back" className="h-3.5 w-3.5" /> All options
                  </button>
                  <span className="flex-1 text-center text-muted">
                    Option {optionIdx + 1} of {candidates.length}
                  </span>
                  <button
                    className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-surface-3 disabled:opacity-30"
                    disabled={optionIdx <= 0}
                    onClick={() => goOption(optionIdx - 1)}
                    aria-label="Previous option"
                  >
                    <Icon name="back" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-surface-3 disabled:opacity-30"
                    disabled={optionIdx >= candidates.length - 1}
                    onClick={() => goOption(optionIdx + 1)}
                    aria-label="Next option"
                  >
                    <Icon name="arrow" className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {resultsContent}
            </>
          )}
          {tab === "layers" && (
            <>
              <section className="border-b border-line px-5 py-4">
                <SectionLabel>Map layer (Today view)</SectionLabel>
                <LayerList
                  unit={unit}
                  layerId={layerId}
                  onLayer={(id) => {
                    setLayerId(id);
                    setView("today");
                  }}
                  allowed={(l) => !!l.tract}
                />
                <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-snug text-ink-2">{layerById(layerId).note}</p>
              </section>
              <section className="border-b border-line px-5 py-4">
                <SectionLabel>Overlays</SectionLabel>
                <OverlayControls unit={unit} overlays={overlays} onOverlays={setOverlays} shelves={false} />
              </section>
              <section className="px-5 py-4">
                <SectionLabel>Map style</SectionLabel>
                <StyleControls settings={settings} onSettings={setSettings} />
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
