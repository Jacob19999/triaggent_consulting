"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select } from "@/components/ui";
import { useMyShelf } from "@/components/useMyShelf";
import { fmt } from "@/lib/format";
import type { RequestKind } from "@/lib/types";

export default function ShelfRequests() {
  const { data, store, refresh } = useData();
  const { shelf, outlook } = useMyShelf();
  const [kind, setKind] = useState<RequestKind>("food");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high">("normal");
  const [message, setMessage] = useState("");
  const [pounds, setPounds] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!shelf) return <Empty title="No shelf selected." />;
  const mine = data.requests.filter((r) => r.shelf_id === shelf.id);
  const shortfall = outlook?.pounds && outlook.available != null ? Math.max(0, Math.round(outlook.pounds.hi80 - outlook.available)) : 0;
  const submit = async () => {
    if (!message.trim()) return setError("Describe what you need.");
    setError(null);
    await store.createRequest({
      shelf_id: shelf.id,
      kind,
      urgency,
      message: message.trim().slice(0, 2000),
      pounds_requested: pounds ? Math.max(0, Math.round(Number(pounds))) : null,
    });
    setMessage("");
    setPounds("");
    await refresh();
  };
  return (
    <>
      <PageHeader eyebrow="Requests" title="Ask the food bank for support" description="Requests go to your network managers' inbox. You will see their reply and status here." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <Card title="New request">
          <div className="space-y-3">
            <Field label="What do you need?">
              <Select value={kind} onChange={(e) => setKind(e.target.value as RequestKind)}>
                <option value="food">Food / extra delivery</option>
                <option value="volunteers">Volunteers</option>
                <option value="transport">Transport or delivery help</option>
                <option value="equipment">Equipment (cold storage, shelving)</option>
                <option value="funding">Funding</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Urgency">
              <Select value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </Field>
            {kind === "food" && (
              <Field
                label="Pounds requested (optional)"
                hint={shortfall > 0 ? `If demand reaches the upper 80% forecast you would be about ${fmt.int(shortfall)} lb short.` : undefined}
              >
                <Input inputMode="numeric" value={pounds} onChange={(e) => setPounds(e.target.value.replace(/[^\d]/g, ""))} />
              </Field>
            )}
            <Field label="Message">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-lg border border-line bg-surface p-3 text-[14px] text-ink"
              />
            </Field>
            {error && <p className="text-[13px] text-[var(--critical-text)]">{error}</p>}
            <Button onClick={submit}>Send request</Button>
          </div>
        </Card>
        <div className="space-y-3">
          {mine.length === 0 ? (
            <Empty title="No requests yet." />
          ) : (
            mine.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{r.kind}</Badge>
                  <Badge tone={r.status === "fulfilled" ? "green" : "neutral"}>{r.status.replace("_", " ")}</Badge>
                  <span className="ml-auto text-[12px] text-muted">{fmt.date(r.created_at)}</span>
                </div>
                <p className="mt-2 text-[14px] text-ink">{r.message}</p>
                {r.pounds_requested != null && <p className="text-[12.5px] text-muted">{fmt.int(r.pounds_requested)} lb requested</p>}
                {r.response && (
                  <p className="mt-2 rounded-lg bg-surface-2 p-2.5 text-[13px] text-ink-2">
                    <span className="font-medium text-ink">Manager:</span> {r.response}
                  </p>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
