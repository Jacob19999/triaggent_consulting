"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertList } from "@/components/AlertList";
import { TimeChart } from "@/components/charts";
import { useData } from "@/components/DataProvider";
import { useMyShelf } from "@/components/useMyShelf";
import { Badge, Card, Empty, Icon, Meter, PageHeader, SourceNote, Stat } from "@/components/ui";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { countiesByFips, equityValue, EQUITY_SHORT, feiReady } from "@/lib/research";

type Key = "households" | "pounds_distributed" | "individuals";
const SERIES: { key: Key; label: string; color: string; field: string }[] = [
  { key: "households", label: "Visits", color: "var(--sig-households)", field: "HouseholdsReg" },
  { key: "pounds_distributed", label: "Pounds distributed", color: "var(--sig-pounds)", field: "PoundsReg" },
  { key: "individuals", label: "Individuals served", color: "var(--sig-individuals)", field: "IndividualsReg" },
];

export default function ShelfHome() {
  const { ready, alerts, asOf, session } = useData();
  const { shelf, outlook } = useMyShelf();
  const [series, setSeries] = useState<Key>("households");
  if (!ready) return <p className="text-[13px] text-muted">Loading…</p>;
  if (!shelf || !outlook)
    return (
      <Empty title={session.mode === "live" ? "Your account is not linked to a shelf yet." : "No shelf selected."}>
        {session.mode === "live" ? "Ask your network manager to grant access to your shelf." : "Pick a county network in the top bar."}
      </Empty>
    );
  const county = countiesByFips[shelf.county_fips];
  const mine = alerts.filter((a) => a.shelfId === shelf.id);
  const policy = alerts.filter((a) => a.scope === "network" && a.severity === "warning");
  const latest = outlook.latest;
  const missing = outlook.overdue;
  const s = SERIES.find((x) => x.key === series)!;
  const fc = series === "households" ? outlook.households : series === "pounds_distributed" ? outlook.pounds : outlook.individuals;
  // County-network mode shows county totals kept in this browser, not one shelf's own reports.
  const network = shelf.is_demo;

  return (
    <>
      <PageHeader
        eyebrow={`${county?.name} County · ${shelf.is_demo ? (latest?.notes?.split(".")[0] ?? "all reporting sites") : shelf.type.replaceAll("_", " ")}`}
        title={shelf.name}
        description={shelf.hours ? `Hours: ${shelf.hours}` : undefined}
        actions={
          <>
            {shelf.is_demo && <Badge tone="demo">County network · statewide extract</Badge>}
            <Link href="/shelf/report" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent bg-accent px-3.5 text-[13.5px] font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]">
              <Icon name="form" /> {missing ? `Submit ${monthLabel(asOf)} report` : "Update a report"}
            </Link>
          </>
        }
      />
      {missing && (
        <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] p-4 text-[14px]">
          <Icon name="warning" className="mt-0.5 h-5 w-5 text-[var(--warning-text)]" />
          <div>
            <p className="font-semibold text-ink">Your {monthLabel(asOf, "long")} report is due.</p>
            <p className="text-ink-2">Forecasts and alerts below use your last report ({latest ? monthLabel(latest.month) : "none"}).</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={latest ? `Visits · ${monthLabel(latest.month)}` : "Visits"}
          value={fmt.int(latest?.households)}
          sub={`${fmt.int(latest?.individuals)} individuals · ${fmt.int(latest?.pounds_distributed)} lb`}
        />
        <Stat
          label={`Visits · ${monthLabel(outlook.target)}`}
          tone="forecast"
          value={fmt.int(outlook.households?.yhat)}
          sub={outlook.households ? `80% band ${fmt.int(outlook.households.lo80)}–${fmt.int(outlook.households.hi80)} · ${fmt.signedPct(outlook.growth)} vs 6-mo avg` : "Needs 1–3 months of reports"}
        />
        <Stat
          label={`Pounds needed · ${monthLabel(outlook.target)}`}
          tone="forecast"
          value={fmt.int(outlook.pounds?.yhat)}
          sub={outlook.pounds ? `80% band ${fmt.int(outlook.pounds.lo80)}–${fmt.int(outlook.pounds.hi80)} lb` : "—"}
        />
        {outlook.coverage == null ? (
          <Stat
            label="Food on hand"
            value="Unknown"
            accent="var(--muted)"
            sub={network ? "Not in the statewide extract, so stock cover cannot be checked." : "Add food on hand to your monthly report to check stock cover."}
          />
        ) : (
          <Stat
            label="Food on hand"
            value={outlook.daysOfSupply == null ? "—" : `${fmt.num(outlook.daysOfSupply, 0)} days`}
            sub={`${fmt.int(latest?.inventory_lbs)} lb · covers ${fmt.pct(outlook.coverage)} of next month with typical deliveries`}
          >
            <div className="mt-2">
              <Meter value={Math.min(1, outlook.coverage)} color={outlook.coverage < 1 ? "var(--critical)" : "var(--good)"} label="Coverage" />
            </div>
          </Stat>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card
          title={network ? "Network trend and next month's forecast" : "Your trend and next month's forecast"}
          subtitle={`Forecast: the last three months per working day, weighted 1:2:3 toward the latest (the team's county method, D-045). ${fc?.band === "backtest" ? `Band from ${fc.backtests} past months.` : "Default ±20% / ±35% band until there is more history."}`}
          actions={
            <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Series">
              {SERIES.map((x) => (
                <button
                  key={x.key}
                  onClick={() => setSeries(x.key)}
                  aria-pressed={series === x.key}
                  className={`rounded-md px-2 py-1 text-[12px] font-medium ${series === x.key ? "bg-surface-2 text-ink" : "text-muted"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          }
        >
          <TimeChart
            points={outlook.reports.map((r) => ({ month: r.month, value: r[series] }))}
            forecast={fc ? { month: fc.month, yhat: fc.yhat, lo80: fc.lo80, hi80: fc.hi80, lo95: fc.lo95, hi95: fc.hi95 } : null}
            color={s.color}
            label={s.label}
          />
          <SourceNote>
            {s.field} {network ? "summed over the county's reporting sites" : "from your monthly reports"}. The open circle is the forecast; dark band 80%, light band 95%. It is a
            planning range, not a promise.
          </SourceNote>
        </Card>
        <div className="space-y-4">
          <Card title={network ? "Alerts for this network" : "Alerts for your shelf"} subtitle="From the monthly reports and next month's forecast.">
            <AlertList
              alerts={mine}
              showWhere={false}
              emptyText={
                outlook.coverage == null
                  ? "No alerts, but stock cover is unchecked: no food-on-hand figure has been reported."
                  : "No alerts. Food on hand and typical deliveries cover next month's forecast."
              }
            />
          </Card>
          <Card title={`${county?.name} County context`}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-muted">{feiReady ? "Access equity (FEI)" : EQUITY_SHORT}</dt>
              <dd className="tabular text-right font-semibold text-ink">
                {fmt.num(county ? equityValue(county) : null, feiReady ? 1 : 0)}
                {feiReady && county?.fei?.quintile ? ` · quintile ${county.fei.quintile}` : ""}
              </dd>
              <dt className="text-muted">Miles to nearest reporting shelf</dt>
              <dd className="tabular text-right text-ink">{fmt.num(county?.mean_miles, 1)}</dd>
              <dt className="text-muted">Residents beyond 10 miles</dt>
              <dd className="tabular text-right text-ink">{fmt.pct(county?.share_beyond_10)}</dd>
              <dt className="text-muted">County visits, Aug 2026 forecast</dt>
              <dd className="tabular text-right text-ink">{fmt.int(county?.forecast.HouseholdsTotal?.yhat)}</dd>
            </dl>
            {policy.length > 0 && (
              <>
                <p className="mt-3 text-[12.5px] font-medium text-ink-2">Policy watch</p>
                <ul className="mt-1 space-y-1 text-[12.5px]">
                  {policy.slice(0, 3).map((p) => (
                    <li key={p.key}>
                      {p.url ? (
                        <a className="text-accent underline" href={p.url} target="_blank" rel="noreferrer noopener">
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-3">
              <Link className="text-[13px] font-medium text-accent underline" href="/shelf/assistant">
                Ask the assistant what this means for you
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
