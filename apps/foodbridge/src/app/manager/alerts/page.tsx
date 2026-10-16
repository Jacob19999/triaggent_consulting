"use client";

import { useState } from "react";
import { AlertList } from "@/components/AlertList";
import { useData } from "@/components/DataProvider";
import { Card, PageHeader, Select, SourceNote } from "@/components/ui";
import type { Alert, Severity } from "@/lib/alerts";
import { downloadText, toCsv } from "@/lib/format";

const SCOPES: { id: "all" | Alert["scope"]; label: string }[] = [
  { id: "all", label: "All scopes" },
  { id: "shelf", label: "Shelves (forecast and reports)" },
  { id: "county", label: "Counties (equity and access)" },
  { id: "network", label: "Policy watch" },
];

export default function AlertsPage() {
  const { alerts, alertState } = useData();
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("shelf");
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [status, setStatus] = useState<"active" | "all" | "resolved">("active");
  const shown = alerts.filter((a) => {
    const st = alertState(a.key)?.status ?? "open";
    return (
      (scope === "all" || a.scope === scope) &&
      (severity === "all" || a.severity === severity) &&
      (status === "all" || (status === "resolved" ? st === "resolved" : st !== "resolved"))
    );
  });
  const count = (s: Alert["scope"]) => alerts.filter((a) => a.scope === s && (alertState(a.key)?.status ?? "open") !== "resolved").length;

  return (
    <>
      <PageHeader
        eyebrow="Alert center"
        title="Early warnings"
        description="Rules run on each shelf's reports and next-month forecast, on county research evidence and on the dated policy timeline. Each alert shows the numbers behind it and a next step. Acknowledge or resolve to keep the list honest."
        actions={
          <button
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[14px] font-medium text-ink hover:bg-surface-2"
            onClick={() =>
              downloadText(
                "foodbridge-alerts.csv",
                toCsv(
                  shown.map((a) => ({
                    severity: a.severity,
                    scope: a.scope,
                    category: a.category,
                    title: a.title,
                    detail: a.detail,
                    action: a.action,
                    status: alertState(a.key)?.status ?? "open",
                    source: a.source,
                  })),
                ),
              )
            }
          >
            Export CSV
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} aria-label="Scope">
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.id !== "all" ? ` (${count(s.id as Alert["scope"])})` : ""}
            </option>
          ))}
        </Select>
        <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} aria-label="Severity">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="serious">Serious</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="active">Open and acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </Select>
      </div>
      <Card>
        <AlertList alerts={shown} emptyText="Nothing matches these filters." />
      </Card>
      <SourceNote>
        Severity: critical = forecast pounds exceed what is on hand plus typical receipts; serious = short if demand reaches the
        upper 80% band, or over capacity; warning = trend or reporting issues; info = context and data checks. Forecast
        alerts say &ldquo;may&rdquo;: the band is a planning range, and historical bands undercovered.
      </SourceNote>
    </>
  );
}
