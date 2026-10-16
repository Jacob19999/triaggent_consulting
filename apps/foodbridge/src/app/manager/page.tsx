"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertList } from "@/components/AlertList";
import { commandCenterInfo } from "@/components/commandCenterInfo";
import { BarList, StackedBar, TimeChart } from "@/components/charts";
import { CountyDetail, type CountyMonth } from "@/components/CountyDetail";
import { useData } from "@/components/DataProvider";
import { CountyMapCard } from "@/components/map/CountyMapCard";
import type { MapMarker } from "@/components/map/GeoMap";
import { useTractRows } from "@/components/map/useMapData";
import { PolicyWatch } from "@/components/PolicyWatch";
import { TYPE_COLOR, TYPE_GLYPH, TYPE_SHORT } from "@/components/siteTypeStyle";
import { useSitePoints } from "@/components/useSitePoints";
import { Badge, buttonClass, Card, Icon, PageHeader, Segmented, SeverityBadge, SourceNote, Stat } from "@/components/ui";
import { useSiteTypes } from "@/components/useSiteTypes";
import { SEVERITY_ORDER, type Severity } from "@/lib/alerts";
import { addMonths, monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { SITE_TYPES, type SiteType, type SiteTypeCell, type SiteTypeMix } from "@/lib/networks";
import { prioritize } from "@/lib/priority";
import { countiesByFips, EQUITY_LABEL, EQUITY_SHORT, equityValue, feiReady, research, SIGNAL_FIELD, SIGNAL_LABEL, SIGNALS } from "@/lib/research";
import type { HistoryRow, ShelfReport, Signal } from "@/lib/types";

const SIGNAL_COLOR: Record<Signal, string> = {
  HouseholdsTotal: "var(--sig-households)",
  PoundsTotal: "var(--sig-pounds)",
  IndividualsTotal: "var(--sig-individuals)",
};

type CountyHeat = "pounds" | "perResident" | "change";
type TractHeat = "miles" | "beyond10" | "fei";
type HeatMetric = CountyHeat | TractHeat;
const HEAT_OPTIONS: Record<"county" | "tract", { value: HeatMetric; label: string }[]> = {
  county: [
    { value: "pounds", label: "Pounds" },
    { value: "perResident", label: "Per resident" },
    { value: "change", label: "vs last year" },
  ],
  tract: [
    { value: "miles", label: "Miles to a shelf" },
    { value: "beyond10", label: "Beyond 10 mi" },
    { value: "fei", label: "FEI" },
  ],
};
type TypeFilter = "all" | SiteType;

const ratio = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b : null);
const change = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b - 1 : null);

/** Numbered band that groups the panels of one command-center section. */
function Section({ n, title, sub, children }: { n: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mt-8 first-of-type:mt-0" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
        <span className="tabular text-[11px] font-semibold text-accent">{n}</span>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">{title}</h2>
        {sub && <span className="text-[12px] text-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function YoY({ now, before, label = "vs a year earlier" }: { now: number | null | undefined; before: number | null | undefined; label?: string }) {
  const g = change(now, before);
  if (g == null) return <span className="text-muted">No year-earlier month</span>;
  return (
    <span>
      <span className={g >= 0 ? "font-semibold text-ink" : "font-semibold text-[var(--critical-text)]"}>
        {g > 0 ? "▲" : g < 0 ? "▼" : "•"} {fmt.signedPct(g, 1)}
      </span>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}

function sitesOf(types: SiteTypeMix | null, fips: string, filter: TypeFilter): number {
  const c = types?.counties[fips] ?? {};
  return filter === "all" ? Object.values(c).reduce((s, x) => s + (x?.sites ?? 0), 0) : (c[filter]?.sites ?? 0);
}

/** The map icon for one site type, as an inline legend swatch. */
function TypeIcon({ type, approx = false, size = 16 }: { type: SiteType; approx?: boolean; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: approx ? `color-mix(in srgb, ${TYPE_COLOR[type]} 22%, var(--surface))` : TYPE_COLOR[type],
        boxShadow: approx ? `inset 0 0 0 1.5px ${TYPE_COLOR[type]}` : undefined,
        outline: approx ? `1px dashed ${TYPE_COLOR[type]}` : undefined,
        outlineOffset: 1,
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke={approx ? TYPE_COLOR[type] : "#10202c"} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={TYPE_GLYPH[type]} />
      </svg>
    </span>
  );
}

/** Filter chips that double as the map's colour key for site types. */
function TypeChips({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: Record<SiteType, number>;
}) {
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
      active ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by site type">
      <button type="button" className={chip(value === "all")} aria-pressed={value === "all"} onClick={() => onChange("all")}>
        All types
      </button>
      {SITE_TYPES.map((t) => (
        <button key={t} type="button" className={chip(value === t)} aria-pressed={value === t} onClick={() => onChange(value === t ? "all" : t)}>
          <TypeIcon type={t} size={15} />
          {TYPE_SHORT[t]}
          <span className="tabular text-muted">{fmt.int(counts[t])}</span>
        </button>
      ))}
    </div>
  );
}

function sumReports(rows: ShelfReport[]) {
  return rows.reduce(
    (s, r) => ({
      households: s.households + r.households,
      individuals: s.individuals + r.individuals,
      pounds: s.pounds + r.pounds_distributed,
      children: s.children + r.children,
      adults: s.adults + r.adults,
      seniors: s.seniors + r.seniors,
    }),
    { households: 0, individuals: 0, pounds: 0, children: 0, adults: 0, seniors: 0 },
  );
}

function ytd(history: HistoryRow[], end: string, k: Signal) {
  const year = end.slice(0, 4);
  return history.filter((h) => h.month.startsWith(year) && h.month <= end).reduce((s, h) => s + (h[k] ?? 0), 0);
}

export default function ManagerDashboard() {
  const { ready, data, alerts, outlooks, asOf, session, error, alertState } = useData();
  const [signal, setSignal] = useState<Signal>("HouseholdsTotal");
  const [range, setRange] = useState<"24" | "all">("24");
  const [heat, setHeat] = useState<HeatMetric>("pounds");
  const [heatGeo, setHeatGeo] = useState<"county" | "tract">("county");
  const switchHeatGeo = (g: "county" | "tract") => {
    setHeatGeo(g);
    setHeat(HEAT_OPTIONS[g][0].value);
  };
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showCenters, setShowCenters] = useState(true);
  const [geography, setGeography] = useState<"county" | "tract">("tract");
  const [county, setCounty] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  // Select a county and bring its detail panel into view below the map.
  const pickCounty = (fips: string) => {
    setCounty((cur) => (cur === fips ? null : fips));
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const info = useMemo(() => commandCenterInfo(asOf, session.mode), [asOf, session.mode]);

  // ---- Statewide research snapshot (fixed cutoff, q4_state_month.csv) ----
  const end = research.meta.observed_end;
  const last = research.history.find((h) => h.month === end);
  const yearAgo = research.history.find((h) => h.month === addMonths(end, -12));
  const fcVisits = research.findings.stats.q7_state.find((r) => r.signal === "HouseholdsTotal");
  const stateFc = research.findings.stats.q7_state.find((r) => r.signal === signal);
  const history = (range === "24" ? research.history.slice(-24) : research.history).map((h) => ({ month: h.month, value: h[signal] }));
  const ytdNow = ytd(research.history, end, signal);
  const ytdBefore = ytd(research.history, addMonths(end, -12), signal);
  const peak = research.history.slice(-12).reduce<HistoryRow | null>((p, h) => ((h[signal] ?? 0) > (p?.[signal] ?? -1) ? h : p), null);

  // ---- Alerts ----
  const openAlerts = alerts.filter((a) => (alertState(a.key)?.status ?? "open") !== "resolved");
  const bySeverity = (s: Severity) => openAlerts.filter((a) => a.severity === s).length;
  const shelfAlerts = openAlerts.filter((a) => a.scope === "shelf");
  const actionable = openAlerts.filter((a) => a.scope !== "network" && a.severity !== "info");
  const priorities = useMemo(() => prioritize(outlooks).slice(0, 5), [outlooks]);

  // ---- Workspace month (county networks in demo, shelf reports when live) ----
  const monthReports = useMemo(() => data.reports.filter((r) => r.month === asOf), [data.reports, asOf]);
  const priorReports = useMemo(() => data.reports.filter((r) => r.month === addMonths(asOf, -12)), [data.reports, asOf]);
  const byCounty = useMemo(() => {
    const fipsOf = new Map(data.shelves.map((s) => [s.id, s.county_fips]));
    const group = (rows: ShelfReport[]) => {
      const m = new Map<string, ShelfReport[]>();
      rows.forEach((r) => {
        const f = fipsOf.get(r.shelf_id);
        if (f) m.set(f, [...(m.get(f) ?? []), r]);
      });
      return new Map([...m].map(([f, rs]) => [f, sumReports(rs)]));
    };
    return { now: group(monthReports), before: group(priorReports) };
  }, [data.shelves, monthReports, priorReports]);
  const mix = sumReports(monthReports);
  const countyMonths = useMemo(() => {
    if (!county) return [];
    const ids = new Set(data.shelves.filter((s) => s.county_fips === county).map((s) => s.id));
    const m = new Map<string, ShelfReport[]>();
    data.reports.forEach((r) => ids.has(r.shelf_id) && m.set(r.month, [...(m.get(r.month) ?? []), r]));
    return [...m]
      .map(([month, rs]): CountyMonth => ({ month, ...sumReports(rs) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [county, data.shelves, data.reports]);

  const tracts = useTractRows();
  const tractHeat = heatGeo === "tract" && !!tracts.rows && !!tracts.geometry;

  // ---- Centers by type (research snapshot, Organization.AgencyType counts) ----
  const { mix: types, error: typesError } = useSiteTypes();
  const typeTotals = useMemo(() => {
    const t = Object.fromEntries(SITE_TYPES.map((k) => [k, { sites: 0, households: 0, pounds: 0 }])) as Record<SiteType, { sites: number; households: number; pounds: number }>;
    for (const county of Object.values(types?.counties ?? {}))
      for (const [k, cell] of Object.entries(county) as [SiteType, SiteTypeCell][]) {
        t[k].sites += cell.sites;
        t[k].households += cell.households ?? 0;
        t[k].pounds += cell.pounds ?? 0;
      }
    return t;
  }, [types]);
  const totalSites = SITE_TYPES.reduce((s, k) => s + typeTotals[k].sites, 0);
  const totalTypedPounds = SITE_TYPES.reduce((s, k) => s + typeTotals[k].pounds, 0);
  const sitesIn = (fips: string) => sitesOf(types, fips, typeFilter);
  const typeCounts = Object.fromEntries(SITE_TYPES.map((k) => [k, typeTotals[k].sites])) as Record<SiteType, number>;

  // Heatmap: county pounds (all sites from the workspace, or one type's PoundsReg from the
  // type table), or a tract access measure; pounds have no tract grain.
  const heatValues = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (tractHeat) {
      for (const t of tracts.rows!)
        out[t.geoid] = heat === "miles" ? (t.d ?? null) : heat === "beyond10" ? (t.b10 == null ? null : t.b10 * 100) : (t.fei ?? null);
      return out;
    }
    for (const c of research.counties) {
      const now = typeFilter === "all" ? byCounty.now.get(c.fips)?.pounds : types?.counties[c.fips]?.[typeFilter]?.pounds;
      const before = typeFilter === "all" ? byCounty.before.get(c.fips)?.pounds : types?.prior.counties[c.fips]?.[typeFilter]?.pounds;
      const g = change(now, before);
      out[c.fips] = heat === "pounds" ? (now ?? null) : heat === "perResident" ? ratio(now, c.population) : g == null ? null : g * 100;
    }
    return out;
  }, [heat, byCounty, types, typeFilter, tractHeat, tracts.rows]);

  // Every reporting site at its researched coordinates (D-063), filtered by type.
  const { sites, error: sitesError } = useSitePoints();
  const shownSites = useMemo(() => (sites?.points ?? []).filter((p) => typeFilter === "all" || p.type === typeFilter), [sites, typeFilter]);
  const markers: MapMarker[] = useMemo(
    () =>
      showCenters
        ? shownSites.map((p, i) => ({
            id: `site-${i}-${p.lon}-${p.lat}`,
            kind: "type" as const,
            lon: p.lon,
            lat: p.lat,
            color: TYPE_COLOR[p.type],
            glyph: TYPE_GLYPH[p.type],
            approx: p.approx,
            active: p.county === county,
            title: `${TYPE_SHORT[p.type]} · ${countiesByFips[p.county]?.name ?? ""} County · ${p.approx ? "approximate location (area centre)" : "street address"}`,
            onClick: () => pickCounty(p.county),
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showCenters, shownSites, county],
  );
  const topCounties = research.counties
    .map((c) => ({ key: c.fips, label: c.name, value: types ? sitesIn(c.fips) : null }))
    .filter((r) => r.value)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 6);

  // ---- FEI ----
  const showTracts = geography === "tract" && !!tracts.rows && !!tracts.geometry;
  const equity = useMemo(
    () =>
      showTracts
        ? Object.fromEntries(tracts.rows!.map((t) => [t.geoid, t.fei ?? null]))
        : Object.fromEntries(research.counties.map((c) => [c.fips, equityValue(c)])),
    [tracts.rows, showTracts],
  );
  const robust = useMemo(() => new Set(research.counties.filter((c) => c.robust).map((c) => c.fips)), []);
  const feiTop = research.counties
    .filter((c) => equityValue(c) != null)
    .sort((a, b) => (equityValue(b) ?? 0) - (equityValue(a) ?? 0))
    .slice(0, 5);

  // ---- Requests ----
  const activeRequests = data.requests.filter((r) => r.status === "open" || r.status === "in_progress");
  const reqCount = (s: string) => data.requests.filter((r) => r.status === s).length;
  const shelfOf = (id: string) => data.shelves.find((s) => s.id === id);
  const inCounty = (shelfId?: string) => !!shelfId && shelfOf(shelfId)?.county_fips === county;
  const countyAlerts = county ? openAlerts.filter((a) => (a.fips ? a.fips.slice(0, 5) === county : inCounty(a.shelfId))).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) : [];
  const countyRequests = county ? data.requests.filter((r) => inCounty(r.shelf_id)) : [];

  const typeTag = typeFilter === "all" ? "" : ` · ${TYPE_SHORT[typeFilter]}`;
  const heatLabel = tractHeat
    ? heat === "miles"
      ? "Miles to the nearest reporting shelf · tracts"
      : heat === "beyond10"
        ? "% of residents beyond 10 miles · tracts"
        : `${EQUITY_SHORT} · tracts`
    : (heat === "pounds" ? `PoundsReg · ${monthLabel(asOf)}` : heat === "perResident" ? `Lb per resident · ${monthLabel(asOf)}` : `PoundsReg vs ${monthLabel(addMonths(asOf, -12))}`) + typeTag;
  const heatFormat = (v: number) =>
    heat === "pounds" ? fmt.compact(v) : heat === "perResident" ? fmt.num(v, 1) : heat === "change" ? `${v > 0 ? "+" : ""}${fmt.num(v, 0)}%` : heat === "miles" ? fmt.num(v, 1) : fmt.num(v, 0) + (heat === "beyond10" ? "%" : "");

  return (
    <>
      <PageHeader
        eyebrow="Manager workspace"
        title="Command center"
        description={
          <>
            Where the network stands for {monthLabel(asOf, "long")}, how it is trending, where food goes and through which kinds of centers, what needs
            attention, and which policies and shelf requests to act on. Click{" "}
            <span className="inline-grid h-[16px] w-[16px] place-items-center rounded-full border border-line-strong align-[-2px] text-[10px] font-semibold text-muted">i</span>{" "}
            on any panel for what it shows and how it is calculated.
          </>
        }
        actions={
          <>
            <Link href="/manager/scenarios" className={buttonClass("secondary")}>
              <Icon name="target" /> Plan a site
            </Link>
            <Link href="/manager/briefing" className={buttonClass("primary")}>
              <Icon name="spark" /> Generate briefing
            </Link>
          </>
        }
      />
      {error && (
        <p className="mb-4 rounded-lg border border-line bg-surface p-3 text-[13px] text-[var(--critical-text)]">
          Could not load workspace data: {error}
        </p>
      )}

      {/* 01 · Statewide activity */}
      <Section n="01" title="Statewide activity" sub={`Current overview · ${monthLabel(end, "long")}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Stat info={info.sites} icon="store" label="Shelves reporting" value={fmt.int(last?.sites)} sub={<span className="text-muted">{fmt.int(yearAgo?.sites)} a year earlier</span>} />
          <Stat info={info.visits} icon="users" accent={SIGNAL_COLOR.HouseholdsTotal} label="Visits" value={fmt.compact(last?.HouseholdsTotal)} sub={<YoY now={last?.HouseholdsTotal} before={yearAgo?.HouseholdsTotal} />} />
          <Stat info={info.pounds} icon="box" accent={SIGNAL_COLOR.PoundsTotal} label="Pounds distributed" value={fmt.compact(last?.PoundsTotal)} sub={<YoY now={last?.PoundsTotal} before={yearAgo?.PoundsTotal} />} />
          <Stat info={info.individuals} icon="user" accent={SIGNAL_COLOR.IndividualsTotal} label="Individuals served" value={fmt.compact(last?.IndividualsTotal)} sub={<YoY now={last?.IndividualsTotal} before={yearAgo?.IndividualsTotal} />} />
          <Stat info={info.forecast} icon="history" accent="var(--seq-3)" tone="forecast" label={`Visits · ${monthLabel(research.meta.forecast_target)}`} value={fmt.compact(fcVisits?.yhat)} sub={<span className="text-muted">Q7 county forecasts summed (D-045)</span>} />
          <Stat
            info={info.alerts}
            icon="bell"
            accent="var(--critical)"
            label="Open alerts"
            value={fmt.int(openAlerts.filter((a) => a.severity !== "info").length)}
            sub={
              <span className="flex flex-wrap gap-x-2 text-muted">
                <span>{bySeverity("critical")} critical</span>
                <span>{bySeverity("serious")} serious</span>
                <span>{bySeverity("warning")} warning</span>
              </span>
            }
          />
        </div>
        <SourceNote>
          Statewide broad reporting network (food_shelf_broad): HouseholdsReg, PoundsReg, IndividualsReg from outputs/tables/q4_state_month.csv, observed
          through {monthLabel(end)}. Reporting counts do not measure completeness. {monthLabel(research.meta.forecast_target)} is forecast only.
        </SourceNote>
      </Section>

      {/* 02 · Trends and stats */}
      <Section n="02" title="Trends & stats" sub="Monthly series and the ratios behind them">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <Card
            title="Trends"
            icon="index"
            info={info.trends}
            subtitle={`${SIGNAL_LABEL[signal]} (${SIGNAL_FIELD[signal]}) by month, with the ${monthLabel(research.meta.forecast_target, "long")} internal forecast.`}
            actions={
              <>
                <Segmented<Signal> size="sm" label="Signal" value={signal} onChange={setSignal} options={SIGNALS.map((s) => ({ value: s, label: SIGNAL_LABEL[s] }))} />
                <Segmented<"24" | "all"> size="sm" label="Range" value={range} onChange={setRange} options={[{ value: "24", label: "24 mo" }, { value: "all", label: "All" }]} />
              </>
            }
          >
            <TimeChart
              points={history}
              color={SIGNAL_COLOR[signal]}
              label={SIGNAL_LABEL[signal]}
              forecast={stateFc ? { month: research.meta.forecast_target, yhat: stateFc.yhat, lo80: stateFc.yhat, hi80: stateFc.yhat, lo95: stateFc.yhat, hi95: stateFc.yhat } : null}
            />
            <SourceNote>
              outputs/tables/q4_state_month.csv · outputs/forecasts/q7_august2026_state.csv (sum of {stateFc?.counties ?? 86} county forecasts; county bands are
              not additive, so none is drawn).
            </SourceNote>
          </Card>

          <Card title="Key stats" icon="scale" info={info.keyStats} subtitle={`${monthLabel(end)} vs ${monthLabel(addMonths(end, -12))} unless noted`}>
            <dl className="divide-y divide-line text-[13px]">
              {[
                ["Pounds per visit", fmt.num(ratio(last?.PoundsTotal, last?.HouseholdsTotal), 1), <YoY key="ppv" now={ratio(last?.PoundsTotal, last?.HouseholdsTotal)} before={ratio(yearAgo?.PoundsTotal, yearAgo?.HouseholdsTotal)} label="" />],
                ["Individuals per visit", fmt.num(ratio(last?.IndividualsTotal, last?.HouseholdsTotal), 2), <YoY key="ipv" now={ratio(last?.IndividualsTotal, last?.HouseholdsTotal)} before={ratio(yearAgo?.IndividualsTotal, yearAgo?.HouseholdsTotal)} label="" />],
                [`${SIGNAL_LABEL[signal]}, Jan–${monthLabel(end).split(" ")[0]} ${end.slice(0, 4)}`, fmt.compact(ytdNow), <YoY key="ytd" now={ytdNow} before={ytdBefore} label="year to date" />],
                [`Peak month (last 12) · ${SIGNAL_LABEL[signal]}`, peak ? monthLabel(peak.month) : "—", <span key="pk" className="text-muted">{fmt.compact(peak?.[signal])}</span>],
                ["Working days", `${last?.workdays ?? "—"} in ${monthLabel(end)}`, <span key="wd" className="text-muted">Totals move with working days (≈0.6 elasticity)</span>],
              ].map(([k, v, d]) => (
                <div key={String(k)} className="grid grid-cols-[1fr_auto] gap-x-3 py-2">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="tabular text-right font-semibold text-ink">{v}</dd>
                  <dd className="col-span-2 text-[12px]">{d}</dd>
                </div>
              ))}
            </dl>
            {mix.individuals > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Who was served · {monthLabel(asOf)}</div>
                <StackedBar
                  format={(v) => fmt.pct(v / mix.individuals, 0)}
                  parts={[
                    { key: "c", label: "Children", value: mix.children, color: "var(--sig-households)" },
                    { key: "a", label: "Adults", value: mix.adults, color: "var(--sig-individuals)" },
                    { key: "s", label: "Seniors", value: mix.seniors, color: "var(--sig-pounds)" },
                  ]}
                />
                <SourceNote>ChildrenReg, AdultsReg, SeniorsReg summed over the workspace{session.mode === "demo" ? "'s county networks" : ""}.</SourceNote>
              </div>
            )}
          </Card>
        </div>
      </Section>

      {/* 03 · Food distribution and centers */}
      <Section n="03" title="Food distribution & centers" sub="Where pounds go, through which kinds of reporting sites, and how each county is changing">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
          <CountyMapCard
            title="Food distribution heatmap"
            info={info.heatmap}
            subtitle={
              tractHeat
                ? "Census tracts: how far residents live from a reporting shelf. Pounds are reported by site and summed by county, so they have no tract view."
                : `Pounds distributed by county, ${monthLabel(asOf, "long")}${typeTag ? `, ${TYPE_SHORT[typeFilter as SiteType].toLowerCase()} sites only` : ""}. Select a county or a site for its trends.`
            }
            values={heatValues}
            ramp={heat === "change" ? "div" : heat === "fei" ? "risk" : "seq"}
            domain={heat === "change" ? [-50, 50] : heat === "fei" || heat === "beyond10" ? [0, 100] : undefined}
            low={heat === "change" ? "Fewer pounds" : tractHeat ? "Closer" : "Less"}
            high={heat === "change" ? "More pounds" : tractHeat ? "Farther / more barriers" : "More"}
            format={heatFormat}
            legendTitle={heatLabel}
            markers={markers}
            geometry={tractHeat ? tracts.geometry! : undefined}
            unitName={tractHeat ? (id) => `${tracts.byId.get(id)?.name ?? id} · ${countiesByFips[id.slice(0, 5)]?.name} County` : undefined}
            selected={tractHeat ? null : county}
            onSelect={(id) => pickCounty(id.slice(0, 5))}
            height="clamp(380px, 48vw, 560px)"
            actions={
              <div className="flex w-full flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented<"county" | "tract">
                    size="sm"
                    label="Heatmap geography"
                    value={tractHeat ? "tract" : "county"}
                    onChange={switchHeatGeo}
                    options={[
                      { value: "county", label: "Counties" },
                      { value: "tract", label: tracts.error ? "Tracts unavailable" : tracts.rows ? "Census tracts" : "Tracts loading…", disabled: !tracts.rows || !tracts.geometry, title: tracts.error ?? undefined },
                    ]}
                  />
                  <Segmented<HeatMetric> size="sm" label="Heatmap measure" value={heat} onChange={setHeat} options={HEAT_OPTIONS[tractHeat ? "tract" : "county"]} />
                  <Segmented<"on" | "off"> size="sm" label="Show sites" value={showCenters ? "on" : "off"} onChange={(v) => setShowCenters(v === "on")} options={[{ value: "on", label: "Sites" }, { value: "off", label: "Hide" }]} />
                </div>
                {types?.month && <TypeChips value={typeFilter} onChange={setTypeFilter} counts={typeCounts} />}
              </div>
            }
            extra={(id) => {
              if (tractHeat) {
                const t = tracts.byId.get(id);
                return (
                  <div className="mt-1 space-y-0.5 text-[11.5px] text-muted">
                    <div>
                      {fmt.num(t?.d, 1)} mi to the nearest shelf · {fmt.pct(t?.b10, 0)} beyond 10 mi
                    </div>
                    <div>
                      {EQUITY_SHORT} {fmt.num(t?.fei, 0)}
                      {t?.lila === 1 ? " · USDA LILA tract" : ""}
                    </div>
                    <div className="pt-0.5 text-accent">Click for county detail</div>
                  </div>
                );
              }
              const cells = types?.counties[id] ?? {};
              const prior = types?.prior.counties[id] ?? {};
              const now = byCounty.now.get(id);
              return (
                <div className="mt-1 space-y-0.5 text-[11.5px] text-muted">
                  {now && <div>{fmt.int(now.households)} visits · {fmt.int(now.pounds)} lb (all sites)</div>}
                  {SITE_TYPES.filter((t) => cells[t] || prior[t]).map((t) => {
                    const d = (cells[t]?.sites ?? 0) - (prior[t]?.sites ?? 0);
                    return (
                      <div key={t} className="flex items-center gap-1.5">
                        <TypeIcon type={t} size={13} />
                        <span className="text-ink-2">{cells[t]?.sites ?? 0}</span> {TYPE_SHORT[t].toLowerCase()}
                        {types?.prior.month && d !== 0 && <span>({d > 0 ? "+" : ""}{d} on a year earlier)</span>}
                      </div>
                    );
                  })}
                  <div className="pt-0.5 text-accent">Click for county detail</div>
                </div>
              );
            }}
            note={
              <span className="block space-y-1.5">
                {showCenters && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
                    {SITE_TYPES.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1">
                        <TypeIcon type={t} size={14} />
                        {TYPE_SHORT[t]}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1">
                      <TypeIcon type="Brick and Mortar Site" approx size={14} />
                      Approximate (city / ZIP centre)
                    </span>
                  </span>
                )}
                {showCenters && sites && (
                  <span className="block">
                    {fmt.int(sites.placed)} of {fmt.int(sites.sites)} sites reporting in {monthLabel(sites.month)} placed: {fmt.int(sites.exact)} at a street address,{" "}
                    {fmt.int(sites.placed - sites.exact)} at an area centre, {fmt.int(sites.unplaced)} without coordinates. Zoom in for icons.
                  </span>
                )}
                {showCenters && sitesError && <span className="block text-[var(--critical-text)]">Site locations unavailable: {sitesError}</span>}
                <span className="block">
                  {tractHeat
                    ? "Straight-line distance from 2020 block points to reporting shelves (D-051); FEI tract build."
                    : `PoundsReg from the workspace${session.mode === "demo" ? "'s county networks (statewide extract)" : ""}; ACS population. Pounds also reflect supply, not only demand.`}
                </span>
              </span>
            }
          />

          <Card
            title="Centers and their types"
            icon="store"
            info={info.centers}
            subtitle={`${fmt.int(totalSites)} reporting sites in ${types?.month ? monthLabel(types.month) : "the last month"}, by Organization.AgencyType`}
            actions={
              <Link href="/manager/map" className="text-[13px] font-medium text-accent underline">
                Map explorer
              </Link>
            }
          >
            {typesError ? (
              <p className="text-[13px] text-muted">Site types unavailable: {typesError}</p>
            ) : !types ? (
              <p className="text-[13px] text-muted">Loading…</p>
            ) : !types.month ? (
              <p className="text-[13px] text-muted">This build has no site-type table. Run `uv run python -m mi.county_networks`.</p>
            ) : (
              <>
                <StackedBar
                  format={(v) => fmt.int(v)}
                  parts={SITE_TYPES.filter((k) => typeTotals[k].sites).map((k) => ({ key: k, label: TYPE_SHORT[k], value: typeTotals[k].sites, color: TYPE_COLOR[k] }))}
                />
                <table className="mt-4 w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                      <th className="pb-1.5 font-semibold">Type</th>
                      <th className="pb-1.5 text-right font-semibold">Sites</th>
                      <th className="pb-1.5 text-right font-semibold">Visits</th>
                      <th className="pb-1.5 text-right font-semibold">Share of lb</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {SITE_TYPES.map((k) => (
                      <tr
                        key={k}
                        onClick={() => setTypeFilter(typeFilter === k ? "all" : k)}
                        className={`cursor-pointer hover:bg-surface-2 ${typeFilter === k ? "bg-surface-2" : ""}`}
                        aria-selected={typeFilter === k}
                      >
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-1.5 text-ink">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[k] }} />
                            {TYPE_SHORT[k]}
                          </span>
                        </td>
                        <td className="tabular py-1.5 text-right font-semibold text-ink">{fmt.int(typeTotals[k].sites)}</td>
                        <td className="tabular py-1.5 text-right text-ink-2">{fmt.compact(typeTotals[k].households)}</td>
                        <td className="tabular py-1.5 text-right text-ink-2">{fmt.pct(ratio(typeTotals[k].pounds, totalTypedPounds), 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mb-2 mt-4 flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Most {typeFilter === "all" ? "reporting sites" : `${TYPE_SHORT[typeFilter].toLowerCase()} sites`}
                  </span>
                  {typeFilter !== "all" && (
                    <button type="button" className="text-[12px] text-accent hover:underline" onClick={() => setTypeFilter("all")}>
                      All types
                    </button>
                  )}
                </div>
                <BarList rows={topCounties} color={typeFilter === "all" ? "var(--seq-3)" : TYPE_COLOR[typeFilter]} onSelect={pickCounty} />
                <SourceNote>
                  outputs/tables/county_site_types.csv: counts per county and type (food_shelf_broad, D-014). Select a type to filter the map, a county
                  to open its detail. Meal programs are excluded because they report meals.
                </SourceNote>
              </>
            )}
          </Card>
        </div>

        <div ref={detailRef} className="mt-4 scroll-mt-20">
          {county ? (
            <CountyDetail
              fips={county}
              months={countyMonths}
              types={types}
              asOf={asOf}
              alerts={countyAlerts}
              requests={countyRequests}
              info={info.countyDetail}
              onClose={() => setCounty(null)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-4 py-4 text-[13px] text-muted sm:px-5">
              <Icon name="pin" className="h-4 w-4 text-accent" />
              <span className="min-w-0 flex-1">
                Select a county on the map, or one in the list above, for its 24-month trend, change on a year earlier, sites by type, alerts and
                requests.
              </span>
              {topCounties[0] && (
                <button type="button" className={buttonClass("secondary")} onClick={() => pickCounty(topCounties[0].key)}>
                  Open {topCounties[0].label}
                </button>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* 04 · Alerts and FEI */}
      <Section n="04" title="Alerts & equity (FEI)" sub="What needs attention first, and where access barriers are highest">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(340px,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <Card
              title="Alerts"
              icon="bell"
              info={info.alertList}
              subtitle={`${actionable.length} shelf and county alerts at warning or above`}
              actions={
                <Link href="/manager/alerts" className="text-[13px] font-medium text-accent underline">
                  Alert center
                </Link>
              }
            >
              <div className="mb-3 flex flex-wrap gap-3">
                {(["critical", "serious", "warning", "info"] as Severity[]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 text-[12.5px]">
                    <SeverityBadge severity={s} />
                    <span className="tabular font-semibold text-ink">{bySeverity(s)}</span>
                  </span>
                ))}
              </div>
              <AlertList alerts={actionable.length ? actionable : openAlerts.filter((a) => a.scope !== "network")} limit={4} compact />
            </Card>
            <Card
              title="Priority shelves"
              info={info.priority}
              subtitle="Equity, stock risk, demand growth, capacity and reporting. Manager overrides sort first."
              actions={
                <Link href="/manager/shelves" className="text-[13px] font-medium text-accent underline">
                  All shelves
                </Link>
              }
            >
              {priorities.length ? (
                <ul className="divide-y divide-line">
                  {priorities.map((p) => {
                    const worst = shelfAlerts.filter((a) => a.shelfId === p.outlook.shelf.id).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
                    return (
                      <li key={p.outlook.shelf.id} className="flex items-center gap-3 py-2">
                        <span className="tabular grid h-9 w-11 place-items-center rounded-lg bg-surface-2 text-[14px] font-semibold text-ink">{fmt.num(p.score, 0)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-ink">{p.outlook.shelf.name}</div>
                          <div className="truncate text-[12px] text-muted">{worst ? worst.title : "No open shelf alerts"}</div>
                        </div>
                        {worst && <SeverityBadge severity={worst.severity} />}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">{ready ? "No shelves yet." : "Loading…"}</p>
              )}
            </Card>
          </div>

          <CountyMapCard
            title={EQUITY_LABEL}
            info={info.fei}
            subtitle={
              feiReady
                ? "Higher scores mean more barriers between need and the food-shelf network. Select an area to open its county evidence."
                : "FEI is being built (task A4). This placeholder is the Q6 need percentile."
            }
            values={equity}
            domain={[0, 100]}
            legendTitle={`${EQUITY_SHORT} · ${showTracts ? "census tracts" : "counties"}`}
            highlight={robust}
            geometry={showTracts ? tracts.geometry! : undefined}
            unitName={showTracts ? (id) => `${tracts.byId.get(id)?.name ?? id} · ${countiesByFips[id.slice(0, 5)]?.name} County` : undefined}
            height="clamp(340px, 46vw, 520px)"
            href={(id) => `/manager/map?county=${id.slice(0, 5)}`}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <Segmented<"county" | "tract">
                  size="sm"
                  label="Map geography"
                  value={showTracts ? "tract" : "county"}
                  onChange={setGeography}
                  options={[
                    { value: "county", label: "Counties" },
                    { value: "tract", label: tracts.error ? "Tracts unavailable" : tracts.rows ? "Census tracts" : "Tracts loading…", disabled: !tracts.rows || !tracts.geometry, title: tracts.error ?? undefined },
                  ]}
                />
                <Link href="/manager/fei" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                  FEI detail <Icon name="arrow" className="h-3.5 w-3.5" />
                </Link>
              </div>
            }
            note={
              <span>
                <span className="block font-medium text-ink">Highest {EQUITY_SHORT} counties</span>
                {feiTop.map((c) => `${c.name} ${fmt.num(equityValue(c), 0)}`).join(" · ")}. Dashed outlines: Q6 audit-first counties, a call list for local checks.{" "}
                <Link href="/findings/technical" className="underline hover:text-ink">
                  Screening limits
                </Link>
              </span>
            }
            extra={(id) => {
              const c = countiesByFips[id.slice(0, 5)];
              return (
                <div className="mt-1 text-[11.5px] text-muted">
                  {c.sites_2024} reporting shelves (2024) · {fmt.num(c.mean_miles, 1)} mi avg to nearest reporting shelf
                </div>
              );
            }}
          />
        </div>
      </Section>

      {/* 05 · Policy watch and shelf requests */}
      <Section n="05" title="Policy watch & shelf requests" sub="Impact-ranked policy changes, and what shelves are asking for">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)]">
          <Card
            title="Policy watch"
            icon="scale"
            info={info.policy}
            subtitle="Ranked by expected impact on Minnesota food shelves. Scan the web for changes newer than the tracked timeline."
            actions={
              <Link href="/manager/briefing" className="text-[13px] font-medium text-accent underline">
                Brief me
              </Link>
            }
          >
            <PolicyWatch />
          </Card>

          <Card
            title="Shelf requests"
            icon="inbox"
            info={info.requests}
            subtitle={`${reqCount("open")} open · ${reqCount("in_progress")} in progress · ${reqCount("fulfilled")} fulfilled`}
            actions={
              <Link href="/manager/requests" className="text-[13px] font-medium text-accent underline">
                Inbox
              </Link>
            }
          >
            {activeRequests.length ? (
              <ul className="divide-y divide-line">
                {activeRequests.slice(0, 6).map((r) => {
                  const shelf = shelfOf(r.shelf_id);
                  return (
                    <li key={r.id} className="py-2.5 text-[13px] first:pt-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-ink">{shelf?.name ?? "Shelf"}</span>
                        <Badge>{r.kind}</Badge>
                        <Badge tone={r.urgency === "high" ? "critical" : r.urgency === "normal" ? "demo" : "neutral"}>{r.urgency}</Badge>
                        {r.status === "in_progress" && <Badge tone="green">in progress</Badge>}
                        {r.hypothetical && <Badge>hypothetical</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-3 text-ink-2">{r.message}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {fmt.date(r.created_at)}
                        {r.pounds_requested != null ? ` · ${fmt.int(r.pounds_requested)} lb requested` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">{ready ? "No open requests." : "Loading…"}</p>
            )}
            {data.requests.some((r) => r.hypothetical) && (
              <SourceNote>
                Hypothetical requests: examples written by rule from real county totals (visit growth with falling pounds per visit, distance to the nearest
                shelf, summer jumps in children served, Q6 flags). No shelf sent them.
              </SourceNote>
            )}
          </Card>
        </div>
      </Section>

      {session.mode === "demo" && (
        <SourceNote>
          County networks: each &ldquo;shelf&rdquo; is one county&apos;s reporting sites summed by month from the statewide extract (food_shelf_broad,{" "}
          {monthLabel(asOf)} and earlier). Stock, capacity and turn-aways are not in the extract and stay blank. Research figures are the team&apos;s analysis
          outputs.
        </SourceNote>
      )}
    </>
  );
}
