"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChangeBars, StackedBar, TimeChart } from "@/components/charts";
import { TYPE_COLOR, TYPE_SHORT } from "@/components/siteTypeStyle";
import { Badge, Card, Icon, Segmented, SeverityBadge, SourceNote, type Info } from "@/components/ui";
import type { Alert } from "@/lib/alerts";
import { addMonths, monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { SITE_TYPES, type SiteType, type SiteTypeCell, type SiteTypeMix } from "@/lib/networks";
import { countiesByFips, EQUITY_SHORT, equityValue, research, SIGNAL_FIELD, SIGNAL_LABEL, SIGNALS } from "@/lib/research";
import type { ShelfRequest, Signal } from "@/lib/types";

/** One county's monthly totals over its reporting sites (county grain only). */
export interface CountyMonth {
  month: string;
  households: number;
  individuals: number;
  pounds: number;
  children: number;
  adults: number;
  seniors: number;
}

const SIGNAL_KEY: Record<Signal, keyof Pick<CountyMonth, "households" | "pounds" | "individuals">> = {
  HouseholdsTotal: "households",
  PoundsTotal: "pounds",
  IndividualsTotal: "individuals",
};
const SIGNAL_COLOR: Record<Signal, string> = {
  HouseholdsTotal: "var(--sig-households)",
  PoundsTotal: "var(--sig-pounds)",
  IndividualsTotal: "var(--sig-individuals)",
};

const change = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? a / b - 1 : null);

function Delta({ v, digits = 0 }: { v: number | null; digits?: number }) {
  if (v == null) return <span className="text-muted">—</span>;
  return <span className={v >= 0 ? "text-ink" : "text-[var(--critical-text)]"}>{fmt.signedPct(v, digits)}</span>;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted">{label}</div>
      <div className="tabular mt-1 text-[19px] font-semibold leading-none text-ink">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

/** Below-the-map panel for the county selected on the distribution heatmap. */
export function CountyDetail({
  fips,
  months,
  types,
  asOf,
  alerts,
  requests,
  info,
  onClose,
}: {
  fips: string;
  months: CountyMonth[];
  types: SiteTypeMix | null;
  asOf: string;
  alerts: Alert[];
  requests: ShelfRequest[];
  info?: Info;
  onClose: () => void;
}) {
  const [signal, setSignal] = useState<Signal>("HouseholdsTotal");
  const c = countiesByFips[fips];
  const byMonth = useMemo(() => new Map(months.map((m) => [m.month, m])), [months]);
  const now = byMonth.get(asOf);
  const before = byMonth.get(addMonths(asOf, -12));
  const key = SIGNAL_KEY[signal];

  const trend = useMemo(() => {
    const out: { month: string; value: number | null }[] = [];
    for (let i = 23; i >= 0; i--) {
      const m = addMonths(asOf, -i);
      out.push({ month: m, value: byMonth.get(m)?.[key] ?? null });
    }
    return out;
  }, [byMonth, asOf, key]);
  const yoy = useMemo(
    () =>
      trend.slice(-12).map((p) => ({ month: p.month, value: change(p.value, byMonth.get(addMonths(p.month, -12))?.[key]) })),
    [trend, byMonth, key],
  );
  // The research forecast targets one month; draw it only when it follows the shown month.
  const target = research.meta.forecast_target;
  const fc = addMonths(asOf, 1) === target ? c?.forecast?.[signal] : undefined;
  const band =
    fc && fc.yhat != null && fc.lo80 != null && fc.hi80 != null && fc.lo95 != null && fc.hi95 != null
      ? { month: target, yhat: fc.yhat, lo80: fc.lo80, hi80: fc.hi80, lo95: fc.lo95, hi95: fc.hi95 }
      : null;

  const cells = (types?.counties[fips] ?? {}) as Partial<Record<SiteType, SiteTypeCell>>;
  const prior = (types?.prior.counties[fips] ?? {}) as Partial<Record<SiteType, SiteTypeCell>>;
  const typeRows = SITE_TYPES.filter((t) => cells[t] || prior[t]);
  const sitesNow = typeRows.reduce((s, t) => s + (cells[t]?.sites ?? 0), 0);
  const sitesBefore = typeRows.reduce((s, t) => s + (prior[t]?.sites ?? 0), 0);
  const ppv = (r?: CountyMonth) => (r && r.households ? r.pounds / r.households : null);

  if (!c) return null;
  const fei = equityValue(c);
  return (
    <Card
      title={`${c.name} County`}
      icon="pin"
      info={info}
      subtitle={`${c.nonmetro ? "Nonmetro" : "Metro"} (USDA RUCC) · ${fmt.int(c.population)} residents · ${monthLabel(asOf, "long")} and the 24 months before`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/manager/map?county=${fips}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
            Map explorer <Icon name="arrow" className="h-3.5 w-3.5" />
          </Link>
          <button type="button" onClick={onClose} aria-label="Close county detail" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Visits" value={fmt.int(now?.households)} sub={<><Delta v={change(now?.households, before?.households)} /> vs a year earlier</>} />
        <Kpi label="Pounds distributed" value={fmt.compact(now?.pounds)} sub={<><Delta v={change(now?.pounds, before?.pounds)} /> vs a year earlier</>} />
        <Kpi label="Individuals served" value={fmt.int(now?.individuals)} sub={<><Delta v={change(now?.individuals, before?.individuals)} /> vs a year earlier</>} />
        <Kpi label="Pounds per visit" value={fmt.num(ppv(now), 1)} sub={<><Delta v={change(ppv(now), ppv(before))} /> vs a year earlier</>} />
        <Kpi label="Reporting sites" value={fmt.int(sitesNow || null)} sub={sitesBefore ? `${fmt.int(sitesBefore)} a year earlier` : undefined} />
        <Kpi
          label={`Visits · ${monthLabel(target)} forecast`}
          value={fmt.int(c.forecast?.HouseholdsTotal?.yhat)}
          sub={c.forecast?.HouseholdsTotal?.lo80 != null ? `80%: ${fmt.int(c.forecast.HouseholdsTotal.lo80)}–${fmt.int(c.forecast.HouseholdsTotal.hi80)}` : undefined}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
          {SIGNAL_LABEL[signal]} ({SIGNAL_FIELD[signal]})
        </span>
        <Segmented<Signal> size="sm" label="County signal" value={signal} onChange={setSignal} options={SIGNALS.map((s) => ({ value: s, label: SIGNAL_LABEL[s] }))} />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-1 text-[12px] text-muted">By month, last 24 months{band ? `, with the ${monthLabel(band.month)} forecast` : ""}</div>
          <TimeChart points={trend} color={SIGNAL_COLOR[signal]} label={SIGNAL_LABEL[signal]} forecast={band} height={200} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[12px] text-muted">Change on the same month a year earlier</div>
          <ChangeBars points={yoy} label={SIGNAL_LABEL[signal]} height={200} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            Sites by type · {types?.month ? monthLabel(types.month) : "—"} vs {types?.prior.month ? monthLabel(types.prior.month) : "a year earlier"}
          </div>
          {typeRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted">
                    <th className="pb-1.5 font-semibold">Type</th>
                    <th className="pb-1.5 text-right font-semibold">Sites</th>
                    <th className="pb-1.5 text-right font-semibold">Year earlier</th>
                    <th className="pb-1.5 text-right font-semibold">Visits</th>
                    <th className="pb-1.5 text-right font-semibold">YoY</th>
                    <th className="pb-1.5 text-right font-semibold">Pounds</th>
                    <th className="pb-1.5 text-right font-semibold">YoY</th>
                    <th className="pb-1.5 text-right font-semibold">Lb / visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {typeRows.map((t) => {
                    const a = cells[t];
                    const b = prior[t];
                    return (
                      <tr key={t}>
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-1.5 text-ink">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                            {TYPE_SHORT[t]}
                          </span>
                        </td>
                        <td className="tabular py-1.5 text-right font-semibold text-ink">{fmt.int(a?.sites ?? 0)}</td>
                        <td className="tabular py-1.5 text-right text-ink-2">{fmt.int(b?.sites ?? 0)}</td>
                        <td className="tabular py-1.5 text-right text-ink-2">{fmt.int(a?.households)}</td>
                        <td className="tabular py-1.5 text-right">
                          <Delta v={change(a?.households, b?.households)} />
                        </td>
                        <td className="tabular py-1.5 text-right text-ink-2">{fmt.compact(a?.pounds)}</td>
                        <td className="tabular py-1.5 text-right">
                          <Delta v={change(a?.pounds, b?.pounds)} />
                        </td>
                        <td className="tabular py-1.5 text-right text-ink-2">{fmt.num(a?.pounds != null && a.households ? a.pounds / a.households : null, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-muted">No reporting sites by type for this county.</p>
          )}
          {now && now.individuals > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Who was served · {monthLabel(asOf)}</div>
              <StackedBar
                format={(v) => fmt.pct(v / now.individuals, 0)}
                parts={[
                  { key: "c", label: "Children", value: now.children, color: "var(--sig-households)" },
                  { key: "a", label: "Adults", value: now.adults, color: "var(--sig-individuals)" },
                  { key: "s", label: "Seniors", value: now.seniors, color: "var(--sig-pounds)" },
                ]}
              />
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            {(
              [
                [EQUITY_SHORT, fmt.num(fei, 0), "0–100, higher = more barriers"],
                ["Q6 need percentile", fmt.num(c.need_percentile, 0), c.robust ? "Audit-first county" : undefined],
                ["Poverty rate", fmt.pct(c.poverty_rate, 1), "ACS 5-year"],
                ["Below 200% poverty", fmt.pct(c.below_200_share, 0), "ACS 5-year"],
                ["Miles to nearest shelf", fmt.num(c.mean_miles, 1), "Resident average, straight line"],
                ["Beyond 10 miles", fmt.pct(c.share_beyond_10, 0), "Share of residents"],
                ["No vehicle", fmt.pct(c.no_vehicle_share, 1), "ACS 5-year"],
                ["LILA tracts without a site", `${fmt.int(c.lila_without_site)} of ${fmt.int(c.lila_tracts)}`, "USDA 2019 LILA"],
              ] as [string, string, string | undefined][]
            ).map(([k, v, note]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-[0.05em] text-muted">{k}</dt>
                <dd className="tabular font-semibold text-ink">{v}</dd>
                {note && <dd className="text-[11px] text-muted">{note}</dd>}
              </div>
            ))}
          </dl>
          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Open alerts</div>
            {alerts.length ? (
              <ul className="space-y-1.5">
                {alerts.slice(0, 3).map((a) => (
                  <li key={a.key} className="flex items-start gap-2 text-[12.5px]">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-ink-2">{a.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted">None open.</p>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">Shelf requests</div>
            {requests.length ? (
              <ul className="space-y-1.5">
                {requests.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    <Badge>{r.kind}</Badge>
                    <Badge tone={r.status === "fulfilled" ? "green" : r.urgency === "high" ? "critical" : "neutral"}>{r.status.replace("_", " ")}</Badge>
                    {r.hypothetical && <Badge>hypothetical</Badge>}
                    {r.pounds_requested != null && <span className="text-muted">{fmt.int(r.pounds_requested)} lb</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted">None.</p>
            )}
          </div>
        </div>
      </div>
      <SourceNote>
        County totals over reporting sites (food_shelf_broad): outputs/tables/county_network_month.csv, county_site_types.csv; forecast
        outputs/forecasts (D-045); context from ACS, USDA RUCC/LILA and the FEI build. Activity is published per county and per Organization.AgencyType only; the map
        shows each site's location and type, never its own visits or pounds (D-063).
      </SourceNote>
    </Card>
  );
}
