"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, SourceNote } from "@/components/ui";
import { useMyShelf } from "@/components/useMyShelf";
import { shelfOutlook } from "@/lib/alerts";
import { addMonths, monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import type { ShelfReport } from "@/lib/types";

type NumKey =
  | "households"
  | "individuals"
  | "children"
  | "adults"
  | "seniors"
  | "pounds_distributed"
  | "pounds_received"
  | "inventory_lbs"
  | "volunteer_hours"
  | "turned_away";

const FIELDS: { key: NumKey; label: string; hint: string; required?: boolean }[] = [
  { key: "households", label: "Visits (households served)", hint: "HouseholdsReg: one trip by one household.", required: true },
  { key: "individuals", label: "Individuals served", hint: "IndividualsReg: people in those households.", required: true },
  { key: "children", label: "Children (0–17)", hint: "ChildrenReg", required: true },
  { key: "adults", label: "Adults (18–64)", hint: "AdultsReg", required: true },
  { key: "seniors", label: "Seniors (65+)", hint: "SeniorsReg", required: true },
  { key: "pounds_distributed", label: "Pounds distributed", hint: "PoundsReg: weight leaving the shelf.", required: true },
  { key: "pounds_received", label: "Pounds received", hint: "All sources: food bank, TEFAP, donations, purchases." },
  { key: "inventory_lbs", label: "Food on hand at month end (lb)", hint: "Drives the stock-out warning." },
  { key: "volunteer_hours", label: "Volunteer hours", hint: "Optional." },
  { key: "turned_away", label: "Households turned away", hint: "Could not be served (stock, hours, eligibility). Unmet demand." },
];

type Form = Record<NumKey, string> & { notes: string };
const EMPTY: Form = {
  households: "",
  individuals: "",
  children: "",
  adults: "",
  seniors: "",
  pounds_distributed: "",
  pounds_received: "",
  inventory_lbs: "",
  volunteer_hours: "",
  turned_away: "",
  notes: "",
};

function toForm(r?: ShelfReport): Form {
  if (!r) return EMPTY;
  const f = { ...EMPTY };
  for (const { key } of FIELDS) f[key] = r[key] == null ? "" : String(r[key]);
  f.notes = r.notes ?? "";
  return f;
}

export default function ReportPage() {
  const { data, store, refresh, asOf } = useData();
  const { shelf, outlook } = useMyShelf();
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonths(asOf, -i)), [asOf]);
  const [month, setMonth] = useState(asOf);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<NumKey | "form", string>>>({});
  const [done, setDone] = useState<string | null>(null);
  const existing = shelf ? data.reports.find((r) => r.shelf_id === shelf.id && r.month === month) : undefined;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("month");
    if (q && /^\d{4}-\d{2}$/.test(q) && q <= asOf) setMonth(q);
  }, [asOf]);
  useEffect(() => {
    setForm(toForm(existing));
    setErrors({});
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, shelf?.id, existing?.id]);

  if (!shelf) return <Empty title="No shelf selected." />;
  const prev = data.reports.find((r) => r.shelf_id === shelf.id && r.month === addMonths(month, -1));
  const n = (k: NumKey) => (form[k] === "" ? null : Number(form[k]));
  const ageSum = (n("children") ?? 0) + (n("adults") ?? 0) + (n("seniors") ?? 0);

  const warnings: string[] = [];
  if (n("households") != null && n("individuals") != null && n("households")! > n("individuals")!)
    warnings.push("Visits are above individuals served. Check whether one was keyed in the other's box.");
  if (n("individuals") != null && ageSum && ageSum !== n("individuals"))
    warnings.push(`Children + adults + seniors = ${fmt.int(ageSum)}, but individuals = ${fmt.int(n("individuals"))}.`);
  if (prev && n("households") != null && prev.households > 0) {
    const change = n("households")! / prev.households - 1;
    if (Math.abs(change) > 0.5) warnings.push(`Visits changed ${fmt.signedPct(change)} from ${monthLabel(prev.month)}. Double-check before submitting.`);
  }
  if (prev && n("pounds_distributed") != null && prev.pounds_distributed > 0) {
    const change = n("pounds_distributed")! / prev.pounds_distributed - 1;
    if (Math.abs(change) > 0.6) warnings.push(`Pounds changed ${fmt.signedPct(change)} from ${monthLabel(prev.month)}.`);
  }

  const submit = async () => {
    const errs: typeof errors = {};
    for (const f of FIELDS) {
      const v = form[f.key];
      if (v === "") {
        if (f.required) errs[f.key] = "Required";
        continue;
      }
      const num = Number(v);
      if (!Number.isInteger(num) || num < 0 || num > 1e9) errs[f.key] = "Whole number, 0 or more";
    }
    if (form.notes.length > 2000) errs.form = "Notes must be under 2,000 characters.";
    if (n("individuals") != null && ageSum !== n("individuals")) errs.adults = "Age groups must add up to individuals served";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await store.saveReport({
        shelf_id: shelf.id,
        month,
        households: n("households")!,
        individuals: n("individuals")!,
        children: n("children")!,
        adults: n("adults")!,
        seniors: n("seniors")!,
        pounds_distributed: n("pounds_distributed")!,
        pounds_received: n("pounds_received"),
        inventory_lbs: n("inventory_lbs"),
        volunteer_hours: n("volunteer_hours"),
        turned_away: n("turned_away"),
        notes: form.notes || null,
      });
      await refresh();
      setDone(month);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : String(e) });
    }
  };

  const after = done && outlook ? shelfOutlook(shelf, data.reports, asOf) : null;

  return (
    <>
      <PageHeader
        eyebrow="Monthly report"
        title={`Report for ${shelf.name}`}
        description="The same fields the statewide network reports (HouseholdsReg, IndividualsReg, the age split and PoundsReg), plus stock and turn-aways so FoodBridge can warn you early."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <Card
          title={
            <span className="flex items-center gap-2">
              {monthLabel(month, "long")} {existing ? <Badge>Editing a submitted report</Badge> : <Badge tone="demo">Not yet submitted</Badge>}
            </span>
          }
          actions={
            <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Report month" className="w-[170px]">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m, "long")}
                  {data.reports.some((r) => r.shelf_id === shelf.id && r.month === m) ? " ✓" : ""}
                </option>
              ))}
            </Select>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? "" : " (optional)"}`} hint={f.hint} error={errors[f.key]}>
                <Input
                  inputMode="numeric"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value.replace(/[^\d]/g, "") })}
                  aria-invalid={Boolean(errors[f.key])}
                  placeholder={prev?.[f.key] != null ? `Last month: ${fmt.int(prev[f.key] as number)}` : undefined}
                />
              </Field>
            ))}
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const ind = n("individuals");
                if (ind == null) return;
                const rest = ind - (n("children") ?? 0) - (n("seniors") ?? 0);
                setForm({ ...form, adults: String(Math.max(0, rest)) });
              }}
            >
              Set adults to individuals − children − seniors
            </Button>
          </div>
          <div className="mt-4">
            <Field label="Notes (optional)" hint="Anything unusual this month: closures, a special distribution, a data correction.">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-line bg-surface p-3 text-[14px] text-ink"
              />
            </Field>
          </div>
          {warnings.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-lg border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-3 text-[13px] text-ink">
              {warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          {errors.form && <p className="mt-3 text-[13px] text-[var(--critical-text)]">{errors.form}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={submit}>{existing ? "Save changes" : "Submit report"}</Button>
            <span className="text-[12px] text-muted">Reports for future months are not accepted.</span>
          </div>
        </Card>
        <div className="space-y-4">
          {after ? (
            <Card title="Thanks, report saved" subtitle={`Here is what it means for ${monthLabel(after.target, "long")}.`}>
              <dl className="tabular grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-muted">Forecast visits</dt>
                <dd className="text-right font-semibold text-ink">{fmt.int(after.households?.yhat)}</dd>
                <dt className="text-muted">80% band</dt>
                <dd className="text-right text-ink-2">
                  {fmt.int(after.households?.lo80)}–{fmt.int(after.households?.hi80)}
                </dd>
                <dt className="text-muted">Forecast pounds</dt>
                <dd className="text-right font-semibold text-ink">{fmt.int(after.pounds?.yhat)}</dd>
                <dt className="text-muted">Stock cover</dt>
                <dd className="text-right text-ink-2">{fmt.pct(after.coverage)}</dd>
              </dl>
              <Link href="/shelf" className="mt-3 inline-block text-[13px] font-medium text-accent underline">
                See alerts on your dashboard
              </Link>
            </Card>
          ) : (
            <Card title="Why we ask">
              <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-ink-2">
                <li>Visits, individuals, ages and pounds are the three signals the network tracks separately; they do not always move together.</li>
                <li>Food on hand and receipts let FoodBridge warn you before a stock-out, not after.</li>
                <li>Turn-aways show demand the shelf could not meet, which visit counts alone hide.</li>
              </ul>
              <SourceNote>Your report is visible to your network managers. No client names or addresses are collected.</SourceNote>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
