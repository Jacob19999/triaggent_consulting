// Opt-in check of the app's payloads against a real Supabase project:
//   SUPABASE_INTEGRATION=1 npx vitest run tests/supabase.integration.test.ts
// Reads apps/foodbridge/.env.local. Inserts one labelled demo shelf with its reports, a
// request, an alert state and a scenario, checks constraints and row-level security,
// then deletes everything it created.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoInsertRows } from "@/lib/demoRows";

function env(): Record<string, string> {
  const file = path.join(__dirname, "../.env.local");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
  );
}

const e = env();
const run = process.env.SUPABASE_INTEGRATION === "1" && e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SECRET_KEY;

describe.runIf(run)("Supabase schema accepts the app's writes", () => {
  // Clients are built in beforeAll: vitest still collects a skipped suite's body, and
  // createClient throws on an empty URL, which failed `npm test` on machines without .env.local.
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  beforeAll(() => {
    admin = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  });
  const rows = demoInsertRows(randomUUID, 1);
  const shelfId = rows.shelves[0].id;
  rows.shelves[0].name = `Integration test — ${rows.shelves[0].name}`.slice(0, 120);
  const alertKey = `itest:${randomUUID()}`;
  const scenarioId = randomUUID();

  afterAll(async () => {
    await admin.from("scenarios").delete().eq("id", scenarioId);
    await admin.from("shelves").delete().eq("id", shelfId); // cascades to reports, requests, alert states
  });

  it("inserts a demo shelf, its reports and a request", async () => {
    expect((await admin.from("shelves").insert(rows.shelves)).error).toBeNull();
    expect((await admin.from("shelf_reports").insert(rows.reports)).error).toBeNull();
    if (rows.requests.length) expect((await admin.from("shelf_requests").insert(rows.requests)).error).toBeNull();
    const { count } = await admin.from("shelf_reports").select("id", { count: "exact", head: true }).eq("shelf_id", shelfId);
    expect(count).toBe(rows.reports.length);
  });

  it("upserts a report on (shelf_id, month) like the report form", async () => {
    const r = rows.reports[rows.reports.length - 1];
    const res = await admin
      .from("shelf_reports")
      .upsert({ ...r, households: r.households + 1, submitted_at: new Date().toISOString() }, { onConflict: "shelf_id,month" });
    expect(res.error).toBeNull();
    const { data } = await admin.from("shelf_reports").select("households").eq("shelf_id", shelfId).eq("month", r.month).single();
    expect(data?.households).toBe(r.households + 1);
  });

  it("stores alert follow-up and a scenario", async () => {
    const a = await admin.from("alert_states").upsert({ alert_key: alertKey, status: "acknowledged", note: null, shelf_id: shelfId });
    expect(a.error).toBeNull();
    const s = await admin.from("scenarios").insert({ id: scenarioId, name: "Integration test scenario", kind: "new_shelf", payload: { ok: true } });
    expect(s.error).toBeNull();
  });

  it("rejects values outside the schema's checks", async () => {
    const bad = await admin.from("shelves").insert({ name: "Integration test bad county", county_fips: "99999" });
    expect(bad.error).not.toBeNull();
    const badMonth = await admin.from("shelf_reports").insert({ ...rows.reports[0], month: "2026-13" });
    expect(badMonth.error).not.toBeNull();
  });

  it("row-level security hides everything from the public key", async () => {
    const { data } = await anon.from("shelves").select("id").eq("id", shelfId);
    expect(data ?? []).toHaveLength(0);
    const reports = await anon.from("shelf_reports").select("id").eq("shelf_id", shelfId);
    expect(reports.data ?? []).toHaveLength(0);
    const write = await anon.from("shelves").insert({ name: "Integration test anon", county_fips: "27001" });
    expect(write.error).not.toBeNull();
  });
});
