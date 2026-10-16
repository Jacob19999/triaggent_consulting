"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertList } from "@/components/AlertList";
import { TimeChart } from "@/components/charts";
import { useData } from "@/components/DataProvider";
import { CountyMapCard } from "@/components/map/CountyMapCard";
import { useTractRows } from "@/components/map/useMapData";
import { Badge, buttonClass, Card, Icon, PageHeader, SeverityBadge, SourceNote, Stat } from "@/components/ui";
import { policyWatch, SEVERITY_ORDER, type Severity } from "@/lib/alerts";
import { addMonths, monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { prioritize } from "@/lib/priority";
import {
  countiesByFips,
  EQUITY_LABEL,
  EQUITY_SHORT,
  equityValue,
  feiReady,
  research,
  SIGNAL_FIELD,
  SIGNAL_LABEL,
  SIGNALS,
} from "@/lib/research";
import type { Signal } from "@/lib/types";

const SIGNAL_COLOR: Record<Signal, string> = {
  HouseholdsTotal: "var(--sig-households)",
  PoundsTotal: "var(--sig-pounds)",
  IndividualsTotal: "var(--sig-individuals)",
};

export default function ManagerDashboard() {
  const { ready, data, alerts, outlooks, asOf, session, error, alertState } = useData();
  const [signal, setSignal] = useState<Signal>("HouseholdsTotal");

  const active = data.shelves.filter((s) => s.active);
  const reported = active.filter((s) => data.reports.some((r) => r.shelf_id === s.id && r.month === asOf));
  const lastMonth = data.reports.filter((r) => r.month === asOf);
  const sum = (k: "households" | "pounds_distributed" | "individuals") => lastMonth.reduce((s, r) => s + r[k], 0);
  const next = outlooks.reduce(
    (acc, o) => ({
      yhat: acc.yhat + (o.households?.yhat ?? 0),
      lo: acc.lo + (o.households?.lo80 ?? 0),
      hi: acc.hi + (o.households?.hi80 ?? 0),
    }),
    { yhat: 0, lo: 0, hi: 0 },
  );
  const openAlerts = alerts.filter((a) => (alertState(a.key)?.status ?? "open") !== "resolved");
  const bySeverity = (s: Severity) => openAlerts.filter((a) => a.severity === s).length;
  const shelfAlerts = openAlerts.filter((a) => a.scope === "shelf");
  const priorities = useMemo(() => prioritize(outlooks).slice(0, 6), [outlooks]);

  const tracts = useTractRows();
  const equity = useMemo(
    () =>
      tracts.rows
        ? Object.fromEntries(tracts.rows.map((t) => [t.geoid, t.fei ?? null]))
        : Object.fromEntries(research.counties.map((c) => [c.fips, equityValue(c)])),
    [tracts.rows],
  );
  const robust = useMemo(() => new Set(research.counties.filter((c) => c.robust).map((c) => c.fips)), []);
  const watch = policyWatch(asOf).slice(0, 4);
  const openRequests = data.requests.filter((r) => r.status === "open" || r.status === "in_progress");

  const history = research.history.map((h) => ({ month: h.month, value: h[signal] }));
  const stateFc = research.findings.stats.q7_state.find((r) => r.signal === signal);

  return (
    <>
      <PageHeader
        eyebrow="Manager workspace"
        title="Command center"
        description={`Where the network stands for ${monthLabel(asOf, "long")}, what the forecast says about ${monthLabel(addMonths(asOf, 1), "long")}, and which shelves and counties need attention first.`}
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="store"
          label="Shelves reporting"
          value={ready ? `${reported.length} / ${active.length}` : "…"}
          sub={`${monthLabel(asOf)} reports received`}
        />
        <Stat
          icon="users"
          accent="var(--sig-households)"
          label={`Visits · ${monthLabel(asOf)}`}
          value={fmt.int(sum("households"))}
          sub={`${fmt.int(sum("pounds_distributed"))} lb · ${fmt.int(sum("individuals"))} individuals`}
        />
        <Stat
          icon="history"
          accent="var(--seq-3)"
          label="Next month visits"
          tone="forecast"
          value={fmt.int(next.yhat)}
          sub={`Sum of shelf forecasts · 80% bounds ${fmt.int(next.lo)}–${fmt.int(next.hi)}`}
        />
        <Stat
          icon="bell"
          accent="var(--critical)"
          label="Open alerts"
          value={openAlerts.filter((a) => a.severity !== "info").length}
          sub={
            <span className="flex flex-wrap gap-x-2">
              <span>{bySeverity("critical")} critical</span>
              <span>{bySeverity("serious")} serious</span>
              <span>{bySeverity("warning")} warning</span>
            </span>
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        <CountyMapCard
          title={`${EQUITY_LABEL}${tracts.rows ? " by census tract" : ""}`}
          subtitle={
            feiReady
              ? "Higher = more barriers between residents who need food and the food-shelf network. Click an area for its county evidence."
              : "FEI is being built (task A4). This placeholder is the Q6 need percentile."
          }
          values={equity}
          legendTitle={tracts.rows ? `${EQUITY_SHORT} · tracts` : EQUITY_SHORT}
          highlight={robust}
          geometry={tracts.geometry ?? undefined}
          unitName={tracts.rows ? (id) => `${tracts.byId.get(id)?.name ?? id} · ${countiesByFips[id.slice(0, 5)]?.name} County` : undefined}
          height={640}
          href={(id) => `/manager/map?county=${id.slice(0, 5)}`}
          actions={
            <Link href="/manager/map" className="text-[12.5px] font-medium text-accent hover:underline">
              Open map explorer
            </Link>
          }
          note="Dashed outline: Q6 audit-first counties (a call list for local checks, D-052)."
          extra={(id) => {
            const c = countiesByFips[id.slice(0, 5)];
            return (
              <div className="mt-1 text-[11.5px] text-muted">
                {c.sites_2024} reporting shelves (2024) · {fmt.num(c.mean_miles, 1)} mi avg to nearest reporting shelf
              </div>
            );
          }}
        />

        <div className="space-y-4">
          <Card
            title="Priority shelves"
            subtitle="Transparent score from equity, stock risk, demand growth, capacity and reporting. Manager overrides sort first."
            actions={
              <Link href="/manager/shelves" className="text-[13px] font-medium text-accent underline">
                All shelves
              </Link>
            }
          >
            {priorities.length ? (
              <ul className="divide-y divide-line">
                {priorities.map((p) => {
                  const worst = shelfAlerts
                    .filter((a) => a.shelfId === p.outlook.shelf.id)
                    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
                  return (
                    <li key={p.outlook.shelf.id} className="flex items-center gap-3 py-2">
                      <span className="tabular grid h-9 w-11 place-items-center rounded-lg bg-surface-2 text-[14px] font-semibold text-ink">
                        {fmt.num(p.score, 0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-ink">{p.outlook.shelf.name}</div>
                        <div className="truncate text-[12px] text-muted">
                          {countiesByFips[p.outlook.shelf.county_fips]?.name} County ·{" "}
                          {worst ? worst.title : "No open shelf alerts"}
                        </div>
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

          <Card
            title="Alerts from the forecast"
            actions={
              <Link href="/manager/alerts" className="text-[13px] font-medium text-accent underline">
                Alert center
              </Link>
            }
          >
            <AlertList alerts={openAlerts.filter((a) => a.scope === "shelf")} limit={4} compact />
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card
          title="Statewide activity (research snapshot)"
          subtitle={`${SIGNAL_LABEL[signal]} (${SIGNAL_FIELD[signal]}), statewide broad reporting network, with the August 2026 internal forecast.`}
          actions={
            <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Signal">
              {SIGNALS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSignal(s)}
                  aria-pressed={signal === s}
                  className={`rounded-md px-2 py-1 text-[12px] font-medium ${signal === s ? "bg-surface-2 text-ink" : "text-muted"}`}
                >
                  {SIGNAL_LABEL[s]}
                </button>
              ))}
            </div>
          }
        >
          <TimeChart
            points={history}
            color={SIGNAL_COLOR[signal]}
            label={SIGNAL_LABEL[signal]}
            forecast={
              stateFc
                ? {
                    month: research.meta.forecast_target,
                    yhat: stateFc.yhat,
                    lo80: stateFc.yhat,
                    hi80: stateFc.yhat,
                    lo95: stateFc.yhat,
                    hi95: stateFc.yhat,
                  }
                : null
            }
          />
          <SourceNote>
            outputs/tables/q4_state_month.csv (observed through {monthLabel(research.meta.observed_end)}) ·
            outputs/forecasts/q7_august2026_state.csv (sum of {stateFc?.counties ?? 86} county forecasts; county bands
            are not additive, so none is drawn).
          </SourceNote>
        </Card>

        <div className="space-y-4">
          <Card
            title="Policy watch"
            subtitle="Dated events from primary sources, six months back and three ahead."
            actions={
              <Link href="/manager/briefing" className="text-[13px] font-medium text-accent underline">
                Brief me
              </Link>
            }
          >
            {watch.length ? (
              <ul className="space-y-2.5">
                {watch.map((e) => (
                  <li key={e.id} className="text-[13px]">
                    <div className="flex items-center gap-2">
                      <Badge>{e.start}</Badge>
                      <span className="text-[12px] text-muted">{e.program}</span>
                    </div>
                    <a href={e.url} target="_blank" rel="noreferrer noopener" className="mt-0.5 block font-medium text-ink hover:underline">
                      {e.name}
                    </a>
                    <p className="text-[12px] text-muted">{e.direction}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No dated events in the window. Open the briefing for the full timeline.</p>
            )}
          </Card>
          <Card
            title="Shelf requests"
            actions={
              <Link href="/manager/requests" className="text-[13px] font-medium text-accent underline">
                Inbox
              </Link>
            }
          >
            {openRequests.length ? (
              <ul className="space-y-2">
                {openRequests.slice(0, 3).map((r) => (
                  <li key={r.id} className="text-[13px]">
                    <span className="font-medium text-ink">{data.shelves.find((s) => s.id === r.shelf_id)?.name}</span>
                    <span className="text-muted"> · {r.kind} · {r.urgency}</span>
                    <p className="line-clamp-2 text-ink-2">{r.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No open requests.</p>
            )}
          </Card>
        </div>
      </div>
      {session.mode === "demo" && (
        <SourceNote>
          Demo workspace: shelf figures are synthetic and scaled from county aggregates. Research figures are the team&apos;s
          analysis outputs.
        </SourceNote>
      )}
    </>
  );
}
