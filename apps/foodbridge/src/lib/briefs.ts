// Shared AI briefings. The generated markdown is stored; the operations snapshot is not.
// Every approved account can read every row (see supabase/migrations/0002_briefs.sql).

import { monthLabel } from "./calendar";

export type BriefMode = "briefing" | "county" | "shelf" | "ask";
export type BriefResultMode = "ai" | "offline";

export interface BriefSummary {
  id: string;
  title: string;
  mode: BriefMode;
  result_mode: BriefResultMode;
  county: string | null;
  as_of: string;
  workspace: "demo" | "live";
  author_email: string | null;
  model: string | null;
  created_at: string;
}

export interface BriefDetail extends BriefSummary {
  question: string | null;
  markdown: string;
  note: string | null;
  tool_calls: { name: string; input: unknown }[];
}

export const BRIEF_LIST_COLUMNS =
  "id, title, mode, result_mode, county, as_of, workspace, author_email, model, created_at";
export const BRIEF_DETAIL_COLUMNS = `${BRIEF_LIST_COLUMNS}, question, markdown, note, tool_calls`;

const MAX_MARKDOWN = 80_000;

export function isApprovedRole(role: string | null | undefined): role is "manager" | "shelf" {
  return role === "manager" || role === "shelf";
}

function clip(value: string, max: number): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function briefTitle(mode: BriefMode, asOf: string, county?: string | null, question?: string | null, shelfName?: string | null): string {
  const when = monthLabel(asOf, "long");
  if (mode === "county") return clip(`${county?.trim() || "County"} · ${when}`, 200);
  if (mode === "shelf") return clip(`${shelfName?.trim() || "Shelf"} · ${when}`, 200);
  if (mode === "ask") return clip(question?.trim() || `Question · ${when}`, 200);
  return clip(`Weekly briefing · ${when}`, 200);
}

export interface BriefDraft {
  mode: BriefMode;
  resultMode: BriefResultMode;
  asOf: string;
  workspace: "demo" | "live";
  markdown: string;
  county?: string | null;
  question?: string | null;
  shelfName?: string | null;
  model?: string | null;
  note?: string | null;
  toolCalls?: { name: string; input: unknown }[];
}

/** Row for insert. Author columns are left to the database trigger. Returns null when there is nothing to keep. */
export function briefRow(draft: BriefDraft): Record<string, unknown> | null {
  const markdown = draft.markdown.trim();
  if (!markdown || markdown.length > MAX_MARKDOWN) return null;
  if (!/^\d{4}-\d{2}$/.test(draft.asOf)) return null;
  const calls = (draft.toolCalls ?? []).slice(0, 40).map((call) => ({
    name: String(call.name).slice(0, 80),
    input: call.input ?? {},
  }));
  const tool_calls = JSON.stringify(calls).length > 20_000 ? calls.map((call) => ({ name: call.name, input: {} })) : calls;
  return {
    mode: draft.mode,
    result_mode: draft.resultMode,
    title: briefTitle(draft.mode, draft.asOf, draft.county, draft.question, draft.shelfName),
    county: draft.county?.trim() ? clip(draft.county, 60) : null,
    question: draft.question?.trim() ? draft.question.trim().slice(0, 2000) : null,
    as_of: draft.asOf,
    workspace: draft.workspace,
    markdown,
    model: draft.model?.trim() ? clip(draft.model, 80) : null,
    note: draft.note?.trim() ? draft.note.trim().slice(0, 500) : null,
    tool_calls,
  };
}

export const BRIEF_SAVED_EVENT = "foodbridge:brief-saved";
