"use client";
// Two interchangeable backends behind one interface:
//  - DemoStore: seeded synthetic network in this browser's storage (no login).
//  - SupabaseStore: shared Postgres with row-level security (sign-in required).

import { buildDemoData } from "./demo";
import { demoInsertRows } from "./demoRows";
import { browserSupabase } from "./supabase/client";
import type {
  AlertState,
  AlertStatus,
  SavedScenario,
  Shelf,
  ShelfReport,
  ShelfRequest,
} from "./types";

export interface Snapshot {
  shelves: Shelf[];
  reports: ShelfReport[];
  requests: ShelfRequest[];
  alertStates: AlertState[];
  scenarios: SavedScenario[];
}

export type ShelfInput = Omit<Shelf, "id" | "created_at" | "is_demo"> & { id?: string };
export type ReportInput = Omit<ShelfReport, "id" | "submitted_at" | "submitted_by"> & { id?: string };
export type RequestInput = Pick<ShelfRequest, "shelf_id" | "kind" | "urgency" | "message" | "pounds_requested">;

export interface Store {
  kind: "demo" | "live";
  load(): Promise<Snapshot>;
  saveShelf(input: ShelfInput): Promise<void>;
  saveReport(input: ReportInput): Promise<void>;
  createRequest(input: RequestInput): Promise<void>;
  updateRequest(id: string, patch: Partial<Pick<ShelfRequest, "status" | "response">>): Promise<void>;
  setAlertState(key: string, status: AlertStatus, note: string | null, shelfId?: string | null): Promise<void>;
  saveScenario(input: Omit<SavedScenario, "id" | "created_at">): Promise<void>;
  deleteScenario(id: string): Promise<void>;
  reset?(): Promise<void>;
  /** Live only: copy the labelled synthetic demo network in, or remove it again. */
  importDemo?(): Promise<number>;
  removeDemo?(): Promise<number>;
}

const KEY = "foodbridge.demo.v1";
const now = () => new Date().toISOString();
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function seed(): Snapshot {
  const d = buildDemoData();
  return { ...d, alertStates: [], scenarios: [] };
}

export class DemoStore implements Store {
  kind = "demo" as const;
  private memory: Snapshot | null = null;

  private read(): Snapshot {
    if (this.memory) return this.memory;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        this.memory = JSON.parse(raw) as Snapshot;
        return this.memory;
      }
    } catch {
      // Private mode or blocked storage: fall back to memory only.
    }
    this.memory = seed();
    this.write();
    return this.memory;
  }

  private write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.memory));
    } catch {
      // Storage unavailable; the session keeps working in memory.
    }
  }

  async load() {
    return structuredClone(this.read());
  }

  async saveShelf(input: ShelfInput) {
    const s = this.read();
    const existing = input.id ? s.shelves.find((x) => x.id === input.id) : undefined;
    if (existing) Object.assign(existing, input);
    else s.shelves.push({ ...input, id: input.id ?? uid(), is_demo: true, created_at: now() } as Shelf);
    this.write();
  }

  async saveReport(input: ReportInput) {
    const s = this.read();
    const i = s.reports.findIndex((r) => r.shelf_id === input.shelf_id && r.month === input.month);
    const row: ShelfReport = {
      ...input,
      id: i >= 0 ? s.reports[i].id : uid(),
      submitted_at: now(),
      submitted_by: "demo user",
    };
    if (i >= 0) s.reports[i] = row;
    else s.reports.push(row);
    this.write();
  }

  async createRequest(input: RequestInput) {
    const s = this.read();
    s.requests.unshift({ ...input, id: uid(), status: "open", response: null, created_at: now(), updated_at: now() });
    this.write();
  }

  async updateRequest(id: string, patch: Partial<Pick<ShelfRequest, "status" | "response">>) {
    const s = this.read();
    const r = s.requests.find((x) => x.id === id);
    if (r) Object.assign(r, patch, { updated_at: now() });
    this.write();
  }

  async setAlertState(key: string, status: AlertStatus, note: string | null) {
    const s = this.read();
    const row = s.alertStates.find((a) => a.alert_key === key);
    if (row) Object.assign(row, { status, note, updated_at: now() });
    else s.alertStates.push({ alert_key: key, status, note, updated_at: now() });
    this.write();
  }

  async saveScenario(input: Omit<SavedScenario, "id" | "created_at">) {
    const s = this.read();
    s.scenarios.unshift({ ...input, id: uid(), created_at: now() });
    this.write();
  }

  async deleteScenario(id: string) {
    const s = this.read();
    s.scenarios = s.scenarios.filter((x) => x.id !== id);
    this.write();
  }

  async reset() {
    this.memory = seed();
    this.write();
  }
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export class SupabaseStore implements Store {
  kind = "live" as const;

  private get db() {
    const c = browserSupabase();
    if (!c) throw new Error("Supabase is not configured");
    return c;
  }

  async load(): Promise<Snapshot> {
    const [shelves, reports, requests, alertStates, scenarios] = await Promise.all([
      this.db.from("shelves").select("*").order("name"),
      this.db.from("shelf_reports").select("*").order("month"),
      this.db.from("shelf_requests").select("*").order("created_at", { ascending: false }),
      this.db.from("alert_states").select("*"),
      this.db.from("scenarios").select("*").order("created_at", { ascending: false }),
    ]);
    return {
      shelves: check(shelves) ?? [],
      reports: check(reports) ?? [],
      requests: check(requests) ?? [],
      alertStates: check(alertStates) ?? [],
      // Shelf users cannot read scenarios (RLS); treat that as empty.
      scenarios: scenarios.error ? [] : (scenarios.data ?? []),
    };
  }

  async saveShelf(input: ShelfInput) {
    const { id, ...rest } = input;
    if (id) check(await this.db.from("shelves").update(rest).eq("id", id));
    else check(await this.db.from("shelves").insert(rest));
  }

  async saveReport(input: ReportInput) {
    const { data: auth } = await this.db.auth.getUser();
    const { id: _id, ...rest } = input;
    check(
      await this.db
        .from("shelf_reports")
        .upsert({ ...rest, submitted_at: now(), submitted_by: auth.user?.id ?? null }, { onConflict: "shelf_id,month" }),
    );
  }

  async createRequest(input: RequestInput) {
    check(await this.db.from("shelf_requests").insert(input));
  }

  async updateRequest(id: string, patch: Partial<Pick<ShelfRequest, "status" | "response">>) {
    check(await this.db.from("shelf_requests").update({ ...patch, updated_at: now() }).eq("id", id));
  }

  async setAlertState(key: string, status: AlertStatus, note: string | null, shelfId?: string | null) {
    const { data: auth } = await this.db.auth.getUser();
    check(
      await this.db.from("alert_states").upsert({
        alert_key: key,
        status,
        note,
        shelf_id: shelfId ?? null,
        updated_by: auth.user?.id ?? null,
        updated_at: now(),
      }),
    );
  }

  async saveScenario(input: Omit<SavedScenario, "id" | "created_at">) {
    check(await this.db.from("scenarios").insert(input));
  }

  async deleteScenario(id: string) {
    check(await this.db.from("scenarios").delete().eq("id", id));
  }

  async importDemo(): Promise<number> {
    const { shelves, reports, requests } = demoInsertRows(uid);
    check(await this.db.from("shelves").insert(shelves));
    for (let i = 0; i < reports.length; i += 500) check(await this.db.from("shelf_reports").insert(reports.slice(i, i + 500)));
    if (requests.length) check(await this.db.from("shelf_requests").insert(requests));
    return shelves.length;
  }

  async removeDemo(): Promise<number> {
    const rows = check(await this.db.from("shelves").delete().eq("is_demo", true).select("id")) as { id: string }[];
    return rows?.length ?? 0;
  }
}
