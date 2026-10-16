import { Stat, SourceNote } from "@/components/ui";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { research } from "@/lib/research";

/** Observed reporting and the published Q7 forecast share one fixed research cutoff.
 * Read these from the research bundle, not from the browser's editable workspace copy.
 */
export function ResearchReportingStats() {
  const observed = research.history.find((row) => row.month === research.meta.observed_end);
  const forecast = research.findings.stats.q7_state.find((row) => row.signal === "HouseholdsTotal");
  return (
    <section aria-label="Actual network reporting and published forecast" className="mb-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          icon="store"
          label="Shelves reporting"
          value={fmt.int(observed?.sites)}
          sub={`${monthLabel(research.meta.observed_end)} · observed reporting network`}
        />
        <Stat
          icon="users"
          accent="var(--sig-households)"
          label={`Visits · ${monthLabel(research.meta.observed_end)}`}
          value={fmt.int(observed?.HouseholdsTotal)}
          sub={`${fmt.int(observed?.PoundsTotal)} lb distributed · ${fmt.int(observed?.IndividualsTotal)} individuals served`}
        />
        <Stat
          icon="history"
          accent="var(--seq-3)"
          label={`Visits · ${monthLabel(research.meta.forecast_target)}`}
          tone="forecast"
          value={fmt.int(forecast?.yhat)}
          sub="Published Q7 county forecasts · D-045"
        />
      </div>
      <SourceNote>
        Historical planning snapshot · food_shelf_broad, county-assigned records.
        Observed HouseholdsReg, PoundsReg and IndividualsReg: outputs/tables/q4_state_month.csv.
        Forecast: outputs/forecasts/q7_august2026_state.csv. Reporting counts do not measure completeness;
        August 2026 is forecast only.
      </SourceNote>
    </section>
  );
}
