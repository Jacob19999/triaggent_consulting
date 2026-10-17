"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/AppShell";
import { useData } from "@/components/DataProvider";
import { GeoMap, type MapMarker } from "@/components/map/GeoMap";
import { useTractRows } from "@/components/map/useMapData";
import {
  AgreementMeter,
  CompareBars,
  CountUp,
  fitLine,
  Headline,
  IndexLines,
  KeyChip,
  LineStory,
  linearTicks,
  niceStep,
  PaceStory,
  RampKey,
  Scatter,
  StepTabs,
  useBoxSize,
  Verdict,
  type Axis,
  type ScatterPoint,
  type VerdictTone,
} from "@/components/present/visuals";
import { TYPE_COLOR, TYPE_GLYPH, TYPE_SHORT } from "@/components/siteTypeStyle";
import { setThemePref, useTheme } from "@/components/theme";
import { Badge, buttonClass, cx, Icon } from "@/components/ui";
import { useSitePoints } from "@/components/useSitePoints";
import { monthDays, monthLabel } from "@/lib/calendar";
import { deck } from "@/lib/deck";
import { fmt } from "@/lib/format";
import type { TractRow } from "@/lib/mapLayers";
import { SITE_TYPES } from "@/lib/networks";
import { PILLARS } from "@/lib/pillars";
import {
  clock,
  cumulativeSeconds,
  FIRST_APPENDIX,
  MAIN_SLIDES,
  MODEL_LABEL,
  SLIDES,
  SPEAKER_COLOR,
  statewideRunRate,
  TALK_SECONDS,
  type SlideMeta,
} from "@/lib/presentation";
import { makeScale } from "@/lib/ramps";
import { countiesByFips, research, SIGNAL_FIELD, SIGNAL_LABEL } from "@/lib/research";
import type { ForecastSignal, GeoJSONGeometry, Pillar, Signal } from "@/lib/types";

const st = research.findings.stats;
const kpis = (research.fei.meta?.kpis ?? {}) as Record<string, number | string[] | undefined>;
const num = (k: string) => kpis[k] as number | undefined;
const SIG_COLOR: Record<Signal, string> = {
  HouseholdsTotal: "var(--sig-households)",
  PoundsTotal: "var(--sig-pounds)",
  IndividualsTotal: "var(--sig-individuals)",
};
const SIG_SHORT: Record<Signal, string> = { HouseholdsTotal: "Visits", PoundsTotal: "Pounds", IndividualsTotal: "Individuals" };
const SIG_ORDER: Signal[] = ["HouseholdsTotal", "PoundsTotal", "IndividualsTotal"];
const MONTH_NAME = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Map fills are written into SVG attributes, so they are hex values rather than CSS variables.
const LOW_ACT = "#f5a524";
const HIGH_ACT = "#3987e5";
const LILA_RED = "#e34948";

interface ValidationRow {
  check: string;
  spearman: number | null;
  lo95: number | null;
  hi95: number | null;
  n: number;
  result: string;
}
const feiChecks = ((research.fei.meta?.fei_validation as ValidationRow[] | undefined) ?? []).filter((v) => v.spearman != null);
const feiCheck = (id: string) => feiChecks.find((v) => v.check === id);
const sensitivity =
  (research.fei.meta?.fei_sensitivity as { variant: string; county_spearman: number; county_top_quintile_kept: number }[] | undefined) ?? [];

// Counties in both the FEI top quintile and the Q6 priority list (FEI build KPI).
const priorityNames = (kpis.counties_top_quintile_and_q6_priority_names as string[] | undefined) ?? [];
const priorityFips = new Set(research.counties.filter((c) => priorityNames.includes(c.name)).map((c) => c.fips));
const fipsByName = Object.fromEntries(research.counties.map((c) => [c.name, c.fips]));

const PILLAR_PLAIN: Record<Pillar, string> = {
  N: "Money is tight: poverty, rent burden, unemployment",
  S: "Little food nearby: pounds within reach per low-income resident",
  T: "Far from a shelf: miles to the nearest reporting shelf",
  M: "Hard to get there: households without a car",
  V: "More vulnerable households: children, household make-up",
};

/* ------------------------------------------------------------------ steps */

const StepCtx = createContext<{ step: number; setStep: (n: number) => void; index: number }>({ step: 0, setStep: () => {}, index: 0 });
const useStep = () => useContext(StepCtx);

/* ------------------------------------------------------------------ stage and frame */

// Slides are laid out on a fixed 16:9 canvas and scaled to the window, like a PowerPoint slide,
// so nothing reflows or overlaps on a different screen.
const STAGE_W = 1280;
const STAGE_H = 720;

function Stage({ children }: { children: ReactNode }) {
  const [ref, size] = useBoxSize<HTMLDivElement>();
  const s = size.w && size.h ? Math.min((size.w - 24) / STAGE_W, (size.h - 24) / STAGE_H) : 0;
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {s > 0 && (
        <div className="absolute left-1/2 top-1/2" style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${s})` }}>
          <div className="h-full w-full overflow-hidden rounded-[14px] border border-line bg-[var(--paper)] px-10 pb-5 pt-7 shadow-[var(--shadow-lg)]">{children}</div>
        </div>
      )}
    </div>
  );
}

const Hl = ({ children, hot }: { children: ReactNode; hot?: boolean }) => <span className={hot ? "text-[var(--hot)]" : "text-accent"}>{children}</span>;

function Frame({
  meta,
  kicker,
  title,
  monday,
  method,
  source,
  children,
}: {
  meta: SlideMeta;
  kicker: string;
  title: ReactNode;
  monday?: { decision: "Allocation" | "Siting" | "Policy" | "Measurement" | "All four"; text: ReactNode };
  method?: string;
  source?: string;
  children: ReactNode;
}) {
  const { step, setStep, index } = useStep();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2">
        {meta.questions.map((q) => (
          <span key={q} className="rounded-md bg-accent px-2 py-0.5 text-[12.5px] font-bold tracking-wide text-[var(--accent-ink)]">
            {q}
          </span>
        ))}
        <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">{kicker}</span>
        <span className="flex-1" />
        {meta.speakers.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12.5px] text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: SPEAKER_COLOR[s] }} />
            {s}
          </span>
        ))}
      </div>
      <h2 className="fb-rise mt-2 text-[31px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{title}</h2>
      {meta.steps && (
        <div className="mt-3">
          <StepTabs steps={meta.steps} step={step} onStep={setStep} />
        </div>
      )}
      <div className="relative mt-3.5 min-h-0 flex-1">
        <div className="absolute inset-0">{children}</div>
      </div>
      <div className="mt-3 flex items-end gap-5 border-t border-line pt-2.5">
        <div className="min-w-0 flex-1">
          {monday && (
            <p className="text-[16px] leading-snug text-ink">
              <b className="text-accent">Monday · {monday.decision}:</b> {monday.text}
            </p>
          )}
          {(method || source) && (
            <p className="mt-0.5 truncate text-[11.5px] text-muted" title={[method, source].filter(Boolean).join(" · ")}>
              {method && (
                <>
                  <b className="font-semibold text-ink-2">Method:</b> {method}
                  {source ? " · " : ""}
                </>
              )}
              {source && (
                <>
                  <b className="font-semibold text-ink-2">Source:</b> {source}
                </>
              )}
            </p>
          )}
        </div>
        {meta.workspace && (
          <Link href={meta.workspace.href} className={cx(buttonClass("secondary", "sm"), "shrink-0")}>
            Open {meta.workspace.label} <Icon name="arrow" className="h-3.5 w-3.5" />
          </Link>
        )}
        <span className="tabular shrink-0 text-[12px] text-muted">{meta.appendix ? "Appendix" : `${index + 1} / ${MAIN_SLIDES.length}`}</span>
      </div>
    </div>
  );
}

const meta = (id: string) => SLIDES.find((s) => s.id === id)!;

function Panel({ title, children, className, active = true, accent }: { title?: ReactNode; children: ReactNode; className?: string; active?: boolean; accent?: boolean }) {
  return (
    <div
      className={cx(
        "fb-fade flex min-h-0 flex-col rounded-2xl border p-4",
        accent ? "border-accent bg-[var(--accent-soft)]" : "border-line bg-surface",
        !active && "opacity-35",
        className,
      )}
    >
      {title && <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>}
      {children}
    </div>
  );
}

/** A numbered answer that opens when its build step is shown; otherwise it keeps a one-line summary. */
function Answer({ n, title, active, summary, children }: { n: number; title: string; active: boolean; summary?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("fb-fade rounded-2xl border p-3.5", active ? "border-accent bg-[var(--accent-soft)]" : "border-line bg-surface")}>
      <div className="flex items-center gap-2">
        <span className={cx("tabular grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold", active ? "bg-accent text-[var(--accent-ink)]" : "bg-surface-3 text-muted")}>{n}</span>
        <span className={cx("text-[15.5px] font-semibold", active ? "text-ink" : "text-ink-2")}>{title}</span>
      </div>
      {active || !summary ? (
        <div key="open" className="fb-rise mt-2 text-[14px] leading-snug text-ink-2">
          {children}
        </div>
      ) : (
        <p className="mt-1 truncate pl-8 text-[13.5px] text-muted">{summary}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ maps */

/** A slide map: the map fills the box, its key sits in a strip underneath (never over the state). */
function SlideMap({
  geometry,
  fill,
  dim,
  markers,
  hatch,
  hoverCard,
  legend,
  caption,
  ariaLabel,
  outlines = true,
}: {
  geometry: Record<string, GeoJSONGeometry> | null;
  fill: (id: string) => string | null;
  dim?: (id: string) => boolean;
  markers?: MapMarker[];
  hatch?: Record<string, GeoJSONGeometry>;
  hoverCard?: (id: string) => ReactNode;
  legend: ReactNode;
  caption?: ReactNode;
  ariaLabel: string;
  outlines?: boolean;
}) {
  const theme = useTheme();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-[var(--map-bg)]">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          {geometry ? (
            <GeoMap
              geometry={geometry}
              fill={fill}
              dim={dim}
              outlines={outlines ? research.geometry : undefined}
              markers={markers}
              hatch={hatch}
              basemap={theme === "dark" ? "dark" : "light"}
              hoverCard={hoverCard}
              ariaLabel={ariaLabel}
              fitPadding={[8, 44, 8, 8]}
            />
          ) : (
            <div className="grid h-full place-items-center text-[13px] text-muted">Loading census tracts…</div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line bg-surface px-4 py-2">
        {legend}
        {caption && <p className="min-w-[180px] flex-1 text-[13px] leading-snug text-ink-2">{caption}</p>}
      </div>
    </div>
  );
}

function useSiteMarkers(on: boolean) {
  const { sites } = useSitePoints();
  const markers = useMemo<MapMarker[]>(
    () =>
      on && sites
        ? sites.points.map((p, i) => ({
            id: `s${i}`,
            kind: "type" as const,
            lon: p.lon,
            lat: p.lat,
            color: TYPE_COLOR[p.type],
            glyph: TYPE_GLYPH[p.type],
            approx: p.approx,
            title: `${TYPE_SHORT[p.type]} · ${countiesByFips[p.county]?.name ?? ""} County`,
          }))
        : [],
    [on, sites],
  );
  return { markers, sites };
}

/** Tract values on a heat ramp (higher = worse), with the scale for the key. */
function useTractHeat(valueOf: ((t: TractRow) => number | null | undefined) | null, deps: unknown[]) {
  const theme = useTheme();
  const tracts = useTractRows();
  const values = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (valueOf) for (const t of tracts.rows ?? []) out[t.geoid] = valueOf(t) ?? null;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracts.rows, ...deps]);
  const scale = useMemo(() => makeScale(Object.values(values), "risk", theme), [values, theme]);
  const fill = useCallback(
    (id: string) => {
      const v = values[id];
      return v == null || !Number.isFinite(v) ? null : scale.color(v);
    },
    [values, scale],
  );
  return { tracts, values, scale, fill };
}

const tractCard = (id: string, label: string, value: ReactNode) => (
  <div>
    <div className="font-semibold text-ink">{countiesByFips[id.slice(0, 5)]?.name} County</div>
    <div className="text-[11.5px] text-muted">Tract {id.slice(5)}</div>
    <div className="mt-1 flex justify-between gap-4 text-ink-2">
      <span>{label}</span>
      <span className="tabular font-semibold text-ink">{value}</span>
    </div>
  </div>
);

/* ------------------------------------------------------------------ 1 · the business problem */

function TitleSlide() {
  return (
    <div className="flex h-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] items-center gap-10">
        <div className="fb-rise">
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">MinneMUDAC 2026 · The Food Group · Graduate team G08</div>
          <h1 className="mt-4 text-[50px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink [word-spacing:0.08em]">
            The Food Group can see <Hl>demand</Hl>. It can't see <Hl hot>need</Hl>.
          </h1>
          <p className="mt-4 text-[18px] leading-relaxed text-ink-2">
            Supply follows visits, and visits only count the people who reach a shelf. We set out to answer three questions for Minnesota:
          </p>
          <ol className="mt-3 space-y-1.5 text-[18px] font-medium text-ink">
            {["Where do need and demand split?", "Why do they split?", "What should change on Monday?"].map((q, i) => (
              <li key={q} className="flex items-center gap-3">
                <span className="tabular grid h-7 w-7 place-items-center rounded-full bg-[var(--accent-soft)] text-[14px] font-bold text-accent">{i + 1}</span>
                {q}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[15px] text-ink-2">Jacob Tang · Daniela Ortega · Biruk Anley · Roshit Niraula</p>
        </div>
        <Panel title="Need and demand are different numbers · US adults 18–64, December 2025" className="fb-rise">
          <CompareBars
            rows={[
              { label: "Food insecure (need)", value: 27.7, color: "var(--hot)", strong: true },
              { label: "Received charitable food (demand)", value: 16.7, color: "var(--accent)", strong: true },
            ]}
            max={30}
            format={(v) => `${fmt.num(v, 1)}%`}
          />
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-[16px] leading-snug text-ink">
            Nearly <b>3 in 10</b> adults in food-insecure households needed charitable food and <b>did not get it</b>.
          </p>
          <p className="mt-3 text-[12px] leading-snug text-muted">
            Urban Institute, Well-Being and Basic Needs Survey, December 2025 (catalog rows 63–64). National; it frames the question, it does not enter any Minnesota
            estimate.
          </p>
        </Panel>
      </div>
      <div className="mt-4 flex items-end gap-4 border-t border-line pt-3 text-[13px] text-ink-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p>
            <b className="text-ink">Provided data:</b> The Food Group reporting network, January 2022 – {monthLabel(research.meta.observed_end, "long")} · Feeding America Map the Meal Gap
            · BLS food prices · Minnesota DCYF SNAP
          </p>
          <p>
            <b className="text-accent">Additional public sources:</b> Census ACS and 2020 blocks · USDA LILA, SRAM and RUCC · CDC SVI · BLS LAUS · HUD rents · OpenStreetMap roads ·
            Urban Institute
          </p>
        </div>
        <span className="tabular shrink-0 text-[12px] text-muted">1 / {MAIN_SLIDES.length}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2–4 · a need measure (Q6) */

function FeiSlide() {
  const { step } = useStep();
  const pillar = step < PILLARS.length ? PILLARS[step] : null;
  const { tracts, values, scale, fill } = useTractHeat(pillar ? (t) => t[pillar.key] as number | null | undefined : (t) => t.fei, [pillar?.key]);
  const all = !pillar;
  return (
    <Frame
      meta={meta("fei")}
      kicker="Our need measure: Food Access Equity Index"
      title={
        <>
          Need can't be counted directly, so we score the <Hl>barriers</Hl> between people and food shelves, in every census tract.
        </>
      }
      monday={{ decision: "Allocation", text: "weigh supply by barriers as well as by visits; visits only show who already gets in." }}
      method="five pillars, each 0–1 from public data: need (N 35 · V 15) × access (S 15 · T 20 · M 15), multiplied into a 0–100 score"
      source="mi.fei: 1,501 Census 2020 tracts, 2024 reporting network; no visit counts, SNAP or Map the Meal Gap values enter the score"
    >
      <div className="grid h-full min-h-0 grid-cols-[0.95fr_1.3fr] gap-5">
        <div className="flex min-h-0 flex-col gap-1.5">
          {PILLARS.map((p, i) => {
            const on = all || i === step;
            return (
              <div
                key={p.key}
                className={cx("fb-fade flex items-center gap-3 rounded-xl border bg-surface px-3 py-2", on ? "opacity-100" : "opacity-35")}
                style={{ borderColor: i === step ? p.color : "var(--line)", boxShadow: i === step ? `0 0 0 1px ${p.color}` : undefined }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px] font-bold text-white" style={{ background: p.color }}>
                  {p.key}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold leading-tight text-ink">{p.label}</span>
                  <span className="block truncate text-[13px] leading-snug text-ink-2">{PILLAR_PLAIN[p.key]}</span>
                </span>
                <span className="tabular text-[14px] font-semibold text-muted">{Math.round(p.weight * 100)}%</span>
              </div>
            );
          })}
          <div className={cx("fb-fade mt-auto rounded-xl border p-3.5", all ? "border-accent bg-[var(--accent-soft)]" : "border-line bg-surface")}>
            {all ? (
              <Headline
                value={num("residents_beyond")}
                format={fmt.compact}
                label="Minnesotans beyond easy reach of a reporting shelf"
                sub={`${fmt.pct(num("residents_beyond_share"), 0)} of residents: more than 1 mile away in town, 10 miles in the country.`}
                color="var(--accent)"
              />
            ) : (
              <p className="text-[14px] leading-snug text-ink-2">
                <b className="text-ink">No visit counts go in.</b> So the score is free to disagree with demand, and where it does is the finding.
              </p>
            )}
          </div>
        </div>
        <SlideMap
          geometry={tracts.geometry}
          fill={fill}
          ariaLabel={`Census tracts colored by ${pillar ? pillar.label : "FEI"}`}
          hoverCard={(id) => tractCard(id, pillar ? pillar.label : "FEI", values[id] == null ? "no data" : pillar ? fmt.num(values[id], 2) : fmt.num(values[id], 0))}
          legend={
            <RampKey
              stops={scale.stops}
              low="Fewer barriers"
              high="More barriers"
              title={pillar ? `${pillar.label} barrier` : "FEI, 0–100"}
              ticks={all ? scale.ticks.map((t) => fmt.num(t, 0)) : undefined}
            />
          }
          caption={
            pillar ? (
              <>
                <b className="text-ink">{pillar.label}:</b> {PILLAR_PLAIN[pillar.key].split(": ")[1]}.
              </>
            ) : (
              <>
                <b className="text-ink">Need × access:</b> one 0–100 score per tract, high only where both are high. Red = most barriers.
              </>
            )
          }
        />
      </div>
    </Frame>
  );
}

function FeiMapSlide() {
  const { step } = useStep();
  const { tracts, values, scale, fill } = useTractHeat((t) => t.fei, []);
  const { markers, sites } = useSiteMarkers(step >= 1);
  const dim = useMemo(() => (step === 2 ? (id: string) => tracts.byId.get(id)?.quintile !== 5 : undefined), [step, tracts.byId]);
  const top = useMemo(
    () => [...research.counties].filter((c) => c.fei?.fei != null).sort((a, b) => (b.fei!.fei ?? 0) - (a.fei!.fei ?? 0)).slice(0, 6),
    [],
  );
  const snap = feiCheck("fei_vs_snap_participation");
  const mmg = feiCheck("fei_vs_mmg_food_insecurity_rate_private");
  const captions = [
    <>
      <b className="text-ink">Red = most barriers.</b> They concentrate in the rural west and north, not in the metro.
    </>,
    <>
      <b className="text-ink">Each icon is a food shelf</b> reporting in {monthLabel(sites?.month ?? research.meta.observed_end, "long")}. Shelves sit where people
      are; the reddest tracts have few.
    </>,
    <>
      <b className="text-ink">Only the highest-barrier fifth</b> of tracts is lit. Start new-shelf and mobile-stop planning here.
    </>,
  ];
  return (
    <Frame
      meta={meta("fei-map")}
      kicker="Where the barriers are"
      title={
        <>
          Barriers concentrate in the <Hl hot>rural west and north</Hl>, far from where most food shelves are.
        </>
      }
      monday={{ decision: "Siting", text: "start new-shelf and mobile-stop planning in the highest-barrier tracts, not where visits are highest." }}
      method="FEI checked against data it never used: rank correlation with SNAP use and Feeding America's rate, county bootstrap"
      source="fei_tracts.csv, fei_validation.csv; sites.json (reporting sites at researched coordinates, type only, D-063)"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.55fr_1fr] gap-5">
        <SlideMap
          geometry={tracts.geometry}
          fill={fill}
          dim={dim}
          markers={markers}
          ariaLabel="Census tracts colored by FEI with reporting food shelves"
          hoverCard={(id) => tractCard(id, "FEI", fmt.num(values[id], 0))}
          legend={
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <RampKey stops={scale.stops} low="Fewer barriers" high="More barriers" title="FEI" />
              {step >= 1 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {SITE_TYPES.map((t) => (
                    <KeyChip key={t} color={TYPE_COLOR[t]} label={TYPE_SHORT[t]} ring />
                  ))}
                </div>
              )}
            </div>
          }
          caption={captions[step]}
        />
        <div className="flex min-h-0 flex-col gap-4">
          <Panel title="Highest-barrier counties (FEI, 0–100)">
            <CompareBars
              rows={top.map((c, i) => ({
                label: (
                  <>
                    {c.name}
                    {c.sites_2024 === 0 && <span className="ml-1.5 text-[11.5px] font-semibold text-[var(--hot)]">no shelf</span>}
                  </>
                ),
                value: c.fei!.fei!,
                color: scale.color(c.fei!.fei!),
                strong: i < 3,
              }))}
              max={100}
              format={(v) => fmt.num(v, 0)}
            />
          </Panel>
          <Panel className="flex-1" accent={step === 2}>
            {step === 0 && (
              <div key="s0" className="fb-rise">
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Is it really need? Checks on data the score never used</div>
                <AgreementMeter
                  rows={[
                    { label: "SNAP use", value: snap?.spearman, color: "var(--accent)" },
                    { label: "Feeding America", value: mmg?.spearman, color: "var(--accent)" },
                  ]}
                />
              </div>
            )}
            {step === 1 && (
              <div key="s1" className="flex h-full flex-col justify-center">
                <Headline value={sites?.placed} label="Food shelves on the map" sub={<>Reporting in {monthLabel(sites?.month ?? research.meta.observed_end, "long")}. Hollow icons mark a town or ZIP, not an address.</>} />
              </div>
            )}
            {step === 2 && (
              <div key="s2" className="flex h-full flex-col justify-center gap-4">
                <Headline value={num("residents_top_quintile")} format={fmt.compact} label="Residents in the highest-barrier fifth" color="var(--hot)" />
                <Headline value={num("children_top_quintile")} format={fmt.compact} label="Of them, children" delay={250} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Frame>
  );
}

function Q6Slide() {
  const { step } = useStep();
  const check = (id: string) => st.q6_checks.find((c) => c.check === id);
  const snap = check("need_score_vs_snap_participation");
  const held = check("need_score_vs_snap_participation_given_poverty");
  const first = step === 0;
  return (
    <Frame
      meta={meta("q6")}
      kicker="Graduate addendum: a need measure that is not demand"
      title={
        <>
          Need is a household without reliable food, <Hl>whether or not it asks</Hl>, and here is the evidence that would prove our measure wrong.
        </>
      }
      monday={{ decision: "Measurement", text: "use the score to decide where to look, not how much food to move." }}
      method="Q6 score = mean county percentile of three public inputs; checks are rank correlations over 82 SNAP units, bootstrap 95% ranges"
      source="docs/reference/q6_addendum.md, q6_falsification_checks.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-2 grid-rows-[1fr_1fr_auto] gap-3">
        <Answer n={1} title="Definition, stated plainly" active={first}>
          <p className="text-[17px] font-semibold leading-snug text-ink">
            “A household lacks reliable resources for enough food over a set period, including people who never come to a shelf.”
          </p>
          <p className="mt-1.5">Higher hardship and transport barriers should mark more of it, among users and non-users alike.</p>
        </Answer>
        <Answer n={2} title="Why it measures need, not demand" active={first}>
          <div className="grid grid-cols-2 gap-3">
            <ul className="space-y-1 text-ink">
              {["Feeding America food-insecurity rate", "Census: share in poverty", "Census: households without a car"].map((x) => (
                <li key={x} className="flex gap-1.5">
                  <span className="font-bold text-accent">✓</span>
                  {x}
                </li>
              ))}
            </ul>
            <ul className="space-y-1 text-muted">
              {["Visits (HouseholdsReg)", "Pounds (PoundsReg)", "Individuals (IndividualsReg)"].map((x) => (
                <li key={x} className="flex gap-1.5 line-through decoration-[var(--hot)] decoration-2">
                  <span className="font-bold text-[var(--hot)] no-underline">✕</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-1.5">Only public hardship data go in, so the score is free to disagree with demand.</p>
        </Answer>
        <Answer n={3} title="Evidence that would make us reject it" active={!first}>
          A household food-security survey that includes non-users finds <b className="text-ink">no more hardship in high-score counties</b>, with a bound that rules out a
          useful difference. Not yet run: we claim no survey validation.
        </Answer>
        <Answer n={4} title="Evidence that would make us revise it" active={!first}>
          Dropping one input or changing the Feeding America edition moves a county <b className="text-ink">by more than a fifth</b> of the ranking; or fieldwork shows the
          car measure mostly flags well-served urban households.
        </Answer>
        <div className={cx("fb-fade col-span-2 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px]", first && "opacity-40")}>
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Checks run now</span>
          <span>
            <b className="text-accent">✓ Passed:</b> higher where more people use SNAP (agreement {fmt.num(snap?.spearman, 2)}; the rule rejects at zero or below)
          </span>
          <span>
            <b className="text-[var(--hot)]">✓ Only just:</b> with poverty held fixed, {fmt.num(held?.spearman, 2)} (range {fmt.num(held?.lo95, 2)} to {fmt.num(held?.hi95, 2)})
          </span>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ 5 · Q1 */

function pow10Ticks(lo: number, hi: number) {
  const out: { v: number; label: string }[] = [];
  for (let e = Math.ceil(Math.log10(lo)); 10 ** e <= hi; e++) out.push({ v: 10 ** e, label: fmt.compact(10 ** e) });
  return out;
}

function Q1Slide() {
  const { step } = useStep();
  const theme = useTheme();
  const perRes = step >= 1;
  const rows = useMemo(
    () =>
      research.counties
        .filter((c) => c.population && c.annual2024.HouseholdsTotal != null)
        .map((c) => ({ c, pop: c.population!, visits: c.annual2024.HouseholdsTotal!, per: (1000 * c.annual2024.HouseholdsTotal!) / c.population! })),
    [],
  );
  const named = useMemo(() => {
    const big = [...rows].sort((a, b) => b.pop - a.pop).slice(0, 3);
    const small = [...rows].sort((a, b) => a.pop - b.pop).slice(0, 1);
    return new Set([...big, ...small].map((r) => r.c.fips));
  }, [rows]);
  const popLo = Math.min(...rows.map((r) => r.pop)) / 1.4;
  const popHi = Math.max(...rows.map((r) => r.pop)) * 1.4;
  const vLo = Math.min(...rows.map((r) => r.visits)) / 1.6;
  const vHi = Math.max(...rows.map((r) => r.visits)) * 1.6;
  const perMax = Math.max(...rows.map((r) => r.per));
  const perHi = Math.ceil((perMax * 1.05) / niceStep(perMax)) * niceStep(perMax);
  const x: Axis = { domain: [popLo, popHi], log: true, ticks: [5e3, 2e4, 1e5, 5e5].filter((v) => v > popLo && v < popHi).map((v) => ({ v, label: fmt.compact(v) })), title: "County residents" };
  const y: Axis = perRes
    ? { domain: [0, perHi], ticks: linearTicks(0, perHi, fmt.int), title: "Visits per 1,000 residents, 2024" }
    : { domain: [vLo, vHi], log: true, ticks: pow10Ticks(vLo, vHi), title: "Visits in 2024 (HouseholdsReg)" };
  const points: ScatterPoint[] = rows.map((r) => ({
    id: r.c.fips,
    x: r.pop,
    y: perRes ? r.per : r.visits,
    label: !perRes && named.has(r.c.fips) ? r.c.name : undefined,
    title: `${r.c.name}: ${fmt.int(r.visits)} visits, ${fmt.int(r.per)} per 1,000 residents`,
  }));
  const corr = perRes ? st.q1_rate : st.q1_count;
  const out = deck.q1_outliers.HouseholdsTotal;
  const lowSet = useMemo(() => new Set(out.lower_activity.map((n) => fipsByName[n])), [out]);
  const highSet = useMemo(() => new Set(out.higher_activity.map((n) => fipsByName[n])), [out]);
  const neutral = theme === "dark" ? "#2c3a48" : "#d5dce4";
  const countyFill = useCallback((id: string) => (lowSet.has(id) ? LOW_ACT : highSet.has(id) ? HIGH_ACT : neutral), [lowSet, highSet, neutral]);
  const drivers = deck.q1_drivers.HouseholdsTotal;
  const dist = deck.q1_distance;
  const r2 = SIG_ORDER.map((s) => deck.q1_drivers[s].r_squared);
  const best = [...st.q1_count].sort((a, b) => b.correlation - a.correlation);
  return (
    <Frame
      meta={meta("q1")}
      kicker="Need estimates vs observed activity"
      title={
        <>
          Busy counties are just <Hl>big</Hl> counties. Per resident, visits, pounds and individuals don't follow Feeding America's need estimate.
        </>
      }
      monday={{ decision: "Allocation", text: "allocating by visits allocates by county size; audit the outlier counties before reading them as unmet need." }}
      method="Spearman rank correlation, 2024 activity vs Map the Meal Gap 2026 edition (2024 data), county bootstrap; outliers = largest residuals of activity per resident on the rate"
      source="q1_correlations.csv, q1_outliers.csv, q1_explanatory_models.csv, distance_findings.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.4fr_1fr] gap-5">
        {step < 2 ? (
          <div className="min-h-0 rounded-2xl border border-line bg-surface p-3">
            <Scatter points={points} x={x} y={y} ariaLabel={perRes ? "Visits per 1,000 residents by county size" : "Visits by county size"} />
          </div>
        ) : (
          <SlideMap
            geometry={research.geometry}
            fill={countyFill}
            outlines={false}
            ariaLabel="Counties that break the need–activity pattern"
            hoverCard={(id) => (
              <div>
                <div className="font-semibold text-ink">{countiesByFips[id]?.name} County</div>
                <div className="text-ink-2">{lowSet.has(id) ? "Less activity than need suggests" : highSet.has(id) ? "More activity than need suggests" : "Within the pattern"}</div>
              </div>
            )}
            legend={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <KeyChip color={LOW_ACT} label="Less activity than need suggests" />
                <KeyChip color={HIGH_ACT} label="More activity than need suggests" />
              </div>
            }
            caption={<>Top five each way, visits per resident vs Feeding America's rate, 2024.</>}
          />
        )}
        <div className="flex min-h-0 flex-col justify-center gap-4">
          {step < 2 && (
            <div key={`m${perRes}`} className="flex flex-col gap-4">
              <Panel title={`Agreement with Feeding America (${perRes ? "food-insecurity rate" : "food-insecure people"})`}>
                <AgreementMeter rows={SIG_ORDER.map((s) => ({ label: SIG_SHORT[s], value: corr.find((r) => r.signal === s)?.correlation, color: SIG_COLOR[s] }))} />
              </Panel>
              <p className="fb-rise text-[19px] font-medium leading-snug text-ink">
                {perRes ? (
                  <>
                    Divide by residents and the agreement <Hl hot>disappears</Hl> for all three. Activity follows size, not need.
                  </>
                ) : (
                  <>
                    {SIG_SHORT[best[0].signal]} track closest ({fmt.num(best[0].correlation, 2)}), {SIG_SHORT[best[2].signal].toLowerCase()} least (
                    {fmt.num(best[2].correlation, 2)}), but only because big counties have more of everything.
                  </>
                )}
              </p>
            </div>
          )}
          {step === 2 && (
            <div key="out" className="fb-rise flex flex-col gap-3">
              <Panel title="Less activity than need suggests">
                <div className="flex flex-wrap gap-1.5">
                  {out.lower_activity.map((n) => (
                    <span key={n} className="rounded-full px-2.5 py-0.5 text-[14px] font-semibold text-[#1b1200]" style={{ background: LOW_ACT }}>
                      {n}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[13.5px] text-ink-2">Scott's largest shelf sits in Scott but is booked to Hennepin: a labelling question before a need one.</p>
              </Panel>
              <Panel title="More activity than need suggests">
                <div className="flex flex-wrap gap-1.5">
                  {out.higher_activity.map((n) => (
                    <span key={n} className="rounded-full px-2.5 py-0.5 text-[14px] font-semibold text-white" style={{ background: HIGH_ACT }}>
                      {n}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[13.5px] text-ink-2">Steele, Rice and Olmsted are regional hubs that also serve neighbouring counties.</p>
              </Panel>
            </div>
          )}
          {step === 3 && (
            <Panel key="why" title="What goes with more or less activity per resident">
              <div className="flex flex-col gap-3">
                <Verdict
                  tone="clear"
                  label="Distance to a shelf"
                  text={<>farther away, fewer visits per resident</>}
                  detail={`rank correlation ${fmt.num(dist.HouseholdsTotal.rho, 2)} visits · ${fmt.num(dist.IndividualsTotal.rho, 2)} individuals · ${fmt.num(dist.PoundsTotal.rho, 2)} pounds`}
                />
                <Verdict
                  tone="clear"
                  label="Households without a car"
                  text="more of them, more activity per resident (shelves within walking or transit reach)"
                  detail={`+${fmt.num(drivers.terms.no_vehicle_rate.coef, 2)} SD in a model with poverty, rurality and site density`}
                />
                <Verdict
                  tone="unclear"
                  label="Poverty, rurality, SNAP use"
                  text="no clear link once the others are held fixed"
                  detail={`poverty ${fmt.num(drivers.terms.poverty_rate.lo95, 2)} to ${fmt.num(drivers.terms.poverty_rate.hi95, 2)}; rural ${fmt.num(drivers.terms.nonmetro.lo95, 2)} to ${fmt.num(drivers.terms.nonmetro.hi95, 2)}`}
                />
                <p className="rounded-xl bg-surface-2 p-2.5 text-[14px] leading-snug text-ink">
                  County traits explain only about {fmt.pct(Math.max(...r2), 0)} of the differences. Local reasons (one dominant shelf, where it is booked, hubs) matter more.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ 6 · where need and demand split (Q6) */

function DivergenceSlide() {
  const { step } = useStep();
  const wT = PILLARS.find((p) => p.key === "T")!.weight;
  const wM = PILLARS.find((p) => p.key === "M")!.weight;
  const rows = useMemo(
    () =>
      research.counties
        .filter((c) => c.fei?.T != null && c.fei?.M != null && c.annual2024.HouseholdsTotal != null && c.population && c.below_200_share)
        .map((c) => ({
          c,
          x: (100 * (wT * c.fei!.T! + wM * c.fei!.M!)) / (wT + wM),
          y: (1000 * c.annual2024.HouseholdsTotal!) / (c.population! * c.below_200_share!),
        })),
    [wT, wM],
  );
  const xs = rows.map((r) => r.x);
  const ys = [...rows.map((r) => r.y)].sort((a, b) => a - b);
  const xLo = Math.floor(Math.min(...xs) / 10) * 10;
  const xHi = Math.ceil(Math.max(...xs) / 10) * 10;
  const yCap = ys[Math.floor(ys.length * 0.97)] * 1.12;
  const yStep = niceStep(yCap);
  const yHi = Math.ceil(yCap / yStep) * yStep;
  const x: Axis = { domain: [xLo, xHi], ticks: linearTicks(xLo, xHi, (v) => fmt.num(v, 0)), title: "Travel + mobility barrier score" };
  const y: Axis = { domain: [0, yHi], ticks: linearTicks(0, yHi, fmt.int), title: "Visits per 1,000 low-income residents, 2024" };
  const trend = fitLine(rows, xLo, xHi);
  const points: ScatterPoint[] = rows.map((r) => {
    const hot = priorityFips.has(r.c.fips);
    return {
      id: r.c.fips,
      x: r.x,
      y: r.y,
      tone: step === 1 ? (hot ? "hot" : "dim") : "base",
      title: `${r.c.name}: barrier ${fmt.num(r.x, 0)}, ${fmt.int(r.y)} visits per 1,000 low-income residents`,
    };
  });
  const meterRows = SIG_ORDER.map((s) => ({
    label: SIG_SHORT[s],
    value: feiCheck(`access_TM_vs_${s}_per_1000_low_income`)?.spearman,
    color: SIG_COLOR[s],
  }));
  return (
    <Frame
      meta={meta("divergence")}
      kicker="Where need and demand disagree, and what explains it"
      title={
        <>
          Where it is harder to get to a shelf, <Hl hot>fewer low-income residents show up</Hl>. That is need not turning into demand.
        </>
      }
      monday={{ decision: "Measurement", text: "call these counties first about hours, transport and language before moving supply; a flag is a call, not a verdict." }}
      method="Spearman rank correlation, travel and mobility pillars vs 2024 activity per 1,000 residents below 200% of poverty; Q6 chance comparison by random pairing"
      source="fei_validation.csv, q6_need_index.csv, q6_permutation_null.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.4fr_1fr] gap-5">
        <div className="min-h-0 rounded-2xl border border-line bg-surface p-3">
          <Scatter points={points} x={x} y={y} trend={trend} ariaLabel="Counties: barrier score vs visits per low-income resident" />
        </div>
        <div className="flex min-h-0 flex-col justify-center gap-4">
          {step === 0 ? (
            <div key="s0" className="fb-rise flex flex-col gap-4">
              <Panel title="Barriers vs each activity measure, per low-income resident">
                <AgreementMeter rows={meterRows} />
              </Panel>
              <p className="text-[18px] font-medium leading-snug text-ink">
                All three are <Hl hot>below zero</Hl>: fewer visits, pounds and individuals where getting there is harder.
              </p>
            </div>
          ) : (
            <div key="s1" className="fb-rise flex flex-col gap-4">
              <Panel title={`${priorityNames.length} counties: top fifth on barriers and on our Q6 need list`} accent>
                <div className="flex flex-wrap gap-1.5">
                  {priorityNames.map((n, i) => (
                    <span key={n} className="fb-rise rounded-full bg-[var(--hot)] px-2.5 py-0.5 text-[14px] font-semibold text-[#1b1200]" style={{ animationDelay: `${i * 60}ms` }}>
                      {n}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[15px] leading-snug text-ink">A call list for local checks: hours, transport, language, unreported shelves.</p>
              </Panel>
              <p className="text-[13.5px] leading-snug text-ink-2">
                Not proof of unmet need: the Q6 screen on its own flags {deck.q6_chance.flagged} counties, about what random pairing gives (~{fmt.num(deck.q6_chance.flagged_by_chance, 0)}).
              </p>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ 7 · Q8 */

function Q8Slide() {
  const { step } = useStep();
  const theme = useTheme();
  const { tracts, values, scale, fill: milesFill } = useTractHeat((t) => t.d, []);
  const { markers } = useSiteMarkers(step >= 1);
  const neutral = theme === "dark" ? "#5b7083" : "#9aa8b6";
  const fill = useCallback(
    (id: string) => {
      if (step >= 2) return milesFill(id);
      const t = tracts.byId.get(id);
      return t ? (t.lila === 1 ? LILA_RED : neutral) : null;
    },
    [step, milesFill, tracts.byId, neutral],
  );
  const dim = useMemo(() => (step < 2 ? (id: string) => tracts.byId.get(id)?.lila !== 1 : undefined), [step, tracts.byId]);
  const strata = Object.fromEntries(st.q8.strata.map((s) => [s.group, s]));
  const p = deck.q8_presence;
  const road = deck.q8_road;
  const captions = [
    <>
      <b className="text-ink">Red = USDA low-income, low-access tracts:</b> low income and far from a grocery store.
    </>,
    <>
      <b className="text-ink">Each icon is a food shelf.</b> Many red tracts have none inside them.
    </>,
    <>
      <b className="text-ink">Miles to the nearest shelf.</b> Hatched = low-income, low-access.
    </>,
  ];
  return (
    <Frame
      meta={meta("q8")}
      kicker="Low-income, low-access tracts and network reach"
      title={
        <>
          Food shelves <Hl hot>repeat the grocery gap</Hl> instead of filling it: low-access tracts are less likely to have a shelf, and farther from one.
        </>
      }
      monday={{ decision: "Siting", text: "check catchments, hours and mobile stops in low-access tracts with no shelf before opening anything new." }}
      method="low-income tracts split by USDA access flag, urban and rural compared separately; population-weighted straight-line and road miles from block points"
      source="USDA ERS Food Access Research Atlas 2019 on 2020 tracts; q8_low_income_urban_rural.csv; distance_findings.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.5fr_1fr] gap-5">
        <SlideMap
          geometry={tracts.geometry}
          fill={fill}
          dim={dim}
          markers={markers}
          hatch={step >= 2 ? tracts.lilaGeoms : undefined}
          ariaLabel="Low-income, low-access tracts, food shelves and miles to the nearest shelf"
          hoverCard={(id) => tractCard(id, "Miles to a shelf", `${fmt.num(values[id], 1)}${tracts.byId.get(id)?.lila === 1 ? " · LILA" : ""}`)}
          legend={
            step < 2 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <KeyChip color={LILA_RED} label="Low-income, low-access" />
                <KeyChip color={neutral} label="Other tracts" />
                {step >= 1 && SITE_TYPES.map((t) => <KeyChip key={t} color={TYPE_COLOR[t]} label={TYPE_SHORT[t]} ring />)}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <RampKey stops={scale.stops} low="Closer" high="Farther" title="Miles to nearest shelf" ticks={scale.ticks.map((t) => fmt.num(t, 0))} />
                <KeyChip color="var(--ink-2)" label="Low-income, low-access" hatch />
              </div>
            )
          }
          caption={captions[step]}
        />
        <div className="flex min-h-0 flex-col gap-3">
          {step === 0 && (
            <Panel key="s0" className="fb-rise">
              <Headline value={st.q8.lila_tracts} label="Low-income, low-access tracts (2024 map year)" color={LILA_RED} sub="USDA: low income, and more than 1 mile (town) or 10 miles (country) from a large grocery store." />
            </Panel>
          )}
          {step === 1 && (
            <Panel key="s1" title="Low-income tracts with a food shelf inside" className="fb-rise">
              <div className="mb-1 text-[13px] font-semibold text-ink">In the country</div>
              <CompareBars
                rows={[
                  { label: "Low access", value: p.rural_low_access.share * 100, color: LILA_RED, strong: true },
                  { label: "Better access", value: p.rural_better_access.share * 100, color: "var(--seq-3)" },
                ]}
                max={70}
                format={(v) => `${fmt.num(v, 0)}%`}
              />
              <div className="mb-1 mt-3 text-[13px] font-semibold text-ink">In town</div>
              <CompareBars
                rows={[
                  { label: "Low access", value: p.urban_low_access.share * 100, color: LILA_RED, strong: true },
                  { label: "Better access", value: p.urban_better_access.share * 100, color: "var(--seq-3)" },
                ]}
                max={70}
                format={(v) => `${fmt.num(v, 0)}%`}
                delay={250}
              />
            </Panel>
          )}
          {step === 2 && (
            <Panel key="s2" title="Average miles to the nearest shelf (straight line · by road)" className="fb-rise">
              <div className="mb-1 text-[13px] font-semibold text-ink">In the country</div>
              <CompareBars
                rows={[
                  { label: "Low access", value: strata.rural_low_access?.mean_miles ?? 0, color: "var(--hot)", strong: true },
                  { label: "Better access", value: strata.rural_better_access?.mean_miles ?? 0, color: "var(--seq-3)" },
                ]}
                max={11}
                format={(v) => `${fmt.num(v, 1)} mi`}
              />
              <p className="tabular mt-1 text-[12.5px] text-muted">
                By road: {fmt.num(road.rural_low_access.mean_miles, 1)} vs {fmt.num(road.rural_better_access.mean_miles, 1)} mi
              </p>
              <div className="mb-1 mt-3 text-[13px] font-semibold text-ink">In town</div>
              <CompareBars
                rows={[
                  { label: "Low access", value: strata.urban_low_access?.mean_miles ?? 0, color: "var(--hot)", strong: true },
                  { label: "Better access", value: strata.urban_better_access?.mean_miles ?? 0, color: "var(--seq-3)" },
                ]}
                max={11}
                format={(v) => `${fmt.num(v, 1)} mi`}
                delay={250}
              />
            </Panel>
          )}
          <Panel title="Limits" className="mt-auto">
            <p className="text-[13px] leading-snug text-ink-2">
              USDA's LILA is 2019 data on 2010 tracts, carried to 2020 tracts by area. Miles are to the nearest reporting shelf, not travel time or hours. A shelf
              inside a tract is a footprint, not proof residents are served.
            </p>
          </Panel>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ 8 · Q4 */

function tone(lo: number, hi: number): VerdictTone {
  if (lo > 0 || hi < 0) return "clear";
  return Math.min(Math.abs(lo), Math.abs(hi)) < 0.1 * (hi - lo) ? "borderline" : "unclear";
}
const pctRange = (lo: number, hi: number, d = 1) => `likely between ${lo > 0 ? "+" : ""}${fmt.num(lo, d)}% and ${hi > 0 ? "+" : ""}${fmt.num(hi, d)}%`;

function Q4Slide() {
  const { step } = useStep();
  const prices = SIG_ORDER.map((s) => st.q4.find((x) => x.signal === s)!);
  const wd = deck.q4_workdays;
  const slow = (s: Signal) => deck.q4_months[s].map((m) => MONTH_NAME[m.month]);
  const series = [
    { label: "Grocery prices (BLS, Midwest)", color: "var(--hot)", points: deck.q4_prices.map((p) => ({ month: p.month, value: p.cpi })) },
    { label: "Visits (HouseholdsReg)", color: "var(--sig-households)", points: research.history.map((h) => ({ month: h.month, value: h.HouseholdsTotal })) },
  ];
  return (
    <Frame
      meta={meta("q4")}
      kicker="Food prices and food-shelf activity"
      title={
        <>
          Grocery prices are a <Hl>weak</Hl> early warning: only individuals served follow them, a month later. The calendar matters more.
        </>
      }
      monday={{ decision: "Allocation", text: "warn shelves on the calendar and recent trend; don't promise donors a county surge from prices alone." }}
      method="monthly log changes on lags 0–6 chosen by AICc, with season, working days and the April 2023 pulse; HAC 95% ranges; working-day elasticity within calendar month"
      source="BLS CPI-U food at home, Midwest (CUUR0200SAF11); q4_price_models.csv, eda_calendar_effect.csv, q4_residual_calendar.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.35fr_1fr] gap-5">
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface p-3">
          <span className="px-1 text-[13px] font-semibold text-ink">Index, 2022 average = 100</span>
          <div className="min-h-0 flex-1">
            <IndexLines series={series} ariaLabel="Grocery prices and food-shelf visits, indexed to 2022" />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <Answer n={1} title="Do more people come when prices rise? Right away or later?" active={step === 0} summary={`Only individuals served, about +${fmt.num(prices[2].cumulative_elasticity, 0)}% a month later; visits and pounds show no clear change.`}>

            <div className="flex flex-col gap-2">
              {prices.map((r) => {
                const t = tone(r.lo95, r.hi95);
                return (
                  <Verdict
                    key={r.signal}
                    tone={t}
                    label={SIG_SHORT[r.signal]}
                    text={t === "unclear" ? "no clear change" : `about +${fmt.num(r.cumulative_elasticity, 0)}% per 1% price rise, ${r.max_lag ? "the next month" : "the same month"}`}
                    detail={pctRange(r.lo95, r.hi95)}
                  />
                );
              })}
            </div>
          </Answer>
          <Answer n={2} title="What cycles remain after prices?" active={step === 1} summary={`Working days: each extra day adds about ${fmt.num(wd.HouseholdsTotal.pct_per_day, 1)}–${fmt.num(wd.PoundsTotal.pct_per_day, 1)}% to a month.`}>

            <div className="text-[13px] font-semibold text-ink">Each extra working day in a month adds</div>
            <div className="mt-1.5">
              <CompareBars
                rows={SIG_ORDER.map((s) => ({ label: SIG_SHORT[s], value: wd[s].pct_per_day, color: SIG_COLOR[s] }))}
                max={4}
                format={(v) => `+${fmt.num(v, 1)}%`}
              />
            </div>
            <p className="mt-2">
              Slower growth than January in {slow("HouseholdsTotal").join(" and ")} (visits) and {slow("IndividualsTotal").join(" and ")} (individuals). Net of working days, August is an
              ordinary month.
            </p>
          </Answer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ 9 · Q5 */

function Q5Slide() {
  const { step } = useStep();
  const snap = SIG_ORDER.map((s) => st.q5.find((x) => x.signal === s)!);
  const shocks = st.q5_noise.filter((r) => r.signal === "HouseholdsTotal");
  const shockName: Record<string, string> = {
    emergency_allotment_end: "SNAP emergency allotments end",
    nov2025_delay: "SNAP benefits delayed",
  };
  const place = deck.q5_place.HouseholdsTotal;
  const history = research.history.map((h) => ({ month: h.month, value: h.HouseholdsTotal }));
  return (
    <Frame
      meta={meta("q5")}
      kicker="SNAP enrollment and food-shelf use"
      title={
        <>
          SNAP and food shelves <Hl hot>move together</Hl>: more enrollment in a county comes with more visits, not fewer.
        </>
      }
      monday={{ decision: "Policy", text: "tell lawmakers SNAP and food shelves rise and fall together; ask DCYF for advance notice of benefit gaps so shelves can stock up." }}
      method="county and month fixed effects with site count and unemployment, clustered by SNAP unit; benefit events ranked among 52 months after season; nonmetro interaction"
      source="Minnesota DCYF SNAP caseload, county by month; q5_panel_coefficients.csv, q5_noise_summary.csv, q5_event_study.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.3fr_1fr] gap-5">
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface p-3">
          <span className="px-1 text-[13px] font-semibold text-ink">Statewide visits per month (HouseholdsReg)</span>
          <div className="min-h-0 flex-1">
            <LineStory
              points={history}
              events={[...shocks]
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((s) => ({ month: s.month, title: `${monthLabel(s.month)}: ${shockName[s.event] ?? s.event}`, sub: `#${s.rank_of_all} most unusual of ${s.months_ranked} months` }))}
              showEvents={step >= 1}
              format={fmt.compact}
              eventDelay={150}
              ariaLabel="Statewide monthly visits, 2022 to July 2026, with SNAP events"
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2.5">
          <Answer n={1} title="Together, or does one replace the other?" active={step === 0} summary={`Together: +${fmt.num(snap[0].coefficient, 2)}% visits per +1% SNAP enrollment in the county.`}>

            <div className="flex flex-col gap-1.5">
              {snap.map((r) => {
                const t = tone(r.lo95, r.hi95);
                return (
                  <Verdict
                    key={r.signal}
                    tone={t}
                    label={SIG_SHORT[r.signal]}
                    text={t === "unclear" ? "no clear change" : `+${fmt.num(r.coefficient, 2)}% per +1% enrollment${t === "borderline" ? " (borderline)" : ""}`}
                    detail={pctRange(r.lo95, r.hi95, 2)}
                  />
                );
              })}
            </div>
          </Answer>
          <Answer n={2} title="What happens when benefits change?" active={step === 1} summary="Both SNAP shocks fell in unusually high months for visits.">

            Both shocks fell in unusually high months for visits after allowing for season (#{shocks.find((s) => s.event === "emergency_allotment_end")?.rank_of_all} and #
            {shocks.find((s) => s.event === "nov2025_delay")?.rank_of_all} of 52). They coincided; we don't claim the cause.
          </Answer>
          <Answer n={3} title="Does it differ by place?" active={step === 2} summary="No clear difference for rural counties.">

            No clear difference for rural counties (visits {fmt.num(place.coef, 2)}, range {fmt.num(place.lo95, 2)} to {fmt.num(place.hi95, 2)}), and November 2025 hit high-SNAP
            counties no harder. Tribal SNAP agencies are reported separately.
          </Answer>
        </div>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------------ 10–11 · Q7 */

const SUBMITTED: ForecastSignal[] = ["HouseholdsTotal", "PoundsTotal", "ChildrenTotal", "AdultsTotal", "SeniorsTotal"];

function Q7ResultSlide() {
  const state = Object.fromEntries(st.q7_state.map((r) => [r.signal, r.yhat])) as Record<string, number>;
  const visits = state.HouseholdsTotal;
  const july = research.history.find((h) => h.month === research.meta.observed_end)?.HouseholdsTotal ?? null;
  const points = research.history.filter((h) => h.month >= "2024-01").map((h) => ({ month: h.month, value: h.HouseholdsTotal }));
  const bt = st.q7_backtest.filter((r) => r.signal === "HouseholdsTotal");
  const rmse = (m: string) => bt.find((r) => r.model === m)?.rmse ?? null;
  const naive = rmse("seasonal_naive");
  const ours = rmse("recent3_weighted");
  const times = naive && ours ? Math.round(naive / ours) : null;
  const bars = (["seasonal_naive", "july_naive", "recent3_weighted"] as const).flatMap((m) => {
    const v = rmse(m);
    return v == null ? [] : [{ label: m === "recent3_weighted" ? "Our run rate (submitted)" : MODEL_LABEL[m], value: v, color: m === "recent3_weighted" ? "var(--accent)" : "var(--line-strong)", strong: m === "recent3_weighted" }];
  });
  return (
    <Frame
      meta={meta("q7-result")}
      kicker="August 2026 forecast, as submitted"
      title={
        <>
          August: about <Hl>{fmt.compact(visits)} visits</Hl> and {fmt.compact(state.PoundsTotal)} pounds, with county error {times ? `about ${times}× smaller` : "far below"} than “repeat last August”.
        </>
      }
      monday={{ decision: "Allocation", text: "set August orders from each county's forecast; the shelf portal shows the same number to the shelf." }}
      method="root mean squared county error over the August 2023–2025 folds (the scoring metric); the same folds chose the model, so this is development error"
      source="outputs/submission/Graduate_Predictions_Submit.csv (team G08, 87 counties); q7_backtest.csv"
    >
      <div className="grid h-full min-h-0 grid-cols-[1.4fr_1fr] gap-5">
        <div className="flex min-h-0 flex-col rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <span className="text-[13px] font-semibold text-ink">Statewide visits per month, with the August forecast</span>
            <span className="tabular text-[12.5px] text-ink-2">
              July {fmt.int(july)} → August {fmt.int(visits)} ({fmt.signedPct(july ? visits / july - 1 : null, 1)})
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <LineStory
              points={points}
              forecast={{
                month: research.meta.forecast_target,
                value: visits,
                label: (
                  <div>
                    <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Aug 2026 forecast</div>
                    <div className="tabular text-[22px] font-bold leading-tight text-accent">{fmt.int(visits)}</div>
                    <div className="text-[11.5px] text-muted">21 working days vs July's 22</div>
                  </div>
                ),
              }}
              format={fmt.compact}
              ariaLabel="Statewide visits by month with the August 2026 forecast"
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <Panel title="What we submitted (sum of 87 counties)">
            <ul className="divide-y divide-[var(--line)]">
              {SUBMITTED.map((s) => (
                <li key={s} className="flex items-baseline justify-between gap-3 py-[3px]">
                  <span>
                    <span className="text-[15px] font-medium text-ink">{SIGNAL_LABEL[s]}</span> <span className="text-[11.5px] text-muted">{SIGNAL_FIELD[s]}</span>
                  </span>
                  <span className="tabular text-[18px] font-semibold text-ink">
                    <CountUp value={state[s]} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[12px] text-muted">Graduate addendum: children + adults + seniors add up to individuals in every county. Wilkin = 0 (no reporting shelf).</p>
          </Panel>
          <Panel title="County error in visits, last three Augusts · lower is better" className="flex-1">
            <CompareBars rows={bars} format={(v) => fmt.int(v)} delay={200} compact />
          </Panel>
        </div>
      </div>
    </Frame>
  );
}

function Q7MethodSlide() {
  const { step } = useStep();
  const rr = statewideRunRate("HouseholdsTotal");
  const submitted = st.q7_state.find((r) => r.signal === "HouseholdsTotal")?.yhat;
  return (
    <Frame
      meta={meta("q7-method")}
      kicker="How the forecast works"
      title={
        <>
          A rule a manager can redo by hand: recent <Hl>pace per working day</Hl>, weighted toward July, times August's working days.
        </>
      }
      monday={{ decision: "Allocation", text: "plan August supply on 21 working days, not July's 22." }}
      method={`recent3_weighted (D-045), chosen on squared error over August 2023–2025; shown statewide, applied per county and field (county sum ${fmt.int(submitted)})`}
      source="q7_eval.md, q7_august2026_wide.csv; no August 2026 actual is used (mi.guards)"
    >
      {rr.perDay != null && rr.yhat != null && (
        <PaceStory steps={rr.steps} perDay={rr.perDay} target={rr.target} days={monthDays(rr.target)} yhat={rr.yhat} stage={step} unit="visits" />
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ 12–13 · tool and Monday */

function DemoSlide() {
  const { setRole } = useData();
  const stops = [
    { who: "Roshit", time: "12 s", href: "/manager", role: "manager" as const, icon: "dashboard", title: "Command center", q: "Q1 · Q7", what: "Click a county: its 24-month trend, the August forecast, its sites by type and open alerts." },
    { who: "Roshit", time: "8 s", href: "/shelf", role: "shelf" as const, icon: "store", title: "Food shelf portal", q: "Q7", what: "The monthly report in the network's own fields, and next month's forecast for the shelf itself." },
    { who: "Jacob", time: "12 s", href: "/manager/scenarios", role: "manager" as const, icon: "target", title: "Site planner", q: "Q8 · Q6", what: "Place a shelf in a high-barrier county: residents brought within reach and the driving time." },
    { who: "Jacob", time: "8 s", href: "/manager/allocation", role: "manager" as const, icon: "truck", title: "Supply allocation", q: "Q1 · Q6", what: "Split a supply pool by need and barriers instead of by visits alone, and see which counties gain." },
  ];
  return (
    <Frame
      meta={meta("demo")}
      kicker="FoodBridge, live"
      title={
        <>
          The same evidence, in the tool staff would open on <Hl>Monday morning</Hl>.
        </>
      }
      monday={{ decision: "All four", text: "managers allocate and site from one screen; each shelf sees its own forecast and reports in the same fields." }}
      source="county and tract aggregates only; forecasts labelled; the AI briefing retrieves and cites figures and never computes one. Browser Back returns here."
    >
      <div className="grid h-full grid-cols-2 content-center gap-4">
        {stops.map((s, i) => (
          <Link
            key={s.href}
            href={s.href}
            onClick={() => setRole(s.role)}
            className="fb-rise group flex gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-0.5 hover:border-accent"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-accent">
              <Icon name={s.icon} className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular text-[13px] font-bold text-muted">{i + 1}</span>
                <span className="text-[19px] font-semibold text-ink">{s.title}</span>
                <Badge tone="green">{s.q}</Badge>
              </span>
              <span className="mt-1 block text-[15px] leading-snug text-ink-2">{s.what}</span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: SPEAKER_COLOR[s.who as "Jacob" | "Roshit"] }} />
                {s.who} · {s.time}
                <span className="ml-2 inline-flex items-center gap-1 font-medium text-accent">
                  Open <Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Frame>
  );
}

function CloseSlide() {
  const cols = [
    { d: "Allocate", icon: "truck", q: "Q1 · Q6 · Q7", text: "Split supply by barriers as well as visits; order August on each county's forecast." },
    { d: "Site", icon: "pin", q: "Q8 · Q6", text: `Check the ${priorityNames.length} priority counties and shelf-less low-access tracts first; test a site in the planner.` },
    { d: "Argue", icon: "scale", q: "Q5 · Q4", text: "SNAP and shelves move together: protect SNAP, and ask DCYF for advance notice of benefit gaps." },
    { d: "Measure", icon: "index", q: "Q6", text: "Report barriers next to visits, so results are judged on who still can't reach food." },
  ];
  return (
    <Frame
      meta={meta("close")}
      kicker="What changes on Monday"
      title={
        <>
          The Food Group can't see need directly. It can see <Hl>where barriers keep need from becoming demand</Hl>, and act on it.
        </>
      }
      source="FEI and the Q6 score are screening measures, not counts of unmet people; nothing here is a causal effect; every number is reproduced from code in the team repository."
    >
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="grid grid-cols-4 gap-4">
          {cols.map((c, i) => (
            <div key={c.d} className="fb-rise flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]" style={{ animationDelay: `${i * 110}ms` }}>
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-accent">
                  <Icon name={c.icon} className="h-5 w-5" />
                </span>
                <Badge tone="green">{c.q}</Badge>
              </div>
              <span className="mt-3 text-[22px] font-semibold text-ink">{c.d}</span>
              <p className="mt-1 text-[15.5px] leading-snug text-ink-2">{c.text}</p>
            </div>
          ))}
        </div>
        <p className="fb-rise text-center text-[26px] font-semibold text-ink" style={{ animationDelay: "500ms" }}>
          Thank you. Questions?
        </p>
      </div>
    </Frame>
  );
}

/* --------------------------------------------------------------- appendix */

function AppendixQ6() {
  const box = (h: string, b: string) => (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">{h}</div>
      <p className="mt-1.5 text-[14.5px] leading-snug text-ink">{b}</p>
    </div>
  );
  return (
    <Frame
      meta={meta("a-q6")}
      kicker="Appendix · Q6 graduate addendum"
      title="A need definition that could be proven wrong."
      source="docs/reference/q6_addendum.md; q6_falsification_checks.csv. Q6 score = mean county percentile of the Map the Meal Gap rate, ACS poverty and no-vehicle share; FEI is the tract-level extension."
    >
      <div className="grid h-full grid-cols-2 content-start gap-3 overflow-y-auto">
        {box("1 · Definition", "Need: a household lacks reliable resources for adequate food over a set recall period, whether or not it asks for charitable food. Higher hardship and transport constraints should mark more of it, including among non-users.")}
        {box("2 · Why need, not demand", "No input uses visits, pounds or individuals served. The score is built only from public hardship and access data, so it can disagree with activity, and the gap is the finding.")}
        {box("3 · Reject if", "A household food-security survey that includes non-users finds no higher hardship in high-score counties, with a confidence bound that rules out a useful difference. Not yet run; we claim no survey validation.")}
        {box("4 · Revise if", "Dropping one input or changing the Map the Meal Gap edition moves a county more than one fifth; or fieldwork shows the vehicle measure mostly flags well-served urban households.")}
        <div className="col-span-2 rounded-xl border border-line bg-surface p-4">
          <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Checks run now (82 SNAP units)</div>
          <ul className="tabular mt-1.5 space-y-1 text-[14px] text-ink-2">
            {st.q6_checks.map((c) => (
              <li key={c.check}>
                {c.check.replaceAll("_", " ")}: <b className="text-ink">ρ {fmt.num(c.spearman, 2)}</b> [{fmt.num(c.lo95, 2)}, {fmt.num(c.hi95, 2)}] · {c.rule}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

function AppendixQ7() {
  const signals: ForecastSignal[] = ["HouseholdsTotal", "PoundsTotal", "ChildrenTotal", "AdultsTotal", "SeniorsTotal", "IndividualsTotal"];
  const models = Object.keys(MODEL_LABEL);
  const cov = st.q7_intervals.filter((r) => r.target_month === "2025-08");
  return (
    <Frame
      meta={meta("a-q7")}
      kicker="Appendix · Q7 back-test"
      title="The submitted run rate beats every simple baseline in all six fields."
      source="Root mean squared county error over the August 2023/2024/2025 folds (q7_backtest.csv), sponsor units. Coverage: share of counties inside the band in August 2025 (q7_interval_coverage.csv); nominal bands, not guaranteed probabilities."
    >
      <div className="h-full overflow-auto">
        <table className="tabular w-full text-[14.5px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 pr-3 font-medium">Field</th>
              {models.map((m) => (
                <th key={m} className={cx("py-1.5 pr-3 text-right font-medium", m === "recent3_weighted" && "text-accent")}>
                  {MODEL_LABEL[m]}
                </th>
              ))}
              <th className="py-1.5 text-right font-medium">80% band coverage, Aug 2025</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s} className="border-t border-line">
                <td className="py-2 pr-3 text-ink">
                  {SIGNAL_LABEL[s]} <span className="text-[12px] text-muted">{SIGNAL_FIELD[s]}</span>
                </td>
                {models.map((m) => {
                  const r = st.q7_backtest.find((x) => x.signal === s && x.model === m);
                  return (
                    <td key={m} className={cx("py-2 pr-3 text-right", m === "recent3_weighted" ? "font-semibold text-ink" : "text-ink-2")}>
                      {fmt.int(r?.rmse)}
                    </td>
                  );
                })}
                <td className="py-2 text-right text-ink-2">{fmt.pct(cov.find((c) => c.signal === s)?.coverage80, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

function AppendixFei() {
  const label: Record<string, string> = {
    fei_vs_snap_participation: "SNAP participation (not an input)",
    fei_vs_q6_need_percentile: "Q6 need score",
    fei_vs_mmg_food_insecurity_rate_private: "Map the Meal Gap food-insecurity rate",
    access_TM_vs_HouseholdsTotal_per_1000_low_income: "Travel+mobility vs visits per low-income resident",
    access_TM_vs_PoundsTotal_per_1000_low_income: "Travel+mobility vs pounds per low-income resident",
    access_TM_vs_IndividualsTotal_per_1000_low_income: "Travel+mobility vs individuals per low-income resident",
  };
  return (
    <Frame
      meta={meta("a-fei")}
      kicker="Appendix · FEI validation and stability"
      title="FEI agrees with need signals it never used, and its ranking survives re-weighting."
      source="fei_validation.csv (bootstrap Spearman ρ, 95% intervals; the Map the Meal Gap comparison is published as ρ only, D-050) and fei_sensitivity.csv."
    >
      <div className="grid h-full grid-cols-2 gap-6 overflow-auto">
        <table className="tabular w-full self-start text-[14.5px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 font-medium">Check</th>
              <th className="py-1.5 text-right font-medium">ρ [95%]</th>
            </tr>
          </thead>
          <tbody>
            {feiChecks.map((v) => (
              <tr key={v.check} className="border-t border-line">
                <td className="py-2 text-ink">{label[v.check] ?? v.check}</td>
                <td className="py-2 text-right text-ink-2">
                  <b className="text-ink">{fmt.num(v.spearman, 2)}</b> [{fmt.num(v.lo95, 2)}, {fmt.num(v.hi95, 2)}]
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="tabular w-full self-start text-[14.5px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 font-medium">Weighting variant</th>
              <th className="py-1.5 text-right font-medium">County ρ</th>
              <th className="py-1.5 text-right font-medium">Top fifth kept</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((s) => (
              <tr key={s.variant} className="border-t border-line">
                <td className="py-2 text-ink">{s.variant.replaceAll("_", " ")}</td>
                <td className="py-2 text-right text-ink">{fmt.num(s.county_spearman, 2)}</td>
                <td className="py-2 text-right text-ink-2">{fmt.pct(s.county_top_quintile_kept, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

function AppendixSources() {
  const provided = [
    "The Food Group: org_FSStats and Organization extracts, January 2022–July 2026",
    "Feeding America Map the Meal Gap, 2024–2026 editions (licensed; cited, not redistributed)",
    "BLS CPI food at home: US, Midwest, Minneapolis–St. Paul",
    "Minnesota DCYF SNAP caseload and benefits, monthly by agency",
    "Minnesota Department of Education school-meal claims (context)",
  ];
  const additional = [
    "U.S. Census Bureau ACS five-year 2020–2024 and 2019–2023 (county need signals, with margins of error)",
    "U.S. Census Bureau 2020 Census blocks, tract relationship file, cartographic boundaries, Census Geocoder",
    "USDA ERS Food Access Research Atlas 2019 (LILA), SNAP Retailer Access Map 2025, Rural-Urban Continuum Codes 2023",
    "BLS Local Area Unemployment Statistics, county monthly",
    "USDA FNS SNAP state data tables (cross-check)",
    "CDC/ATSDR Social Vulnerability Index 2022",
    "HUD Fair Market Rents FY2022–FY2026; Census Population Estimates Vintage 2025",
    "FEMA disaster declarations; EIA Minnesota gasoline prices",
    "OpenStreetMap (Geofabrik) road network routed with OSRM (driving access)",
    "Urban Institute Well-Being and Basic Needs Survey; USDA ERS and DCYF reports for definitions and policy dates",
  ];
  return (
    <Frame
      meta={meta("a-sources")}
      kicker="Appendix · data sources"
      title="Provided data, plus public sources beyond them, each with publisher, grain and vintage in our catalog."
      source="docs/sources/catalog.md: one row per source (publisher, exact series, geography, time grain, vintage, URL, access date, why chosen)."
    >
      <div className="grid h-full grid-cols-[1fr_1.4fr] gap-6 overflow-auto">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Provided by the challenge</div>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14.5px] text-ink-2">
            {provided.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">Additional public sources</div>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14.5px] text-ink">
            {additional.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

const VIEWS: Record<string, () => ReactNode> = {
  title: TitleSlide,
  fei: FeiSlide,
  "fei-map": FeiMapSlide,
  q6: Q6Slide,
  q1: Q1Slide,
  divergence: DivergenceSlide,
  q8: Q8Slide,
  q4: Q4Slide,
  q5: Q5Slide,
  "q7-method": Q7MethodSlide,
  "q7-result": Q7ResultSlide,
  demo: DemoSlide,
  close: CloseSlide,
  "a-q6": AppendixQ6,
  "a-q7": AppendixQ7,
  "a-fei": AppendixFei,
  "a-sources": AppendixSources,
};

/* ------------------------------------------------------------------ deck */

const ENDS = cumulativeSeconds();
const stepsOf = (k: number) => SLIDES[k]?.steps?.length ?? 1;

function slideFromHash(): number {
  const n = Number.parseInt(window.location.hash.replace("#", ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(SLIDES.length - 1, n - 1)) : 0;
}

export default function Presentation() {
  const theme = useTheme();
  const [i, setI] = useState(0);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The slide lives in the URL hash, so the browser Back button returns here after a demo stop.
  useEffect(() => setI(slideFromHash()), []);
  useEffect(() => {
    window.history.replaceState(null, "", `#${i + 1}`);
  }, [i]);
  useEffect(() => {
    if (startedAt == null) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [startedAt]);

  /** Jump to a slide; `atStep` -1 opens it fully built (used when stepping backwards). */
  const go = useCallback(
    (to: number, atStep = 0) => {
      const next = Math.max(0, Math.min(SLIDES.length - 1, to));
      if (startedAt == null && next > 0 && !SLIDES[next].appendix) setStartedAt(Date.now());
      setI(next);
      setStep(atStep < 0 ? stepsOf(next) - 1 : atStep);
    },
    [startedAt],
  );
  const forward = useCallback(() => (step < stepsOf(i) - 1 ? setStep(step + 1) : go(i + 1)), [step, i, go]);
  const back = useCallback(() => (step > 0 ? setStep(step - 1) : i > 0 ? go(i - 1, -1) : undefined), [step, i, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (["arrowright", "pagedown", " "].includes(k)) {
        e.preventDefault();
        forward();
      } else if (["arrowleft", "pageup"].includes(k)) back();
      else if (k === "arrowdown") go(i + 1);
      else if (k === "arrowup") go(i - 1);
      else if (k === "home") go(0);
      else if (k === "end") go(MAIN_SLIDES.length - 1);
      else if (k === "a") go(FIRST_APPENDIX);
      else if (k === "n") setNotes((v) => !v);
      else if (k === "t") {
        setStartedAt(Date.now());
        setNow(Date.now());
      } else if (k === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      } else if (k === "escape") setNotes(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forward, back, go, i]);

  const m = SLIDES[i];
  const View = VIEWS[m.id];
  const elapsed = startedAt == null ? 0 : (now - startedAt) / 1000;
  const target = m.appendix ? TALK_SECONDS : ENDS[i];
  const late = startedAt != null && elapsed > target + 10;
  const ctx = useMemo(() => ({ step, setStep, index: i }), [step, i]);

  return (
    <div className="fb-deck flex h-dvh flex-col bg-[var(--rail)]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Link href="/" className="flex items-center gap-2 text-[13.5px] font-semibold text-ink" title="Back to FoodBridge home">
          <BrandMark className="h-6 w-6" /> FoodBridge
        </Link>
        <span className="hidden text-[12.5px] text-muted sm:inline">· {m.part}</span>
        <div className="mx-2 flex h-2 flex-1 items-center gap-[3px]" aria-label="Talk progress">
          {MAIN_SLIDES.map((s, j) => (
            <button
              key={s.id}
              onClick={() => go(j)}
              title={`${j + 1}. ${s.id} · ${s.speakers.join(" + ")} · ${clock(s.seconds)}`}
              className="h-2 rounded-full transition-opacity"
              style={{ flexGrow: s.seconds, background: SPEAKER_COLOR[s.speakers[0]], opacity: j === i ? 1 : j < i ? 0.55 : 0.2 }}
            />
          ))}
          <span className="w-2" />
          {SLIDES.filter((s) => s.appendix).map((s, j) => (
            <button
              key={s.id}
              onClick={() => go(FIRST_APPENDIX + j)}
              title={`Appendix: ${s.id}`}
              className="h-2 w-2 shrink-0 rounded-full bg-[var(--muted)]"
              style={{ opacity: FIRST_APPENDIX + j === i ? 1 : 0.3 }}
            />
          ))}
        </div>
        <span className="tabular text-[12.5px] text-muted">
          {m.appendix ? `A${i - FIRST_APPENDIX + 1}` : `${i + 1} / ${MAIN_SLIDES.length}`}
          {m.steps && ` · step ${step + 1}/${m.steps.length}`}
        </span>
        <button
          onClick={() => {
            setStartedAt(Date.now());
            setNow(Date.now());
          }}
          className={cx("tabular rounded-md px-2 py-0.5 text-[12.5px] font-semibold", late ? "bg-[var(--critical)] text-white" : "bg-surface-2 text-ink")}
          title="Talk clock vs the plan at the end of this slide (T restarts)"
        >
          {clock(elapsed)} / {clock(target)}
        </button>
        <button onClick={() => setNotes((v) => !v)} className={cx(buttonClass("ghost", "sm"), notes && "bg-surface-2")} title="Speaker notes (N)">
          Notes
        </button>
        <button
          onClick={() => setThemePref(theme === "dark" ? "light" : "dark")}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
          aria-label="Switch theme"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        <button
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.())}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
          aria-label="Full screen (F)"
        >
          <Icon name="expand" />
        </button>
      </header>

      <main id="main" className="relative min-h-0 flex-1">
        <Stage>
          <StepCtx.Provider value={ctx}>
            <View key={m.id} />
          </StepCtx.Provider>
        </Stage>
        <button onClick={back} disabled={i === 0 && step === 0} aria-label="Previous" className="absolute inset-y-0 left-0 w-6 opacity-0 hover:bg-white/5 hover:opacity-100 disabled:hidden" />
        <button
          onClick={forward}
          disabled={i === SLIDES.length - 1 && step === stepsOf(i) - 1}
          aria-label="Next"
          className="absolute inset-y-0 right-0 w-6 opacity-0 hover:bg-white/5 hover:opacity-100 disabled:hidden"
        />
      </main>

      {notes && (
        <aside className="max-h-[34vh] shrink-0 overflow-y-auto border-t border-line bg-surface px-6 py-3 sm:px-10">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span className="font-semibold text-ink">{m.speakers.join(" + ")}</span>
            {!m.appendix && (
              <span className="tabular text-muted">
                {clock(m.seconds)} on this slide · finish by {clock(target)}
              </span>
            )}
            {m.appendix && <span className="text-muted">Appendix: only if a judge asks</span>}
            <span className="flex-1" />
            <span className="text-[11.5px] text-muted">→ next step · ↓ skip to next slide · A appendix · T restart clock · F full screen · N hide notes</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-ink-2">
            {m.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {m.files.length > 0 && <p className="mt-2 text-[11.5px] text-muted">Numbers from: {m.files.join(" · ")}</p>}
        </aside>
      )}
    </div>
  );
}
