"use client";

import { useState } from "react";
import type { SnapshotT } from "@/lib/agent/tools";
import { addMonths, monthLabel } from "@/lib/calendar";
import { downloadText, fmt } from "@/lib/format";
import { countiesByFips } from "@/lib/research";
import { useData } from "./DataProvider";
import { Markdown } from "./Markdown";
import { Badge, Button, Card } from "./ui";

export function useSnapshot(shelfId?: string | null): SnapshotT {
  const { session, data, alerts, outlooks, asOf, alertState } = useData();
  const reports = data.reports.filter((r) => r.month === asOf);
  const next = outlooks.reduce(
    (a, o) => ({ y: a.y + (o.households?.yhat ?? 0), lo: a.lo + (o.households?.lo80 ?? 0), hi: a.hi + (o.households?.hi80 ?? 0) }),
    { y: 0, lo: 0, hi: 0 },
  );
  const shelfName = (id?: string) => data.shelves.find((s) => s.id === id)?.name;
  const relevant = shelfId ? alerts.filter((a) => a.shelfId === shelfId || a.scope === "network") : alerts;
  const o = shelfId ? outlooks.find((x) => x.shelf.id === shelfId) : undefined;
  return {
    workspace: session.mode,
    asOf,
    network: {
      shelves: data.shelves.filter((s) => s.active).length,
      reporting: new Set(reports.map((r) => r.shelf_id)).size,
      visits: reports.reduce((s, r) => s + r.households, 0),
      pounds: reports.reduce((s, r) => s + r.pounds_distributed, 0),
      individuals: reports.reduce((s, r) => s + r.individuals, 0),
      forecastVisits: Math.round(next.y),
      forecastVisitsLo80: Math.round(next.lo),
      forecastVisitsHi80: Math.round(next.hi),
      openRequests: data.requests.filter((r) => r.status === "open").length,
    },
    alerts: relevant.slice(0, 80).map((a) => ({
      severity: a.severity,
      scope: a.scope,
      category: a.category,
      title: a.title.slice(0, 300),
      detail: a.detail.slice(0, 1200),
      action: a.action.slice(0, 600),
      where: (a.shelfId ? shelfName(a.shelfId) : a.fips ? `${countiesByFips[a.fips]?.name} County` : "Network")?.slice(0, 160),
      status: alertState(a.key)?.status ?? "open",
      source: a.source.slice(0, 400),
    })),
    shelf: o
      ? {
          name: o.shelf.name,
          county: countiesByFips[o.shelf.county_fips]?.name ?? o.shelf.county_fips,
          type: o.shelf.type,
          lastMonth: o.latest?.month ?? null,
          lastVisits: o.latest?.households ?? null,
          lastPounds: o.latest?.pounds_distributed ?? null,
          inventory: o.latest?.inventory_lbs ?? null,
          forecastMonth: addMonths(asOf, 1),
          forecastVisits: o.households ? Math.round(o.households.yhat) : null,
          forecastVisitsBand: o.households ? `${Math.round(o.households.lo80)}–${Math.round(o.households.hi80)}` : null,
          forecastPounds: o.pounds ? Math.round(o.pounds.yhat) : null,
          forecastPoundsBand: o.pounds ? `${Math.round(o.pounds.lo80)}–${Math.round(o.pounds.hi80)}` : null,
          capacity: o.shelf.capacity_households,
        }
      : undefined,
  };
}

interface AgentResult {
  mode: "ai" | "offline";
  model?: string;
  markdown: string;
  toolCalls: { name: string; input: unknown }[];
  note?: string;
  error?: string;
}

export function AgentPanel({
  mode,
  county,
  question,
  shelfId,
  label = "Generate briefing",
}: {
  mode: "briefing" | "county" | "shelf" | "ask";
  county?: string;
  question?: string;
  shelfId?: string | null;
  label?: string;
}) {
  const snapshot = useSnapshot(shelfId);
  const { asOf } = useData();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, county, question, snapshot }),
      });
      const body = (await res.json()) as AgentResult;
      setResult(res.ok ? body : { mode: "offline", markdown: "", toolCalls: [], error: body.error ?? res.statusText });
    } catch (e) {
      setResult({ mode: "offline", markdown: "", toolCalls: [], error: String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={busy || (mode === "ask" && !question?.trim())}>
          {busy ? "Working… (this can take up to a minute)" : label}
        </Button>
        {result?.markdown && (
          <Button variant="secondary" onClick={() => downloadText(`foodbridge-briefing-${asOf}.md`, result.markdown, "text/markdown")}>
            Download .md
          </Button>
        )}
      </div>
      {result?.error && <p className="text-[13px] text-[var(--critical-text)]">{result.error}</p>}
      {result?.markdown && (
        <Card
          title={result.mode === "ai" ? "Briefing" : "Offline briefing"}
          subtitle={`${monthLabel(asOf, "long")} · ${snapshot.workspace === "demo" ? "demo workspace (synthetic shelves)" : "live workspace"}`}
          actions={result.mode === "ai" ? <Badge tone="green">{result.model}</Badge> : <Badge>No model</Badge>}
        >
          {result.note && <p className="mb-2 text-[12.5px] text-muted">{result.note}</p>}
          <Markdown source={result.markdown} />
          {result.toolCalls.length > 0 && (
            <details className="mt-4 rounded-lg border border-line p-3 text-[12.5px]">
              <summary className="cursor-pointer font-medium text-ink">
                What the agent looked up ({fmt.int(result.toolCalls.length)} tool calls)
              </summary>
              <ul className="mt-2 space-y-1 text-ink-2">
                {result.toolCalls.map((t, i) => (
                  <li key={i}>
                    <code>{t.name}</code> {JSON.stringify(t.input)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
