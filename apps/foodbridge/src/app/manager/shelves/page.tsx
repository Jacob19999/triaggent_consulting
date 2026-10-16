"use client";

import { useMemo, useState } from "react";
import { StackedBar } from "@/components/charts";
import { useData } from "@/components/DataProvider";
import { Badge, Button, Card, Field, Input, PageHeader, Select, SourceNote } from "@/components/ui";
import { monthLabel } from "@/lib/calendar";
import { downloadText, fmt, toCsv } from "@/lib/format";
import { DEFAULT_WEIGHTS, PRIORITY_PARTS, prioritize, type PriorityWeights } from "@/lib/priority";
import { countiesByFips, EQUITY_SHORT, equityValue, feiReady, research } from "@/lib/research";
import type { PriorityStatus, ShelfType } from "@/lib/types";

const PART_COLOR: Record<keyof PriorityWeights, string> = {
  equity: "var(--p-n)",
  stock: "var(--p-s)",
  demand: "var(--p-t)",
  capacity: "var(--p-m)",
  reporting: "var(--p-v)",
};
const STATUS: { id: PriorityStatus | ""; label: string }[] = [
  { id: "", label: "No override" },
  { id: "urgent", label: "Urgent" },
  { id: "support", label: "Support" },
  { id: "monitor", label: "Monitor" },
  { id: "stable", label: "Stable" },
];

function AddShelf() {
  const { store, refresh, session } = useData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", county_fips: "27053", type: "brick_and_mortar" as ShelfType, capacity: "", storage: "", hours: "" });
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const submit = async () => {
    if (form.name.trim().length < 2) return setError("Name the shelf (2–120 characters).");
    setError(null);
    try {
      await store.saveShelf({
        name: form.name.trim(),
        county_fips: form.county_fips,
        type: form.type,
        capacity_households: form.capacity ? Number(form.capacity) : null,
        storage_lbs: form.storage ? Number(form.storage) : null,
        hours: form.hours || null,
        contact_name: null,
        active: true,
        priority_status: null,
        manager_note: null,
      });
      await refresh();
      setOpen(false);
      setForm({ ...form, name: "", capacity: "", storage: "", hours: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add a shelf
      </Button>
    );
  return (
    <Card title="Add a shelf" className="mb-4" actions={<Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="County">
          <Select value={form.county_fips} onChange={(e) => setForm({ ...form, county_fips: e.target.value })}>
            {research.counties.map((c) => (
              <option key={c.fips} value={c.fips}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ShelfType })}>
            <option value="brick_and_mortar">Brick and mortar</option>
            <option value="mobile">Mobile</option>
            <option value="outreach">Outreach</option>
            <option value="campus">College campus</option>
            <option value="tribal">Tribal</option>
          </Select>
        </Field>
        <Field label="Capacity (visits per month)">
          <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </Field>
        <Field label="Storage (lb)">
          <Input type="number" min={0} value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
        </Field>
        <Field label="Hours">
          <Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} maxLength={200} />
        </Field>
      </div>
      {error && <p className="mt-2 text-[13px] text-[var(--critical-text)]">{error}</p>}
      <div className="mt-3">
        <Button onClick={submit}>Save shelf</Button>
      </div>
      {session.mode === "live" && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink">Give a shelf coordinator access</p>
          <p className="text-[12px] text-muted">
            Creates their account and links it to a shelf. They then sign in at /login with this email (magic link).
          </p>
          <InviteRow email={inviteEmail} setEmail={setInviteEmail} onDone={setInviteMsg} />
          {inviteMsg && <p className="mt-2 text-[12.5px] text-ink-2">{inviteMsg}</p>}
        </div>
      )}
    </Card>
  );
}

function InviteRow({ email, setEmail, onDone }: { email: string; setEmail: (v: string) => void; onDone: (m: string) => void }) {
  const { data } = useData();
  const [shelfId, setShelfId] = useState(data.shelves[0]?.id ?? "");
  const invite = async () => {
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, shelf_id: shelfId }),
    });
    const body = await res.json().catch(() => ({}));
    onDone(res.ok ? `Access granted to ${email}.` : `Could not invite: ${body.error ?? res.statusText}`);
  };
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input type="email" placeholder="coordinator@example.org" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Select value={shelfId} onChange={(e) => setShelfId(e.target.value)}>
        {data.shelves.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Button variant="secondary" onClick={invite} disabled={!email || !shelfId}>
        Grant access
      </Button>
    </div>
  );
}

function LiveDemoControls() {
  const { store, refresh, session, data } = useData();
  const [msg, setMsg] = useState<string | null>(null);
  if (session.mode !== "live" || !store.importDemo) return null;
  const hasDemo = data.shelves.some((s) => s.is_demo);
  return (
    <Card className="mb-4" title="Demo shelves in the live workspace" subtitle="Loads the same labelled synthetic network as the demo workspace, for training or a presentation. Remove it before real shelves report.">
      <div className="flex flex-wrap items-center gap-2">
        {!hasDemo ? (
          <Button variant="secondary" onClick={async () => { setMsg(`Loaded ${await store.importDemo!()} demo shelves.`); await refresh(); }}>
            Load demo shelves
          </Button>
        ) : (
          <Button variant="danger" onClick={async () => { setMsg(`Removed ${await store.removeDemo!()} demo shelves and their reports.`); await refresh(); }}>
            Remove demo shelves
          </Button>
        )}
        {msg && <span className="text-[13px] text-ink-2">{msg}</span>}
      </div>
    </Card>
  );
}

export default function ShelvesPage() {
  const { outlooks, store, refresh, asOf } = useData();
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const rows = useMemo(() => prioritize(outlooks, weights), [outlooks, weights]);
  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 1;

  const setStatus = async (id: string, status: PriorityStatus | "") => {
    const shelf = outlooks.find((o) => o.shelf.id === id)?.shelf;
    if (!shelf) return;
    const { id: _id, created_at: _c, is_demo: _d, ...rest } = shelf;
    await store.saveShelf({ ...rest, id, priority_status: status || null });
    await refresh();
  };
  const setNote = async (id: string, note: string) => {
    const shelf = outlooks.find((o) => o.shelf.id === id)?.shelf;
    if (!shelf) return;
    const { id: _id, created_at: _c, is_demo: _d, ...rest } = shelf;
    await store.saveShelf({ ...rest, id, manager_note: note || null });
    await refresh();
  };

  const exportCsv = () =>
    downloadText(
      "foodbridge-shelf-priorities.csv",
      toCsv(
        rows.map((r, i) => ({
          rank: i + 1,
          shelf: r.outlook.shelf.name,
          county: countiesByFips[r.outlook.shelf.county_fips]?.name,
          score: Math.round(r.score),
          override: r.status ?? "",
          forecast_visits: r.outlook.households ? Math.round(r.outlook.households.yhat) : "",
          stock_coverage: r.outlook.coverage == null ? "" : r.outlook.coverage.toFixed(2),
          growth: r.outlook.growth == null ? "" : r.outlook.growth.toFixed(3),
          utilization: r.outlook.utilization == null ? "" : r.outlook.utilization.toFixed(2),
          overdue: r.outlook.overdue,
          note: r.outlook.shelf.manager_note ?? "",
        })),
      ),
    );

  const watch = [...research.counties]
    .filter((c) => equityValue(c) != null)
    .sort((a, b) => (equityValue(b) ?? 0) - (equityValue(a) ?? 0))
    .slice(0, 12);

  return (
    <>
      <PageHeader
        eyebrow="Manage & prioritize"
        title="Shelves and priorities"
        description="A transparent score ranks shelves for outreach. Adjust the weights, set an override with a note, and export the list for the planning meeting. The score never moves food on its own."
        actions={
          <>
            <AddShelf />
            <Button variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />
      <LiveDemoControls />
      <Card title="Score weights" subtitle={`Each part is 0–1; the score is the weighted sum, scaled to 100. Total weight ${total}.`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {PRIORITY_PARTS.map((p) => (
            <Field key={p.key} label={`${p.label}: ${weights[p.key]}`} hint={p.help}>
              <input
                type="range"
                min={0}
                max={50}
                value={weights[p.key]}
                onChange={(e) => setWeights({ ...weights, [p.key]: Number(e.target.value) })}
                className="w-full"
                style={{ accentColor: PART_COLOR[p.key] }}
              />
            </Field>
          ))}
        </div>
        <div className="mt-2">
          <Button size="sm" variant="ghost" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
            Reset weights
          </Button>
        </div>
      </Card>

      <Card className="mt-4" title="Ranked shelves" subtitle={`Forecasts are for the month after ${monthLabel(asOf)}.`}>
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">Shelf</th>
                <th className="py-1.5 pr-2 font-medium">Score</th>
                <th className="w-[200px] py-1.5 pr-2 font-medium">Why</th>
                <th className="py-1.5 pr-2 text-right font-medium">Forecast visits</th>
                <th className="py-1.5 pr-2 text-right font-medium">Stock cover</th>
                <th className="py-1.5 pr-2 text-right font-medium">Growth</th>
                <th className="py-1.5 pr-2 text-right font-medium">Capacity used</th>
                <th className="py-1.5 pr-2 font-medium">Override</th>
                <th className="py-1.5 font-medium">Manager note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const o = r.outlook;
                const c = countiesByFips[o.shelf.county_fips];
                return (
                  <tr key={o.shelf.id} className="border-t border-line align-top">
                    <td className="py-2 pr-2 text-muted">{i + 1}</td>
                    <td className="py-2 pr-2">
                      <div className="font-medium text-ink">{o.shelf.name}</div>
                      <div className="text-[12px] text-muted">
                        {c?.name} · {EQUITY_SHORT} {fmt.num(c ? equityValue(c) : null, feiReady ? 1 : 0)}
                        {o.overdue && <span className="ml-1 text-[var(--warning-text)]">· report overdue</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-[15px] font-semibold text-ink">{fmt.num(r.score, 0)}</td>
                    <td className="py-2 pr-2">
                      <StackedBar
                        height={10}
                        total={100}
                        parts={PRIORITY_PARTS.map((p) => ({
                          key: p.key,
                          label: p.label.split(" ")[0],
                          color: PART_COLOR[p.key],
                          value: (100 / total) * weights[p.key] * r.parts[p.key],
                        })).filter((p) => p.value > 0.5)}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {o.households ? (
                        <>
                          <span className="font-medium text-ink">{fmt.int(o.households.yhat)}</span>
                          <div className="text-[11.5px] text-muted">
                            {fmt.int(o.households.lo80)}–{fmt.int(o.households.hi80)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right text-ink">{fmt.pct(o.coverage)}</td>
                    <td className="py-2 pr-2 text-right text-ink">{fmt.signedPct(o.growth)}</td>
                    <td className="py-2 pr-2 text-right text-ink">{fmt.pct(o.utilization)}</td>
                    <td className="py-2 pr-2">
                      <Select
                        aria-label={`Override for ${o.shelf.name}`}
                        value={o.shelf.priority_status ?? ""}
                        onChange={(e) => setStatus(o.shelf.id, e.target.value as PriorityStatus | "")}
                        className="h-8 min-w-[120px] text-[12.5px]"
                      >
                        {STATUS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2">
                      <Input
                        aria-label={`Note for ${o.shelf.name}`}
                        defaultValue={o.shelf.manager_note ?? ""}
                        onBlur={(e) => e.target.value !== (o.shelf.manager_note ?? "") && setNote(o.shelf.id, e.target.value)}
                        placeholder="Add a note…"
                        className="h-8 min-w-[180px] text-[12.5px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <SourceNote>
          Stock cover = (inventory on hand + average receipts) ÷ forecast pounds. Growth = forecast visits vs the 6-month
          average. Capacity used = upper 80% forecast visits ÷ stated capacity. Forecast: the D-045 recency-weighted run rate on
          each shelf&apos;s own reports.
        </SourceNote>
      </Card>

      <Card className="mt-4" title={feiReady ? "Counties to watch (highest FEI)" : "Counties to watch (need screen)"}>
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">County</th>
                <th className="py-1 text-right font-medium">{EQUITY_SHORT}</th>
                <th className="py-1 text-right font-medium">Q6 need pct</th>
                <th className="py-1 text-right font-medium">Miles to nearest reporting shelf</th>
                <th className="py-1 text-right font-medium">LILA tracts w/o shelf</th>
                <th className="py-1 text-right font-medium">Aug visits (forecast)</th>
                <th className="py-1 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {watch.map((c) => (
                <tr key={c.fips} className="border-t border-line">
                  <td className="py-1.5 text-ink">{c.name}</td>
                  <td className="py-1.5 text-right font-semibold text-ink">{fmt.num(equityValue(c), feiReady ? 1 : 0)}</td>
                  <td className="py-1.5 text-right text-ink-2">{fmt.num(c.need_percentile, 0)}</td>
                  <td className="py-1.5 text-right text-ink-2">{fmt.num(c.mean_miles, 1)}</td>
                  <td className="py-1.5 text-right text-ink-2">{c.lila_without_site}</td>
                  <td className="py-1.5 text-right text-ink-2">{fmt.int(c.forecast.HouseholdsTotal?.yhat)}</td>
                  <td className="py-1.5">
                    <span className="flex flex-wrap gap-1">
                      {c.robust && <Badge tone="demo">Q6 audit first</Badge>}
                      {c.fei?.stable_high && <Badge>Stable high FEI</Badge>}
                      {c.sites_2024 === 0 && <Badge>No reporting shelf</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
