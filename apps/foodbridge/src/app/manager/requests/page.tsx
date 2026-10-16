"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { Badge, Button, Card, Empty, Input, PageHeader, Select } from "@/components/ui";
import { fmt } from "@/lib/format";
import { countiesByFips } from "@/lib/research";
import type { RequestStatus } from "@/lib/types";

export default function RequestsInbox() {
  const { data, store, refresh } = useData();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rows = data.requests.filter((r) => filter === "all" || r.status === "open" || r.status === "in_progress");
  const update = async (id: string, status: RequestStatus) => {
    await store.updateRequest(id, { status, response: drafts[id] ?? data.requests.find((r) => r.id === id)?.response ?? null });
    await refresh();
  };
  return (
    <>
      <PageHeader
        eyebrow="Requests"
        title="Requests from shelves"
        description="Food, volunteer, funding and transport requests raised in the shelf portal. Reply and set the status; the shelf sees both."
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value as "active" | "all")} aria-label="Filter">
            <option value="active">Open and in progress</option>
            <option value="all">All requests</option>
          </Select>
        }
      />
      {rows.length === 0 ? (
        <Empty title="No requests to show." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const shelf = data.shelves.find((s) => s.id === r.shelf_id);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{shelf?.name ?? "Shelf"}</span>
                  <span className="text-[12px] text-muted">{shelf ? countiesByFips[shelf.county_fips]?.name : ""} County</span>
                  <Badge>{r.kind}</Badge>
                  <Badge tone={r.urgency === "high" ? "demo" : "neutral"}>{r.urgency} urgency</Badge>
                  <Badge tone={r.status === "fulfilled" ? "green" : "neutral"}>{r.status.replace("_", " ")}</Badge>
                  <span className="ml-auto text-[12px] text-muted">{fmt.date(r.created_at)}</span>
                </div>
                <p className="mt-2 text-[14px] text-ink">{r.message}</p>
                {r.pounds_requested != null && <p className="text-[12.5px] text-muted">{fmt.int(r.pounds_requested)} lb requested</p>}
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                  <Input
                    placeholder="Reply to the shelf…"
                    defaultValue={r.response ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                    maxLength={2000}
                  />
                  <Button variant="secondary" onClick={() => update(r.id, "in_progress")}>
                    In progress
                  </Button>
                  <Button variant="secondary" onClick={() => update(r.id, "fulfilled")}>
                    Fulfilled
                  </Button>
                  <Button variant="ghost" onClick={() => update(r.id, "declined")}>
                    Decline
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
