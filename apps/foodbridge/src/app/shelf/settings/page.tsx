"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select } from "@/components/ui";
import { useMyShelf } from "@/components/useMyShelf";
import { countiesByFips } from "@/lib/research";
import type { ShelfType } from "@/lib/types";

export default function ShelfSettings() {
  const { store, refresh } = useData();
  const { shelf } = useMyShelf();
  const [form, setForm] = useState({ name: "", type: "brick_and_mortar" as ShelfType, capacity: "", storage: "", hours: "", contact: "" });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (shelf)
      setForm({
        name: shelf.name,
        type: shelf.type,
        capacity: shelf.capacity_households?.toString() ?? "",
        storage: shelf.storage_lbs?.toString() ?? "",
        hours: shelf.hours ?? "",
        contact: shelf.contact_name ?? "",
      });
  }, [shelf]);
  if (!shelf) return <Empty title="No shelf selected." />;
  const save = async () => {
    const { id, created_at: _c, is_demo: _d, ...rest } = shelf;
    await store.saveShelf({
      ...rest,
      id,
      name: form.name.trim() || shelf.name,
      type: form.type,
      capacity_households: form.capacity ? Number(form.capacity) : null,
      storage_lbs: form.storage ? Number(form.storage) : null,
      hours: form.hours || null,
      contact_name: form.contact || null,
    });
    await refresh();
    setMsg("Saved.");
  };
  return (
    <>
      <PageHeader eyebrow="Shelf profile" title="Profile and capacity" description="Capacity and storage set the thresholds for capacity and stock alerts." />
      <Card
        title={shelf.name}
        subtitle={`${countiesByFips[shelf.county_fips]?.name} County (set by your network manager)`}
        actions={shelf.is_demo ? <Badge tone="demo">Demo shelf</Badge> : undefined}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Shelf name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
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
          <Field label="Capacity (visits per month)" hint="The most households you can serve in a month at current hours and staffing.">
            <Input inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/[^\d]/g, "") })} />
          </Field>
          <Field label="Storage (lb)">
            <Input inputMode="numeric" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value.replace(/[^\d]/g, "") })} />
          </Field>
          <Field label="Hours">
            <Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} maxLength={200} />
          </Field>
          <Field label="Contact name">
            <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={120} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save}>Save profile</Button>
          {msg && <span className="text-[13px] text-[var(--good-text)]">{msg}</span>}
        </div>
      </Card>
    </>
  );
}
