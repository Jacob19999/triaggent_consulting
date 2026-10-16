import type { Info } from "./InfoTip";
import { addMonths, monthLabel, workdays } from "@/lib/calendar";
import { PILLARS } from "@/lib/pillars";
import { DEFAULT_WEIGHTS, PRIORITY_PARTS } from "@/lib/priority";
import { EQUITY_SHORT, feiReady, research } from "@/lib/research";

const F = ({ children }: { children: string }) => <code className="rounded bg-surface-2 px-1 text-[11px] text-ink">{children}</code>;

/** Explanations behind every command-center panel: what it is, how it is computed, source. */
export function commandCenterInfo(asOf: string, workspace: "demo" | "live"): Record<string, Info> {
  const end = research.meta.observed_end;
  const target = research.meta.forecast_target;
  const prior = monthLabel(addMonths(end, -12));
  const net = workspace === "demo" ? "each county network (that county's reporting sites summed)" : "each shelf in the live workspace";
  const yoy = `Change = ${monthLabel(end)} ÷ ${prior} − 1. Both months have ${workdays(end)} and ${workdays(addMonths(end, -12))} working days, so the comparison is not a calendar artifact.`;
  return {
    sites: {
      what: "How many food-shelf sites filed a monthly report with the statewide network.",
      how: (
        <>
          Distinct sites with a row in <F>org_FSStats</F> for the month, in the broad universe (brick-and-mortar, outreach/mobile, tribal and campus
          programs, classified on <F>Organization.AgencyType</F>, D-014). Meal programs are excluded. A reporting count is not completeness: late reports
          and lapsed sites are not counted.
        </>
      ),
      source: "outputs/tables/q4_state_month.csv (sites)",
    },
    visits: {
      what: "Visits: one trip by one household. A household that comes twice counts twice; this is not a count of unique people.",
      how: (
        <>
          Sum of <F>HouseholdsReg</F> over reporting sites after the documented keying repairs (D-019, D-030). {yoy}
        </>
      ),
      source: "outputs/tables/q4_state_month.csv (HouseholdsReg)",
    },
    pounds: {
      what: "Weight of food leaving shelves. It reflects supply as well as demand: a shelf can only give what it receives.",
      how: (
        <>
          Sum of <F>PoundsReg</F> over reporting sites. {yoy}
        </>
      ),
      source: "outputs/tables/q4_state_month.csv (PoundsReg)",
    },
    individuals: {
      what: "People in the households that visited, split into children, adults and seniors. People who visit more than once are counted again.",
      how: (
        <>
          Sum of <F>IndividualsReg</F> (= <F>ChildrenReg</F> + <F>AdultsReg</F> + <F>SeniorsReg</F> where all are filled). {yoy}
        </>
      ),
      source: "outputs/tables/q4_state_month.csv (IndividualsReg)",
    },
    forecast: {
      what: `The team's internal planning forecast of statewide visits for ${monthLabel(target, "long")}. It is not an actual: no ${monthLabel(target)} data exists in or was used by the app.`,
      how: (
        <>
          For each of 86 counties: visits per working day in the last three observed months, weighted 1:2:3 toward {monthLabel(end)}, times the{" "}
          {workdays(target)} working days in {monthLabel(target)} (D-045). The tile sums the county points. County 80% bands are not additive, so no
          statewide band is shown.
        </>
      ),
      source: "outputs/forecasts/q7_august2026_state.csv",
    },
    alerts: {
      what: "Open alerts at warning level or above, across shelves, counties and the policy watch. Info-level notes are left out of the count.",
      how: "Fixed rules in the app (no model): missing monthly report, forecast stock or capacity shortfalls, forecast visits 15%+ above the six-month average, turn-aways, Q6 audit-first counties, policy events expected to add pressure. Resolved alerts drop out.",
      source: "src/lib/alerts.ts · workspace reports · research bundle",
    },
    trends: {
      what: "The statewide monthly series for the selected signal, with the internal forecast as the dashed final point.",
      how: (
        <>
          Monthly sums of <F>HouseholdsReg</F>, <F>PoundsReg</F> or <F>IndividualsReg</F> over the broad reporting network. Monthly totals rise and fall
          with the number of working days (elasticity about 0.6), so short months dip without any change in need. Hover a month for its value.
        </>
      ),
      source: "outputs/tables/q4_state_month.csv · outputs/forecasts/q7_august2026_state.csv",
    },
    keyStats: {
      what: "Ratios that show how service is changing, not only how much.",
      how: (
        <>
          Pounds per visit = <F>PoundsReg</F> ÷ <F>HouseholdsReg</F>. Individuals per visit = <F>IndividualsReg</F> ÷ <F>HouseholdsReg</F> (household size
          at the door). Year to date sums January through {monthLabel(end).split(" ")[0]} and compares the same months a year earlier. Peak month is the
          highest of the last 12. Working days are Monday–Friday less six closure holidays. The age bar shares the summed age fields for{" "}
          {monthLabel(asOf)} in this workspace.
        </>
      ),
      source: "outputs/tables/q4_state_month.csv · workspace reports",
    },
    heatmap: {
      what: "Where food went this month by county, or how far residents live from a shelf by census tract, with every reporting site on the map. Click a county or a site for its detail below.",
      how: (
        <>
          <b>Counties</b> · <b>Pounds</b>: <F>PoundsReg</F> for {net} in {monthLabel(asOf)}. <b>Per resident</b>: that ÷ ACS 2020–2024 county
          population. <b>vs last year</b>: % change on the same month a year earlier, colours capped at ±50%. With one type chip selected, the colour is
          that type&apos;s <F>PoundsReg</F>. <b>Census tracts</b> · mean straight-line miles from 2020 block points to the nearest reporting shelf, the share
          of residents beyond 10 miles (D-051), or the tract FEI; pounds are reported per site and summed per county, so they have no tract view. Colour
          scales trim the 2% tails. <b>Sites</b>: each site that reported in {monthLabel(end)} at its researched coordinates (D-063), icon and colour by{" "}
          <F>Organization.AgencyType</F>. Solid icons sit on a street address; hollow dashed icons mark only a city or ZIP centre. Sites without
          coordinates are counted under the map. Below zoom 8 icons shrink to dots. The map shows location and type only, never a site&apos;s own activity.
        </>
      ),
      source: "outputs/tables/county_network_month.csv · county_site_types.csv · public/data/sites.json (D-063) · FEI tracts · ACS 5-year",
    },
    centers: {
      what: "The kinds of centers that report to the network, and how much of the work each kind does.",
      how: (
        <>
          Reporting sites in {monthLabel(end)} counted by <F>Organization.AgencyType</F>; the counts add up to each county network&apos;s site count. Visits
          sum <F>HouseholdsReg</F>; share of pounds is each type&apos;s <F>PoundsReg</F> over the total from sites that reported pounds (some campus programs
          leave it blank). Outreach includes mobile distributions. Click a row to filter the map&apos;s sites and colours; click a county in the list to open its detail.
        </>
      ),
      source: "outputs/tables/county_site_types.csv (uv run python -m mi.county_networks)",
    },
    countyDetail: {
      what: "One county's food-shelf activity: the last 24 months, change on a year earlier, its sites by type, need and access context, alerts and requests.",
      how: (
        <>
          Monthly <F>HouseholdsReg</F>, <F>PoundsReg</F> and <F>IndividualsReg</F> summed over the county&apos;s reporting sites. Year-over-year bars =
          month ÷ same month a year earlier − 1 (green up, red down). Sites by type compare {monthLabel(end)} with {prior}: counts, visits and pounds per{" "}
          <F>Organization.AgencyType</F>; a type&apos;s change mixes real change with sites opening, closing or not reporting. Pounds per visit ={" "}
          <F>PoundsReg</F> ÷ <F>HouseholdsReg</F>. The {monthLabel(target)} visit forecast is the county&apos;s D-045 run rate with its 80% band. Individual
          sites&apos; own visits and pounds are not published; the map shows their location and type only (D-063).
        </>
      ),
      source: "outputs/tables/county_network_month.csv · county_site_types.csv · outputs/forecasts · ACS · USDA RUCC/LILA · FEI build",
    },
    alertList: {
      what: "The shelf and county alerts to act on first, most severe first. Policy alerts are in the policy watch below.",
      how: "Each alert carries the numbers that triggered it and a next step. Severity: critical (stock may run out), serious (short if demand runs high, visits +30%, over capacity), warning (missing report, visits +15%, Q6 audit-first county), info (context such as LILA tracts with no reporting shelf). Open the alert center to acknowledge or resolve.",
      source: "src/lib/alerts.ts",
    },
    priority: {
      what: "Shelves ranked by a transparent score for where to look first. A manager's status override always sorts first; the score never moves food on its own.",
      how: (
        <>
          Score 0–100 = weighted sum of five parts, each scaled 0–1:{" "}
          {PRIORITY_PARTS.map((p) => `${p.label} ${DEFAULT_WEIGHTS[p.key]}% (${p.help})`).join(" ")}
          {workspace === "demo" ? " County networks carry no stock or capacity, so those parts score 0 here." : ""}
        </>
      ),
      source: "src/lib/priority.ts",
    },
    fei: {
      what: feiReady
        ? `The Food Access Equity Index: where residents face the most barriers between need and the food-shelf network. A screening index for where to look, not a count of unmet people, and not causal.`
        : `${EQUITY_SHORT}: the Q6 need percentile, shown until the FEI tables are built.`,
      how: feiReady ? (
        <>
          FEI = 100 × ({PILLARS.map((p) => `${p.weight}·${p.key}`).join(" + ")}); each pillar 0–1, higher = more barriers.{" "}
          {PILLARS.map((p) => `${p.key} ${p.label}: ${p.what}`).join(" ")} Dashed outlines mark Q6 audit-first counties, a call list for local checks.
        </>
      ) : (
        "Percentile of a need score built from poverty, car access and food insecurity, with no activity data."
      ),
      source: feiReady ? "outputs/tables/fei_counties.csv · fei-tracts.json" : "outputs/tables/q6_need_index.csv",
    },
    policy: {
      what: "Policy changes ranked by how much they may change pressure on Minnesota food shelves, with what to watch and what to do this week.",
      how: (
        <>
          <b>Tracked timeline</b>: dated events from primary sources, rated by rule (high = Minnesota food-benefit or supply change not expected to ease
          pressure; medium = expected to add pressure or Minnesota-specific; low = context). <b>Scan the web</b>: Google Gemini runs its own Google
          searches and rates each change on a fixed rubric; it may not estimate visits or pounds, and any item quoting food-shelf activity after{" "}
          {monthLabel(end)} is withheld. Results are cached for 30 minutes on the server and in this browser. Verify each item at its source.
        </>
      ),
      source: "docs/reference/policy_events.csv · /api/policy-watch (Gemini + Google Search)",
    },
    requests: {
      what: "Requests shelves raised for food, volunteers, funding, transport or equipment, with their status.",
      how:
        workspace === "demo"
          ? "In the county networks workspace these are hypothetical examples written by rule from real county totals, using three-month windows with the same site count and no blank fields: visit growth with falling pounds per visit (pounds asked = one month of visits × the drop in pounds per visit), the most remote rural county, the summer jump in children served, sustained visit or pounds growth, the highest senior share, a Q6 audit-first county, and blank report fields. No shelf sent them."
          : "Raised in the shelf portal; replies and status set in the inbox are visible to the shelf.",
      source: workspace === "demo" ? "src/lib/hypotheticalRequests.ts · county_network_month.csv" : "Supabase shelf_requests",
    },
  };
}
