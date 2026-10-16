// Impact-driven policy watch: shared shapes for the curated timeline (rule-based impact)
// and the live web scan (Gemini with Google Search, /api/policy-watch).

import { z } from "zod";
import { addMonths } from "./calendar";
import type { PolicyEvent } from "./types";

export const SIGNAL_FIELDS = ["HouseholdsReg", "PoundsReg", "IndividualsReg", "ChildrenReg", "SeniorsReg", "AdultsReg"] as const;
export type Impact = "high" | "medium" | "low";
export type Pressure = "up" | "down" | "mixed" | "unclear";

// Model JSON is untrusted: unknown values fall back, long strings are cut, bad URLs dropped.
const loose = <T extends z.ZodType>(schema: T, fallback: z.output<T>) => schema.catch(fallback);
const text = (max: number) => z.string().transform((s) => s.trim().slice(0, max));
const Source = z.object({
  title: loose(text(300), ""),
  publisher: loose(text(120), ""),
  url: z.url({ protocol: /^https?$/ }),
  date: loose(text(20).nullable(), null),
  kind: loose(z.enum(["primary", "news", "analysis"]), "news"),
});

export const WebPolicyItem = z.object({
  title: text(200),
  program: loose(text(60), "Other"),
  level: loose(text(20), "unknown"),
  status: loose(text(20), "unknown"),
  effective: loose(text(20).nullable(), null),
  announced: loose(text(20).nullable(), null),
  what_changes: loose(text(800), ""),
  who_in_mn: loose(text(500), ""),
  demand_pressure: loose(z.enum(["up", "down", "mixed", "unclear"]), "unclear"),
  supply_effect: loose(z.enum(["up", "down", "none", "unclear"]), "unclear"),
  impact: loose(z.enum(["high", "medium", "low"]), "low"),
  impact_reason: loose(text(500), ""),
  signals: loose(z.array(z.enum(SIGNAL_FIELDS)).max(6), []),
  where: loose(text(200), ""),
  watch_window: loose(text(300), ""),
  action: loose(text(500), ""),
  tracked_id: loose(text(80).nullable(), null),
  confidence: loose(z.enum(["high", "medium", "low"]), "low"),
  sources: loose(z.array(z.unknown()), []).transform((list) =>
    list.flatMap((s) => {
      const r = Source.safeParse(s);
      return r.success ? [r.data] : [];
    }).slice(0, 6),
  ),
});
export type WebPolicyItem = z.infer<typeof WebPolicyItem>;

export interface WebPolicyScan {
  mode: "ai" | "offline";
  fetchedAt: string;
  model?: string;
  summary?: string;
  items: WebPolicyItem[];
  /** Pages Google Search returned to the model (grounding metadata), for verification. */
  searched: { title: string; url: string }[];
  queries: string[];
  dropped?: number;
  note?: string;
  error?: string;
}

const IMPACT_ORDER: Record<Impact, number> = { high: 0, medium: 1, low: 2 };

// D-002: a web page may quote food-shelf activity for August 2026 or later. Such figures
// are outcome data and must never be displayed, so any item that pairs an activity word
// with a post-July-2026 month is dropped whole.
const ACTIVITY = /\b(visits?|households served|individuals served|people served|pounds (distributed|of food)|food[- ]shelf (use|traffic|visits))\b/i;
const LATE_MONTH = /\b(aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?\s+(of\s+)?2026\b|\b2026-(0[89]|1[0-2])\b|\b20(2[7-9])\b/gi;
export function leaksOutcome(item: WebPolicyItem): boolean {
  const body = [item.title, item.what_changes, item.who_in_mn, item.impact_reason, item.action].join(" ");
  const late = body.match(LATE_MONTH);
  return ACTIVITY.test(body) && !!late && /\d/.test(body.replace(LATE_MONTH, ""));
}

/** Pull the JSON object out of a fenced or bare model reply; null if none parses. */
export function parseScan(raw: string): { summary: string; items: WebPolicyItem[]; dropped: number } | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  const body = z.object({ summary: loose(text(600), ""), items: z.array(z.unknown()).max(12) }).safeParse(parsed);
  if (!body.success) return null;
  const items = body.data.items.flatMap((i) => {
    const r = WebPolicyItem.safeParse(i);
    return r.success ? [r.data] : [];
  });
  const kept = items.filter((i) => !leaksOutcome(i));
  kept.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || (b.effective ?? "").localeCompare(a.effective ?? ""));
  return { summary: body.data.summary, items: kept, dropped: items.length - kept.length };
}

// ---------- Curated timeline: rule-based impact ----------

const PROGRAM_SIGNALS: Record<string, (typeof SIGNAL_FIELDS)[number][]> = {
  SNAP: ["HouseholdsReg", "IndividualsReg"],
  TEFAP: ["PoundsReg"],
  "Emergency food support": ["PoundsReg", "HouseholdsReg"],
  "School meals": ["ChildrenReg"],
  "Summer EBT": ["ChildrenReg"],
  "Child Tax Credit": ["ChildrenReg", "HouseholdsReg"],
  "Health coverage": ["SeniorsReg", "AdultsReg"],
  "Government funding": ["HouseholdsReg"],
  "Immigration enforcement": ["HouseholdsReg", "IndividualsReg"],
};
const FOOD_PROGRAMS = new Set(["SNAP", "TEFAP", "Emergency food support", "Summer EBT", "School meals"]);

export interface RatedEvent {
  event: PolicyEvent;
  pressure: Pressure;
  impact: Impact;
  signals: string[];
  timing: "upcoming" | "recent" | "earlier";
}

/** Rule-based rating so the curated list sorts by impact without a model:
 * high = Minnesota food-benefit or supply change not expected to ease pressure; medium =
 * expected to add pressure, or Minnesota-specific; low = context. */
export function rateEvent(e: PolicyEvent, asOf: string): RatedEvent {
  const d = e.direction.trim();
  const pressure: Pressure = d.startsWith("+") ? "up" : d.startsWith("-") || d.startsWith("−") ? "down" : d.startsWith("ambiguous") ? "mixed" : "unclear";
  const impact: Impact = e.mn && FOOD_PROGRAMS.has(e.program) && pressure !== "down" ? "high" : pressure === "up" || e.mn ? "medium" : "low";
  const month = e.start.slice(0, 7);
  const timing = month > asOf ? "upcoming" : month >= addMonths(asOf, -3) ? "recent" : "earlier";
  return { event: e, pressure, impact, signals: PROGRAM_SIGNALS[e.program] ?? ["HouseholdsReg"], timing };
}

export function rateTimeline(events: PolicyEvent[], asOf: string): RatedEvent[] {
  return events
    .map((e) => rateEvent(e, asOf))
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || b.event.start.localeCompare(a.event.start));
}
