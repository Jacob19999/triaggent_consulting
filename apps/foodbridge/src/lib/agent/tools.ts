// Read-only retrieval tools for the FoodBridge briefing agent. Every value returned is
// read from the research bundle or from the caller's own operations snapshot, with the
// field name and source file attached. The model explains and retrieves; it never
// computes a figure (CLAUDE.md "AI in the app explains and retrieves").

import { z } from "zod";
import { addMonths } from "../calendar";
import { PILLARS } from "../pillars";
import { countiesByFips, feiReady, research, SIGNAL_FIELD } from "../research";
import type { County, ForecastSignal } from "../types";

export const AlertLite = z.object({
  severity: z.enum(["critical", "serious", "warning", "info"]),
  scope: z.enum(["shelf", "county", "network"]),
  category: z.string().max(40),
  title: z.string().max(300),
  detail: z.string().max(1200),
  action: z.string().max(600),
  where: z.string().max(160).optional(),
  status: z.string().max(20).optional(),
  source: z.string().max(400),
});

export const Snapshot = z.object({
  workspace: z.enum(["demo", "live"]),
  asOf: z.string().regex(/^\d{4}-\d{2}$/),
  network: z
    .object({
      shelves: z.number().int().min(0).max(100000),
      reporting: z.number().int().min(0).max(100000),
      visits: z.number().min(0).max(1e9),
      pounds: z.number().min(0).max(1e10),
      individuals: z.number().min(0).max(1e9),
      forecastVisits: z.number().min(0).max(1e9),
      forecastVisitsLo80: z.number().min(0).max(1e9),
      forecastVisitsHi80: z.number().min(0).max(1e9),
      openRequests: z.number().int().min(0).max(100000),
    })
    .optional(),
  alerts: z.array(AlertLite).max(80).default([]),
  shelf: z
    .object({
      name: z.string().max(160),
      county: z.string().max(80),
      type: z.string().max(40),
      lastMonth: z.string().max(10).nullable(),
      lastVisits: z.number().nullable(),
      lastPounds: z.number().nullable(),
      inventory: z.number().nullable(),
      forecastMonth: z.string().max(10),
      forecastVisits: z.number().nullable(),
      forecastVisitsBand: z.string().max(40).nullable(),
      forecastPounds: z.number().nullable(),
      forecastPoundsBand: z.string().max(40).nullable(),
      capacity: z.number().nullable(),
    })
    .optional(),
});
export type SnapshotT = z.infer<typeof Snapshot>;

const round = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

function findCounty(q: string): County | null {
  const s = q.trim().toLowerCase().replace(/ county$/, "");
  return countiesByFips[q] ?? research.counties.find((c) => c.name.toLowerCase() === s) ?? null;
}

function forecastOf(c: County) {
  const out: Record<string, unknown> = {};
  (["HouseholdsTotal", "PoundsTotal", "IndividualsTotal", "ChildrenTotal", "AdultsTotal", "SeniorsTotal"] as ForecastSignal[]).forEach((f) => {
    const cell = c.forecast[f];
    out[SIGNAL_FIELD[f]] = cell?.yhat == null ? null : { point: round(cell.yhat), band80: [round(cell.lo80), round(cell.hi80)] };
  });
  return out;
}

export const TOOL_DEFS = [
  {
    name: "get_policy_events",
    description:
      "Dated Minnesota and federal policy events (SNAP, TEFAP, school meals, Summer EBT, health coverage, shutdowns) from primary sources, with expected direction for food-shelf demand and the source URL. Filter by program and month range.",
    input_schema: {
      type: "object" as const,
      properties: {
        program: { type: "string", description: "Optional program filter, e.g. SNAP, TEFAP, Summer EBT, School meals" },
        from: { type: "string", description: "Earliest effective month, YYYY-MM" },
        to: { type: "string", description: "Latest effective month, YYYY-MM" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_county_profile",
    description:
      "One county's research profile: FEI and pillars (if built), Q6 need percentile and flags, August 2026 forecast for six fields with 80% bands, 2024 activity, distance to the nearest reporting shelf, LILA tracts, poverty and vehicle access. Each value names its field and source file.",
    input_schema: {
      type: "object" as const,
      properties: { county: { type: "string", description: "County name (e.g. Chippewa) or 5-digit FIPS" } },
      required: ["county"],
      additionalProperties: false,
    },
  },
  {
    name: "list_counties",
    description: "Top Minnesota counties by a research measure, highest first.",
    input_schema: {
      type: "object" as const,
      properties: {
        sort_by: {
          type: "string",
          enum: ["fei", "need_percentile", "minimum_gap", "lila_without_site", "share_beyond_10", "mean_miles", "forecast_visits"],
        },
        limit: { type: "integer", minimum: 1, maximum: 15 },
      },
      required: ["sort_by"],
      additionalProperties: false,
    },
  },
  {
    name: "get_alerts",
    description:
      "Current FoodBridge alerts from the caller's workspace (shelf forecast and report rules, county equity flags, policy watch). Filter by scope or minimum severity.",
    input_schema: {
      type: "object" as const,
      properties: {
        scope: { type: "string", enum: ["shelf", "county", "network"] },
        min_severity: { type: "string", enum: ["critical", "serious", "warning", "info"] },
        where: { type: "string", description: "Optional county or shelf name to match" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_network_summary",
    description:
      "The caller's network this month (shelves reporting, visits, pounds, forecast for next month), plus the statewide research history for the last six observed months and the August 2026 statewide forecast.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "get_research_finding",
    description: "The team's generated answer to a graduate question (Q1 need vs activity, Q4 prices, Q5 SNAP, Q6 need measure, Q7 forecast, Q8 LILA reach), with key statistics.",
    input_schema: {
      type: "object" as const,
      properties: { question: { type: "string", enum: ["q1", "q4", "q5", "q6", "q7", "q8"] } },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "get_fei_method",
    description: "How the Food Access Equity Index is defined (pillars, weights) and its validation checks.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "get_shelf_status",
    description: "For the shelf portal: the caller's shelf, its latest report and its next-month forecast with bands.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
];

const SEV = ["critical", "serious", "warning", "info"];

export function runTool(name: string, input: Record<string, unknown>, snap: SnapshotT): unknown {
  switch (name) {
    case "get_policy_events": {
      const program = typeof input.program === "string" ? input.program.toLowerCase() : null;
      const from = typeof input.from === "string" ? input.from : addMonths(snap.asOf, -12);
      const to = typeof input.to === "string" ? input.to : addMonths(snap.asOf, 6);
      const events = research.policy
        .filter((e) => (!program || e.program.toLowerCase().includes(program)) && e.start.slice(0, 7) >= from && e.start.slice(0, 7) <= to)
        .map((e) => ({
          name: e.name,
          program: e.program,
          level: e.level,
          effective: e.start,
          ends: e.end,
          announced: e.announced,
          affected: e.affected,
          expected_direction: e.direction,
          notes: e.notes,
          source: `${e.publisher}: ${e.source}`,
          url: e.url,
        }));
      return {
        file: "docs/reference/policy_events.csv",
        window: { from, to },
        caution:
          "Q5 found SNAP episodes coincided with activity swings that could not be attributed to the policy (D-053). Say 'coincided with', never 'caused'.",
        events,
      };
    }
    case "get_county_profile": {
      const c = findCounty(String(input.county ?? ""));
      if (!c) return { error: `No Minnesota county matches "${String(input.county)}".` };
      return {
        county: c.name,
        fips: c.fips,
        metro: !c.nonmetro,
        fei: feiReady && c.fei
          ? {
              fei: round(c.fei.fei, 1),
              rank_of_87: c.fei.rank,
              quintile: c.fei.quintile,
              pillars: Object.fromEntries(PILLARS.map((p) => [p.label, round(c.fei?.[p.key] as number, 2)])),
              lbs_per_lowinc_resident_within_reach: round(c.fei.lbs_per_lowinc, 0),
              residents_beyond_threshold: round(c.fei.beyond_residents),
              stable_high: c.fei.stable_high,
              file: "outputs/tables/fei_counties.csv",
            }
          : "FEI not built in this deployment",
        q6: {
          need_percentile: round(c.need_percentile, 0),
          minimum_gap_points: round(c.minimum_gap, 0),
          review_flag: c.review,
          audit_first_robust: c.robust,
          note: "Q6 flags are an audit call list for local checks, never proof of unmet need (D-052).",
          file: "outputs/tables/q6_need_index.csv, q6_robust_set.csv",
        },
        august_2026_forecast: {
          ...forecastOf(c),
          label: "Internal forecast (D-045), not an actual. Historical 80% bands undercovered.",
          file: "outputs/forecasts/q7_august2026_wide.csv",
        },
        activity_2024: {
          HouseholdsReg: c.annual2024.HouseholdsTotal,
          PoundsReg: c.annual2024.PoundsTotal,
          IndividualsReg: c.annual2024.IndividualsTotal,
          reporting_shelves: c.sites_2024,
          file: "outputs/tables/q1_county_concentration.csv",
        },
        access: {
          miles_to_nearest_reporting_shelf: round(c.mean_miles, 1),
          share_beyond_10_miles: round(c.share_beyond_10, 3),
          lila_tracts: c.lila_tracts,
          lila_tracts_without_reporting_shelf: c.lila_without_site,
          caution: "Distance is to the nearest reporting shelf, straight line; a local shelf outside the network makes a place look farther.",
          file: "outputs/tables/distance_counties_2024.csv, q8_county_footprint_gaps.csv",
        },
        need_signals: {
          residents: c.population,
          below_200pct_poverty_share: round(c.below_200_share, 3),
          persons_below_poverty: c.poverty_persons,
          no_vehicle_household_share: round(c.no_vehicle_share, 3),
          file: "outputs/tables/acs_need_signals_2024.csv (ACS 2020–2024)",
        },
      };
    }
    case "list_counties": {
      const key = String(input.sort_by);
      const limit = Math.min(15, Math.max(1, Number(input.limit ?? 10)));
      const get = (c: County): number | null =>
        key === "fei"
          ? (c.fei?.fei ?? null)
          : key === "need_percentile"
            ? c.need_percentile
            : key === "minimum_gap"
              ? c.minimum_gap
              : key === "lila_without_site"
                ? c.lila_without_site
                : key === "share_beyond_10"
                  ? c.share_beyond_10
                  : key === "mean_miles"
                    ? c.mean_miles
                    : (c.forecast.HouseholdsTotal?.yhat ?? null);
      return {
        sort_by: key,
        rows: research.counties
          .filter((c) => get(c) != null)
          .sort((a, b) => (get(b) ?? 0) - (get(a) ?? 0))
          .slice(0, limit)
          .map((c) => ({ county: c.name, value: round(get(c), 2), q6_audit_first: c.robust })),
      };
    }
    case "get_alerts": {
      const min = SEV.indexOf(String(input.min_severity ?? "info"));
      const where = typeof input.where === "string" ? input.where.toLowerCase() : null;
      return {
        workspace: snap.workspace,
        note: snap.workspace === "demo" ? "Demo workspace: shelves are synthetic, scaled from county aggregates." : undefined,
        alerts: snap.alerts.filter(
          (a) =>
            (!input.scope || a.scope === input.scope) &&
            SEV.indexOf(a.severity) <= (min < 0 ? 3 : min) &&
            (!where || (a.where ?? "").toLowerCase().includes(where) || a.title.toLowerCase().includes(where)),
        ),
      };
    }
    case "get_network_summary": {
      const last = research.history.slice(-6).map((h) => ({
        month: h.month,
        HouseholdsReg: h.HouseholdsTotal,
        PoundsReg: h.PoundsTotal,
        IndividualsReg: h.IndividualsTotal,
        reporting_sites: h.sites,
      }));
      return {
        workspace: snap.workspace,
        as_of: snap.asOf,
        this_network: snap.network ?? "not provided",
        statewide_history: { rows: last, file: "outputs/tables/q4_state_month.csv" },
        statewide_august_2026_forecast: {
          rows: research.findings.stats.q7_state.map((r) => ({ field: SIGNAL_FIELD[r.signal], point: r.yhat, counties: r.counties })),
          label: "Sum of county internal forecasts, not an actual.",
          file: "outputs/forecasts/q7_august2026_state.csv",
        },
      };
    }
    case "get_research_finding": {
      const q = String(input.question);
      const section = research.findings.sections.find((s) => s.id === q);
      const st = research.findings.stats;
      const stats =
        q === "q1"
          ? { rate_correlations_2024: st.q1_rate, count_correlations_2024: st.q1_count }
          : q === "q4"
            ? { price_models: st.q4 }
            : q === "q5"
              ? { snap_coefficients: st.q5, month_ranks: st.q5_noise }
              : q === "q6"
                ? { checks: st.q6_checks, review_counties: st.q6_review, audit_first: st.q6_robust }
                : q === "q7"
                  ? { statewide_forecast: st.q7_state, interval_coverage: st.q7_intervals }
                  : { lila: { tracts: st.q8.lila_tracts, without_site: st.q8.lila_without_site }, strata: st.q8.strata };
      return { question: q, title: section?.title, answer: section?.lead, stats, file: "outputs/tables/research_answers.md" };
    }
    case "get_fei_method": {
      const meta = research.fei.meta ?? {};
      return feiReady
        ? {
            formula: "FEI = 100 × (0.25·N + 0.25·S + 0.20·T + 0.15·M + 0.15·V), higher = more barriers",
            pillars: PILLARS.map((p) => ({ key: p.key, label: p.label, weight: p.weight, definition: p.what })),
            validation: meta.fei_validation,
            kpis: meta.kpis,
            caution: "A screening index for where to look and where siting may help; not a count of unmet people, not causal.",
            file: "outputs/tables/fei_counties.csv, fei_validation.csv",
          }
        : { status: "FEI not built in this deployment (task A4)." };
    }
    case "get_shelf_status":
      return snap.shelf ?? { error: "No shelf context was provided." };
    default:
      return { error: `Unknown tool ${name}` };
  }
}
