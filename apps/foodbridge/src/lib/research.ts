import raw from "@data/research.json";
import type { County, ForecastSignal, ResearchBundle, Signal } from "./types";

/** The research bundle (aggregates only). Rebuild with `uv run python -m mi.foodbridge_bundle`. */
export const research = raw as unknown as ResearchBundle;

export const countiesByFips: Record<string, County> = Object.fromEntries(
  research.counties.map((c) => [c.fips, c]),
);

export const SIGNALS: Signal[] = ["HouseholdsTotal", "PoundsTotal", "IndividualsTotal"];

export const SIGNAL_LABEL: Record<ForecastSignal, string> = {
  HouseholdsTotal: "Visits",
  PoundsTotal: "Pounds distributed",
  IndividualsTotal: "Individuals served",
  ChildrenTotal: "Children",
  AdultsTotal: "Adults",
  SeniorsTotal: "Seniors",
};

/** Sponsor field names (D-039): name the *Reg field in every method note. */
export const SIGNAL_FIELD: Record<ForecastSignal, string> = {
  HouseholdsTotal: "HouseholdsReg",
  PoundsTotal: "PoundsReg",
  IndividualsTotal: "IndividualsReg",
  ChildrenTotal: "ChildrenReg",
  AdultsTotal: "AdultsReg",
  SeniorsTotal: "SeniorsReg",
};

export const feiReady = research.fei.status === "ready";

export function countyName(fips: string): string {
  return countiesByFips[fips]?.name ?? fips;
}

/** Screening value used on maps and rankings: FEI when A4's build is present, otherwise
 * the Q6 need percentile, labelled as a placeholder (never called FEI). */
export function equityValue(c: County): number | null {
  if (feiReady) return c.fei?.fei ?? null;
  return c.need_percentile;
}

export const EQUITY_LABEL = feiReady
  ? "Food Access Equity Index (FEI)"
  : "Q6 need percentile (placeholder until FEI lands)";

export const EQUITY_SHORT = feiReady ? "FEI" : "Need screen";

export const RESEARCH_SNAPSHOT = `Research snapshot · observed to ${research.meta.observed_end}`;
