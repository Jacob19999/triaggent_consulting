"use client";

import Link from "next/link";
import { useState } from "react";
import type { Alert } from "@/lib/alerts";
import { countyName } from "@/lib/research";
import type { AlertStatus } from "@/lib/types";
import { useData } from "./DataProvider";
import { Badge, Button, cx, Empty, SeverityBadge } from "./ui";

export function AlertList({
  alerts,
  limit,
  compact,
  showWhere = true,
  emptyText = "No alerts right now.",
}: {
  alerts: Alert[];
  limit?: number;
  compact?: boolean;
  showWhere?: boolean;
  emptyText?: string;
}) {
  const { alertState, store, refresh, data } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  const shelfName = (id?: string) => data.shelves.find((s) => s.id === id)?.name;
  const shown = limit ? alerts.slice(0, limit) : alerts;
  if (!shown.length) return <Empty title={emptyText} />;

  const act = async (a: Alert, status: AlertStatus) => {
    setBusy(a.key);
    try {
      await store.setAlertState(a.key, status, null, a.shelfId ?? null);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="divide-y divide-line">
      {shown.map((a) => {
        const state = alertState(a.key);
        const status = state?.status ?? "open";
        return (
          <li key={a.key} className={cx("py-3 first:pt-0 last:pb-0", status === "resolved" && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={a.severity} />
              {showWhere && (
                <span className="text-[12px] text-muted">
                  {a.shelfId ? shelfName(a.shelfId) : a.fips ? `${countyName(a.fips)} County` : "Network"}
                </span>
              )}
              {status !== "open" && <Badge>{status === "acknowledged" ? "Acknowledged" : "Resolved"}</Badge>}
            </div>
            <p className="mt-1 text-[14px] font-semibold text-ink">{a.title}</p>
            {!compact && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{a.detail}</p>}
            {!compact && a.metrics.length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-1.5">
                {a.metrics.map((m) => (
                  <div key={m.label} className="rounded-md bg-surface-2 px-2 py-1 text-[12px]" title={m.field}>
                    <dt className="inline text-muted">{m.label}: </dt>
                    <dd className="tabular inline font-semibold text-ink">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-1.5 text-[13px] text-ink">
              <span className="font-medium">Next step:</span> {a.action}
            </p>
            {!compact && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {status === "open" && (
                  <Button size="sm" variant="secondary" disabled={busy === a.key} onClick={() => act(a, "acknowledged")}>
                    Acknowledge
                  </Button>
                )}
                {status !== "resolved" && (
                  <Button size="sm" variant="secondary" disabled={busy === a.key} onClick={() => act(a, "resolved")}>
                    Mark resolved
                  </Button>
                )}
                {status !== "open" && (
                  <Button size="sm" variant="ghost" disabled={busy === a.key} onClick={() => act(a, "open")}>
                    Reopen
                  </Button>
                )}
                {a.fips && a.scope === "county" && (
                  <Link className="text-[12.5px] text-accent underline" href={`/manager/map?county=${a.fips}`}>
                    Open on map
                  </Link>
                )}
                <span className="text-[11.5px] text-muted">
                  Source: {a.url ? <a className="underline" href={a.url} target="_blank" rel="noreferrer noopener">{a.source}</a> : a.source}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
