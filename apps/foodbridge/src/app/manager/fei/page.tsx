"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarList, StackedBar } from "@/components/charts";
import { CountyMapCard } from "@/components/map/CountyMapCard";
import { Badge, Card, PageHeader, Segmented, SourceNote, Stat } from "@/components/ui";
import { useFeiTracts } from "@/lib/feiTracts";
import { fmt } from "@/lib/format";
import { PILLARS } from "@/lib/pillars";
import { countiesByFips, equityValue, feiReady, research } from "@/lib/research";
import type { County, Pillar } from "@/lib/types";

interface Kpis {
  residents?: number;
  residents_beyond?: number;
  residents_beyond_share?: number;
  median_fei?: number;
  residents_top_quintile?: number;
  children_top_quintile?: number;
  est_carless_hh_beyond?: number;
  counties_top_quintile_and_q6_priority?: number;
  counties_top_quintile_and_q6_priority_names?: string[];
  shelves_reporting?: number;
}
interface ValidationRow {
  check: string;
  rule: string;
  spearman: number | null;
  lo95: number | null;
  hi95: number | null;
  n: number;
  result: string;
  stratum: string | null;
  mean_T: number | null;
  mean_miles: number | null;
}
interface SensitivityRow {
  variant: string;
  tract_spearman: number;
  tract_top_quintile_kept: number;
  county_spearman: number;
  county_top_quintile_kept: number;
}

const CHECK_LABEL: Record<string, string> = {
  fei_vs_snap_participation: "FEI vs SNAP participation (not an input)",
  fei_vs_q6_need_percentile: "FEI vs Q6 need percentile",
  fei_vs_mmg_food_insecurity_rate_private: "FEI vs Map the Meal Gap rate (private check)",
  access_TM_vs_HouseholdsTotal_per_1000_low_income: "Travel+mobility vs visits per low-income resident",
  access_TM_vs_PoundsTotal_per_1000_low_income: "Travel+mobility vs pounds per low-income resident",
  access_TM_vs_IndividualsTotal_per_1000_low_income: "Travel+mobility vs individuals per low-income resident",
};

function weighted(values: Partial<Record<Pillar, number | null | undefined>>) {
  return PILLARS.map((p) => ({
    key: p.key,
    label: p.label,
    color: p.color,
    value: 100 * p.weight * (values[p.key] ?? 0),
  }));
}

export default function FeiOverview() {
  const [selected, setSelected] = useState<string>("27023");
  const [geo, setGeo] = useState<"county" | "tract">("tract");
  const [pillar, setPillar] = useState<"fei" | Pillar>("fei");
  const { data: tractData, error: tractError } = useFeiTracts();
  const counties = research.counties;
  const meta = research.fei.meta ?? {};
  const kpis = (meta.kpis ?? {}) as Kpis;
  const validation = ((meta.fei_validation as ValidationRow[] | undefined) ?? []).filter((v) => v.spearman != null);
  const sensitivity = (meta.fei_sensitivity as SensitivityRow[] | undefined) ?? [];

  const countyValue = (c: County) => (pillar === "fei" ? equityValue(c) : ((c.fei?.[pillar] as number | null) ?? null));
  const values = useMemo(() => {
    if (geo === "tract" && tractData) {
      return Object.fromEntries(
        tractData.tracts.map((t) => [t.geoid, pillar === "fei" ? (t.fei ?? null) : ((t[pillar] as number | null) ?? null)]),
      );
    }
    return Object.fromEntries(counties.map((c) => [c.fips, countyValue(c)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, tractData, pillar, counties]);
  const ranked = useMemo(
    () => [...counties].filter((c) => equityValue(c) != null).sort((a, b) => (equityValue(b) ?? 0) - (equityValue(a) ?? 0)),
    [counties],
  );
  const sel = countiesByFips[selected];
  const robustSet = useMemo(() => new Set(counties.filter((c) => c.robust).map((c) => c.fips)), [counties]);
  const tractsHere = tractData?.tracts.filter((t) => t.county === selected).sort((a, b) => (b.fei ?? 0) - (a.fei ?? 0)) ?? [];
  const tractName = (id: string) => {
    const t = tractData?.tracts.find((x) => x.geoid === id);
    return `Tract ${id.slice(5)} · ${countiesByFips[t?.county ?? id.slice(0, 5)]?.name ?? ""} County`;
  };

  if (!feiReady) {
    return (
      <>
        <PageHeader
          eyebrow="Executive overview"
          title="Food Access Equity Index"
          description="The FEI build (task A4) has not landed in this deployment. FoodBridge never computes its own FEI."
          actions={<Badge tone="demo">FEI pending</Badge>}
        />
        <Card>
          <p className="text-[14px] text-ink-2">
            Run <code className="rounded bg-surface-2 px-1">uv run python -m mi.fei</code>, then{" "}
            <code className="rounded bg-surface-2 px-1">uv run python -m mi.foodbridge_bundle</code>. Until then the maps show
            the Q6 need percentile, labelled as a placeholder. {research.meta.fei_reason}
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Executive overview"
        title="Food Access Equity Index"
        description="One 0–100 score for how many barriers stand between residents who may need food and the food-shelf network: need, local supply, travel, mobility and demographic vulnerability. Higher = more barriers. A screening index for where to look and where siting may help; not a count of unmet people, and not causal."
        actions={
          <>
            <Badge tone="green">2024 reporting network · straight-line miles · Census 2020</Badge>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Median tract FEI" value={fmt.num(kpis.median_fei, 1)} sub={`${fmt.int(kpis.residents)} residents scored in 1,501 tracts`} />
        <Stat
          label="Residents beyond 1 / 10 mi"
          value={fmt.compact(kpis.residents_beyond)}
          sub={`${fmt.pct(kpis.residents_beyond_share)} of residents are beyond 1 mile (urban) or 10 miles (rural) of the nearest reporting shelf`}
        />
        <Stat
          label="In top-quintile tracts"
          value={fmt.compact(kpis.residents_top_quintile)}
          sub={`including ${fmt.compact(kpis.children_top_quintile)} children`}
        />
        <Stat
          label="FEI top quintile and Q6 priority"
          value={kpis.counties_top_quintile_and_q6_priority ?? "—"}
          sub={(kpis.counties_top_quintile_and_q6_priority_names ?? []).join(", ")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
        <div className="min-w-0">
          <CountyMapCard
            title={pillar === "fei" ? "FEI" : `${pillar} · ${PILLARS.find((p) => p.key === pillar)?.label} pillar`}
            subtitle={geo === "tract" && !tractData ? (tractError ?? "Loading 1,501 tracts…") : "Hover for values; click a county for its breakdown. Dashed: Q6 audit-first counties."}
            actions={
              <div className="flex flex-wrap gap-2">
                <Segmented<"county" | "tract">
                  size="sm"
                  label="Geography"
                  value={geo}
                  onChange={setGeo}
                  options={[
                    { value: "county", label: "Counties" },
                    { value: "tract", label: "Tracts" },
                  ]}
                />
                <select
                  aria-label="Layer"
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value as "fei" | Pillar)}
                  className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[12.5px] text-ink"
                >
                  <option value="fei">FEI</option>
                  {PILLARS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.key} · {p.label}
                    </option>
                  ))}
                </select>
              </div>
            }
            values={values}
            legendTitle={pillar === "fei" ? "FEI" : `${pillar} pillar (0–1)`}
            format={(v) => (pillar === "fei" ? fmt.num(v, 0) : fmt.num(v, 2))}
            domain={pillar === "fei" ? undefined : [0, 1]}
            selected={geo === "county" ? selected : null}
            onSelect={(id) => {
              if (geo === "county") setSelected(id);
              else setSelected(id.slice(0, 5));
            }}
            highlight={robustSet}
            geometry={geo === "tract" && tractData ? tractData.geometry : undefined}
            unitName={geo === "tract" ? tractName : undefined}
            height={680}
          />
          <SourceNote>
            Distances run to the nearest <em>reporting</em> shelf. A place can look far from food help only because its local
            shelf is outside the statewide reporting network (Crookston, for example, has only a meal program in the data).
          </SourceNote>
        </div>

        <div className="space-y-4">
          <Card title={`${sel.name} County`} subtitle={`${sel.nonmetro ? "Nonmetro" : "Metro"} · ${fmt.int(sel.population)} residents (ACS)`}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="tabular text-3xl font-semibold text-ink">{fmt.num(sel.fei?.fei, 1)}</span>
              <span className="text-[13px] text-muted">
                FEI · rank {sel.fei?.rank ?? "—"} of 87 (1 = most barriers) · quintile {sel.fei?.quintile ?? "—"}
              </span>
              {sel.fei?.stable_high && <Badge tone="demo">Stable high</Badge>}
            </div>
            <p className="mt-3 text-[12.5px] font-medium text-ink-2">Why this score: weighted points by pillar (sum = FEI)</p>
            <div className="mt-1.5">
              <StackedBar parts={weighted(sel.fei ?? {})} total={100} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-muted">Pounds per low-income resident within reach</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.num(sel.fei?.lbs_per_lowinc, 0)} lb/yr</dd>
              <dt className="text-muted">Miles to nearest reporting shelf</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.num(sel.fei?.miles_nearest, 1)}</dd>
              <dt className="text-muted">Residents beyond threshold</dt>
              <dd className="tabular text-right font-medium text-ink">
                {fmt.int(sel.fei?.beyond_residents)} ({fmt.pct(sel.fei?.beyond_share)})
              </dd>
              <dt className="text-muted">Carless households beyond (est.)</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.int(sel.fei?.carless_beyond)}</dd>
              <dt className="text-muted">Children in top-quintile tracts</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.int(sel.fei?.children_top_quintile)}</dd>
              <dt className="text-muted">Reporting shelves (2024)</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.int(sel.fei?.shelves_reporting ?? sel.sites_2024)}</dd>
              <dt className="text-muted">Q6 need percentile</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.num(sel.need_percentile, 0)}</dd>
              <dt className="text-muted">SNAP participation (persons per resident)</dt>
              <dd className="tabular text-right font-medium text-ink">{fmt.num(sel.fei?.snap_participation, 3)}</dd>
            </dl>
            {sel.fei?.supply_understated && (
              <p className="mt-2 text-[12px] text-[var(--warning-text)]">
                Supply understated: over 10% of this county&apos;s pounds come from shelves without a usable location.
              </p>
            )}
            {tractsHere.length > 0 && (
              <>
                <p className="mt-4 text-[12.5px] font-medium text-ink-2">Highest-FEI tracts in {sel.name}</p>
                <ul className="mt-1 space-y-0.5 text-[12.5px]">
                  {tractsHere.slice(0, 5).map((t) => (
                    <li key={t.geoid} className="flex justify-between">
                      <span className="text-ink">Tract {t.geoid.slice(5)}</span>
                      <span className="tabular text-ink-2">
                        FEI {fmt.num(t.fei, 1)} · {fmt.num(t.d, 1)} mi · {fmt.int(t.pop)} residents
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
              <Link className="font-medium text-accent underline" href={`/manager/scenarios?county=${sel.fips}`}>
                Model a new shelf here
              </Link>
              <Link className="font-medium text-accent underline" href={`/manager/map?county=${sel.fips}`}>
                County evidence
              </Link>
            </div>
          </Card>

          <Card title="Highest-FEI counties" subtitle="Click to select.">
            <BarList
              rows={ranked.slice(0, 12).map((c) => ({ key: c.fips, label: c.name, value: equityValue(c) }))}
              onSelect={(f) => {
                setGeo("county");
                setSelected(f);
              }}
              format={(v) => fmt.num(v, 1)}
              max={100}
            />
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Does FEI measure need and access?" subtitle="Pre-stated rules from the FEI build. Bootstrap Spearman ρ with 95% intervals.">
          <div className="overflow-x-auto">
            <table className="tabular w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1 pr-2 font-medium">Check</th>
                  <th className="py-1 pr-2 text-right font-medium">ρ</th>
                  <th className="py-1 pr-2 text-right font-medium">95%</th>
                  <th className="py-1 text-right font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {validation.map((v) => (
                  <tr key={v.check} className="border-t border-line align-top">
                    <td className="py-1.5 pr-2 text-ink" title={v.rule}>
                      {CHECK_LABEL[v.check] ?? v.check}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold text-ink">{fmt.num(v.spearman, 2)}</td>
                    <td className="py-1.5 pr-2 text-right text-ink-2">
                      {fmt.num(v.lo95, 2)} to {fmt.num(v.hi95, 2)}
                    </td>
                    <td className="py-1.5 text-right text-ink-2">{v.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceNote>
            outputs/tables/fei_validation.csv. The Map the Meal Gap comparison is private: only ρ, interval and n are published
            (D-050). Negative access-vs-activity correlations mean counties with more travel and mobility barriers record fewer
            visits per low-income resident, consistent with barriers suppressing observed demand.
          </SourceNote>
        </Card>
        <Card title="Is the ranking stable?" subtitle="Each variant re-weights or re-specifies FEI; how much of the default ranking survives.">
          <table className="tabular w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Variant</th>
                <th className="py-1 text-right font-medium">County ρ</th>
                <th className="py-1 text-right font-medium">Top quintile kept</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.map((s) => (
                <tr key={s.variant} className="border-t border-line">
                  <td className="py-1.5 text-ink">{s.variant.replaceAll("_", " ")}</td>
                  <td className="py-1.5 text-right font-semibold text-ink">{fmt.num(s.county_spearman, 2)}</td>
                  <td className="py-1.5 text-right text-ink-2">{fmt.pct(s.county_top_quintile_kept)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SourceNote>outputs/tables/fei_sensitivity.csv · weights are policy choices; &ldquo;stable high&rdquo; = top quintile in ≥ 80% of variants.</SourceNote>
        </Card>
      </div>

      <Card className="mt-4" title="How FEI works" subtitle="FEI = 100 × (0.25·N + 0.25·S + 0.20·T + 0.15·M + 0.15·V). Each pillar 0–1, 1 = worst.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {PILLARS.map((p) => (
            <div key={p.key} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                  {p.key} · {p.label}
                </span>
                <span className="tabular text-[12px] text-muted">{Math.round(p.weight * 100)}%</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{p.what}</p>
            </div>
          ))}
        </div>
        <SourceNote>
          Built by <code>uv run python -m mi.fei</code>
          {research.fei.source?.commit ? ` (commit ${research.fei.source.commit})` : ""}. FoodBridge shows the default
          straight-line FEI; the build also publishes road-distance variants. Shelves are located for distances only and shown
          on maps as county counts. Adapted from the Burn Equity Index method
          (robust 5th–95th percentile normalization, enhanced two-step floating catchment, population-weighted county rollup).
          Tract inputs use published indices and flags, exact 2020 counts, distances and county ACS values assigned to tracts
          (D-020). SNAP participation, Map the Meal Gap and food-shelf visits are not inputs; they are used to validate.
        </SourceNote>
      </Card>
    </>
  );
}
