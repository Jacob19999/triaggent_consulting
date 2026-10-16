"use client";

import { useEffect, useMemo, useState } from "react";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { rateTimeline, type Impact, type Pressure, type WebPolicyItem, type WebPolicyScan } from "@/lib/policyWatch";
import { research } from "@/lib/research";
import { useData } from "./DataProvider";
import { Badge, Button, Icon, SourceNote } from "./ui";

const IMPACT_TONE: Record<Impact, "critical" | "demo" | "neutral"> = { high: "critical", medium: "demo", low: "neutral" };
const PRESSURE: Record<Pressure, { arrow: string; label: string }> = {
  up: { arrow: "▲", label: "More pressure" },
  down: { arrow: "▼", label: "Less pressure" },
  mixed: { arrow: "◆", label: "Mixed" },
  unclear: { arrow: "•", label: "Unclear" },
};
const CACHE = "foodbridge.policyscan.v1";

function ImpactBadge({ impact }: { impact: Impact }) {
  return <Badge tone={IMPACT_TONE[impact]}>{impact} impact</Badge>;
}

function PressureTag({ p }: { p: Pressure }) {
  return (
    <span className="text-[11.5px] font-medium text-ink-2" title="Expected pressure on food-shelf demand">
      {PRESSURE[p].arrow} {PRESSURE[p].label}
    </span>
  );
}

function Signals({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <code key={f} className="rounded bg-surface-2 px-1 py-px text-[10.5px] text-ink-2">
          {f}
        </code>
      ))}
    </span>
  );
}

function WebItem({ item }: { item: WebPolicyItem }) {
  const tracked = item.tracked_id ? research.policy.find((e) => e.id === item.tracked_id) : null;
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ImpactBadge impact={item.impact} />
        <PressureTag p={item.demand_pressure} />
        {item.supply_effect !== "none" && item.supply_effect !== "unclear" && (
          <span className="text-[11.5px] text-muted">Food supply {item.supply_effect}</span>
        )}
        <span className="ml-auto text-[11.5px] text-muted">
          {item.program} · {item.level} · {item.status.replace("_", " ")}
          {item.effective ? ` · effective ${item.effective}` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-[13.5px] font-semibold text-ink">{item.title}</p>
      {tracked && <p className="text-[11.5px] text-muted">Update to tracked event: {tracked.name}</p>}
      <p className="mt-1 text-[12.5px] text-ink-2">{item.what_changes}</p>
      {item.who_in_mn && (
        <p className="mt-1 text-[12.5px] text-ink-2">
          <span className="font-medium text-ink">Who in Minnesota:</span> {item.who_in_mn}
          {item.where ? ` (${item.where})` : ""}
        </p>
      )}
      {item.impact_reason && <p className="mt-1 text-[12px] text-muted">{item.impact_reason}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
        <span>Watch</span>
        <Signals fields={item.signals} />
        {item.watch_window && <span>· {item.watch_window}</span>}
      </div>
      {item.action && (
        <p className="mt-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink">
          <span className="font-semibold">This week:</span> {item.action}
        </p>
      )}
      {item.sources.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11.5px]">
          {item.sources.map((s) => (
            <li key={s.url} className="truncate">
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                {s.title || s.url}
              </a>
              <span className="text-muted">
                {" "}
                · {s.publisher || new URL(s.url).hostname} · {s.kind}
                {s.date ? ` · ${s.date}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[10.5px] text-muted">Model confidence: {item.confidence}</p>
    </li>
  );
}

/** Policy watch ranked by impact on the network. The tracked timeline is rated by rule;
 * "Scan the web" asks Gemini with Google Search for newer changes and their impact. */
export function PolicyWatch({ limit = 4 }: { limit?: number }) {
  const { asOf, session } = useData();
  const rated = useMemo(() => rateTimeline(research.policy, asOf).filter((r) => r.timing !== "earlier" || r.impact !== "low"), [asOf]);
  const [showAll, setShowAll] = useState(false);
  const [scan, setScan] = useState<WebPolicyScan | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${CACHE}.${asOf}`) ?? "null") as WebPolicyScan | null;
      if (saved?.mode === "ai") setScan(saved);
    } catch {
      // No saved scan.
    }
  }, [asOf]);

  const run = async (refresh: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/policy-watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspace: session.mode, asOf, refresh }),
      });
      const body = (await res.json()) as WebPolicyScan & { error?: string };
      const next: WebPolicyScan = res.ok ? body : { mode: "offline", fetchedAt: new Date().toISOString(), items: [], searched: [], queries: [], error: body.error ?? res.statusText };
      setScan(next);
      if (next.mode === "ai") window.localStorage.setItem(`${CACHE}.${asOf}`, JSON.stringify(next));
    } catch (e) {
      setScan({ mode: "offline", fetchedAt: new Date().toISOString(), items: [], searched: [], queries: [], error: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const tracked = showAll ? rated : rated.slice(0, limit);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => run(!!scan && scan.mode === "ai")} disabled={busy}>
          <Icon name="search" className="h-3.5 w-3.5" />
          {busy ? "Searching the web… (up to a minute)" : scan?.mode === "ai" ? "Rescan the web" : "Scan the web for new policy"}
        </Button>
        {scan?.mode === "ai" && (
          <span className="text-[11.5px] text-muted">
            Last scan {fmt.date(scan.fetchedAt)} · {scan.model}
          </span>
        )}
      </div>

      {scan && (scan.error || scan.note) && <p className="text-[12.5px] text-muted">{scan.error ?? scan.note}</p>}

      {scan?.mode === "ai" && (
        <section aria-label="Latest from the web">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Latest from the web · Gemini + Google Search</h3>
          {scan.summary && <p className="mb-2 text-[13px] text-ink">{scan.summary}</p>}
          {scan.items.length ? (
            <ul className="space-y-2">
              {scan.items.map((i) => (
                <WebItem key={`${i.title}-${i.effective}`} item={i} />
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-muted">No new policy changes found in the search window.</p>
          )}
          {(scan.queries.length > 0 || scan.searched.length > 0) && (
            <details className="mt-2 rounded-lg border border-line p-2.5 text-[11.5px]">
              <summary className="cursor-pointer font-medium text-ink">
                What Gemini searched ({scan.queries.length} queries, {scan.searched.length} pages)
              </summary>
              {scan.queries.length > 0 && <p className="mt-1.5 text-ink-2">{scan.queries.join(" · ")}</p>}
              <ul className="mt-1.5 space-y-0.5">
                {scan.searched.map((s) => (
                  <li key={s.url} className="truncate">
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <SourceNote>
            Retrieved and rated by Gemini against a fixed impact rubric; verify every item at its source before acting.
            {scan.dropped ? ` ${scan.dropped} item(s) quoting post-July 2026 food-shelf activity were withheld (August rule).` : ""} Nothing
            here feeds the forecast.
          </SourceNote>
        </section>
      )}

      <section aria-label="Tracked timeline">
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Tracked timeline · primary sources</h3>
        <ul className="divide-y divide-line">
          {tracked.map(({ event: e, impact, pressure, signals, timing }) => (
            <li key={e.id} className="py-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <ImpactBadge impact={impact} />
                <PressureTag p={pressure} />
                <span className="text-[11.5px] text-muted">
                  {e.program} · {timing === "upcoming" ? "upcoming" : monthLabel(e.start.slice(0, 7))}
                </span>
              </div>
              <a href={e.url} target="_blank" rel="noreferrer noopener" className="mt-0.5 block font-medium text-ink hover:underline">
                {e.name}
              </a>
              <p className="text-[12px] text-muted">{e.direction}</p>
              <div className="mt-1">
                <Signals fields={signals} />
              </div>
            </li>
          ))}
        </ul>
        {rated.length > limit && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 text-[12.5px] font-medium text-accent hover:underline">
            {showAll ? "Show fewer" : `Show all ${rated.length} tracked events`}
          </button>
        )}
        <SourceNote>
          docs/reference/policy_events.csv. Impact is rule-based: high = Minnesota food-benefit or supply change not expected to ease
          pressure; medium = expected to add pressure or Minnesota-specific; low = context. Q5 found SNAP months coincided with
          activity swings that could not be attributed (D-053).
        </SourceNote>
      </section>
    </div>
  );
}
