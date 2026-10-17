// Run sheet for the 17 October judging talk (D-066): who speaks, for how long, which scored
// question each slide answers and which workspace page holds its full visual. The page in
// src/app/present renders these slides; tests/presentation.test.ts keeps the budget honest.
// Story order: the business problem, our need measure (Q6), then each scored question,
// the forecast (Q7), the tool and the Monday actions. Step labels name the sub-question
// each build answers, so a judge can tick the rubric off the screen.

import { addMonths, workdays } from "./calendar";
import { research } from "./research";
import type { ForecastSignal } from "./types";

export type Speaker = "Jacob" | "Daniela" | "Biruk" | "Roshit";
export type Question = "Q1" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8";

export interface SlideMeta {
  id: string;
  speakers: Speaker[];
  /** Spoken seconds; judges stop the whole session at 10 minutes (Zoom 5). */
  seconds: number;
  questions: Question[];
  /** Section shown in the progress bar. */
  part: "Problem" | "Need" | "Findings" | "Forecast" | "Demo" | "Close" | "Appendix";
  /** Build steps: → reveals each overlay in turn before the next slide. */
  steps?: string[];
  /** Workspace page with the full, interactive version of the slide's visual. */
  workspace?: { href: string; label: string };
  /** Cue lines, not a script: say the first one, point at the number in the second. */
  notes: string[];
  /** Files behind every number on the slide. */
  files: string[];
  appendix?: boolean;
}

export const SPEAKER_COLOR: Record<Speaker, string> = {
  Jacob: "var(--sig-households)",
  Daniela: "var(--p-n)",
  Biruk: "var(--sig-pounds)",
  Roshit: "var(--p-m)",
};

export const SLIDES: SlideMeta[] = [
  {
    id: "title",
    speakers: ["Jacob"],
    seconds: 15,
    questions: [],
    part: "Problem",
    notes: [
      "The Food Group allocates by visits. Visits are demand, not need.",
      "Point at the bars: nationally 27.7% of working-age adults are food insecure, 16.7% got charitable food, and 3 in 10 in food-insecure households went without help they needed.",
      "Today: where need and demand split in Minnesota, why, and what to change on Monday.",
    ],
    files: ["docs/sources/catalog.md rows 63–64 (Urban Institute WBNS, December 2025)"],
  },
  {
    id: "fei",
    speakers: ["Jacob"],
    seconds: 30,
    questions: ["Q6"],
    part: "Need",
    steps: ["Need", "Supply", "Travel", "Mobility", "Demographics", "Need × access = FEI"],
    workspace: { href: "/manager/fei", label: "Equity index (FEI)" },
    notes: [
      "Press → through the five barriers: each one recolors every census tract. Red = more of that barrier.",
      "Last step: need (N, V) and access (S, T, M) multiply into one 0–100 score, the Food Access Equity Index, so a tract is high only where need and access barriers are both high. No visit counts go in, so it can disagree with demand.",
      "Point at: 2.7 million Minnesotans live beyond easy reach of a reporting shelf.",
      "Hand-off: “Daniela will show you where it is worst.”",
    ],
    files: ["outputs/tables/fei_tracts.csv", "outputs/tables/fei_counties.csv", "fei_meta.json (kpis)"],
  },
  {
    id: "fei-map",
    speakers: ["Daniela"],
    seconds: 30,
    questions: ["Q6"],
    part: "Need",
    steps: ["Barrier score", "+ Food shelves", "Highest-barrier fifth"],
    workspace: { href: "/manager/fei", label: "Equity index map" },
    notes: [
      "Step 1: red tracts have the most barriers, in the rural west and north, not the metro.",
      "Step 2: each icon is a food shelf reporting in July. They sit where people are; the reddest tracts have few.",
      "Step 3: 1.06 million residents, 250,000 of them children, live in the highest-barrier fifth.",
      "If asked “is it need?”: it rises with SNAP use (0.59) and Feeding America's estimate (0.85), and neither is an input.",
      "Bridge: “So how would we know this score is wrong?”",
    ],
    files: ["outputs/tables/fei_tracts.csv", "outputs/tables/fei_validation.csv", "apps/foodbridge/public/data/sites.json"],
  },
  {
    id: "q6",
    speakers: ["Daniela"],
    seconds: 25,
    questions: ["Q6"],
    part: "Need",
    steps: ["1–2 Definition · why need", "3–4 Reject · revise"],
    workspace: { href: "/manager/fei", label: "Equity index (FEI)" },
    notes: [
      "1: need is a household without reliable food, whether or not it asks. 2: built only from public hardship data; visits, pounds and people served never go in.",
      "→ 3: reject it if a survey of non-users finds no more hardship in high-score counties. That survey is not run yet. 4: revise if one input or the Feeding America edition moves a county by a fifth.",
      "Checks run now: it rises with SNAP use (passed); with poverty held fixed, only just.",
      "Bridge: “Now, does today's demand follow need?”",
    ],
    files: ["docs/reference/q6_addendum.md", "outputs/tables/q6_falsification_checks.csv"],
  },
  {
    id: "q1",
    speakers: ["Daniela"],
    seconds: 30,
    questions: ["Q1"],
    part: "Findings",
    steps: ["Which measure tracks need?", "Per resident?", "Which counties break it?", "Why?"],
    workspace: { href: "/manager/map", label: "Map explorer" },
    notes: [
      "Each dot is a county. Totals sit on a line: bigger county, more visits. Pounds track Feeding America closest (0.92), visits least (0.90).",
      "→ Per resident, the agreement falls to zero for all three.",
      "→ The counties furthest from the pattern: Scott, Pope, Nicollet with less activity than need suggests; Steele, Washington, Rice with more.",
      "→ Why: farther from a shelf, fewer visits per resident (−0.33). County traits explain little; Scott's biggest shelf is booked to Hennepin, and Steele and Rice are regional hubs.",
    ],
    files: ["outputs/tables/q1_correlations.csv", "outputs/tables/q1_outliers.csv", "outputs/tables/q1_explanatory_models.csv", "outputs/tables/distance_findings.csv"],
  },
  {
    id: "divergence",
    speakers: ["Daniela"],
    seconds: 25,
    questions: ["Q6", "Q1"],
    part: "Findings",
    steps: ["Barriers vs the three measures", "Where they disagree"],
    workspace: { href: "/manager/map", label: "Map explorer: gap layer" },
    notes: [
      "The line slopes down for visits, pounds and individuals: where travel and mobility barriers are higher, fewer low-income residents show up. Need not turning into demand.",
      "→ Nine counties are both top-fifth on barriers and on our Q6 list. A call list: hours, transport, language. Not proof: the Q6 screen alone flags about what chance would.",
    ],
    files: ["outputs/tables/fei_validation.csv", "outputs/tables/q6_need_index.csv", "outputs/tables/q6_permutation_null.csv"],
  },
  {
    id: "q8",
    speakers: ["Daniela"],
    seconds: 25,
    questions: ["Q8"],
    part: "Findings",
    steps: ["Low-income, low-access tracts", "Do shelves reach them?", "Fill or repeat the gap?"],
    workspace: { href: "/manager/map", label: "Map explorer: LILA overlay" },
    notes: [
      "Step 1: red = USDA low-income, low-access tracts: far from a grocery store.",
      "Step 2: among low-income tracts, the low-access ones are less likely to have a shelf: 48% vs 57% in the country, 29% vs 36% in town.",
      "Step 3: and they are farther from one: 7.9 vs 4.1 miles in the country. Shelves repeat the grocery gap. Limits on the slide: 2019 LILA, straight-line miles, presence is not service.",
    ],
    files: ["outputs/tables/q8_low_income_urban_rural.csv", "outputs/tables/distance_findings.csv", "outputs/tables/q8_county_footprint_gaps.csv"],
  },
  {
    id: "q4",
    speakers: ["Daniela"],
    seconds: 20,
    questions: ["Q4"],
    part: "Findings",
    steps: ["Do prices lead activity?", "What cycles remain?"],
    workspace: { href: "/manager", label: "Command center: policy watch" },
    notes: [
      "Grocery prices rose about a fifth since 2022; visits nearly doubled. Month to month, only individuals served follow prices, about 3% a month later, with a wide range. Visits and pounds: no clear link.",
      "→ What remains is the calendar: each extra working day adds about 3% to a month. Net of that, August is an ordinary month.",
    ],
    files: ["outputs/tables/q4_price_models.csv", "outputs/tables/eda_calendar_effect.csv", "outputs/tables/q4_residual_calendar.csv"],
  },
  {
    id: "q5",
    speakers: ["Daniela"],
    seconds: 20,
    questions: ["Q5"],
    part: "Findings",
    steps: ["Together or substitutes?", "When benefits change", "Does it differ by place?"],
    workspace: { href: "/manager", label: "Command center: policy watch" },
    notes: [
      "In a county, more SNAP enrollment comes with more visits (+0.27% per +1%). They move together; no sign shelves stand in for SNAP.",
      "→ The April 2023 cut and the November 2025 delay were among the most unusual months for visits (#1 and #5 of 52). We don't claim the cause.",
      "→ Rural counties look no different, and November 2025 hit high-SNAP counties no harder.",
      "Hand-off: “So what did we submit for August? Biruk.”",
    ],
    files: ["outputs/tables/q5_panel_coefficients.csv", "outputs/tables/q5_noise_summary.csv", "outputs/tables/q5_event_study.csv"],
  },
  {
    id: "q7-result",
    speakers: ["Biruk"],
    seconds: 25,
    questions: ["Q7"],
    part: "Forecast",
    workspace: { href: "/manager/map", label: "Map explorer: forecast layer" },
    notes: [
      "This is the file we submit: about 231,000 visits and 12.1 million pounds statewide, a touch below July because August has 21 working days to July's 22.",
      "Point at the bars: on the last three Augusts our county error is about a sixth of “repeat last August.” Children, adults and seniors add up; Wilkin is 0.",
      "Hand-off: “Here is the rule.”",
    ],
    files: ["outputs/submission/Graduate_Predictions_Submit.csv", "outputs/eval/q7_backtest.csv", "outputs/eval/q7_interval_coverage.csv"],
  },
  {
    id: "q7-method",
    speakers: ["Biruk"],
    seconds: 20,
    questions: ["Q7"],
    part: "Forecast",
    steps: ["Daily pace", "Weight toward July", "× 21 working days"],
    workspace: { href: "/shelf", label: "Shelf portal: next-month forecast" },
    notes: [
      "A manager can redo it by hand. Step 1: each month's visits per working day.",
      "→ Weight 1, 2, 3 toward July. → Times August's 21 working days.",
      "No August 2026 actual touched it. The same rule fills all five submitted fields in every county; ages are scaled to sum to individuals.",
      "Hand-off: “Roshit, show them the tool.”",
    ],
    files: ["outputs/eval/q7_eval.md", "outputs/forecasts/q7_august2026_wide.csv", "D-045"],
  },
  {
    id: "demo",
    speakers: ["Roshit", "Jacob"],
    seconds: 40,
    questions: ["Q1", "Q6", "Q7", "Q8"],
    part: "Demo",
    workspace: { href: "/manager", label: "Command center" },
    notes: [
      "Roshit: command center, click a county: its trend, the August forecast and its sites (12 s).",
      "Roshit: shelf portal, the monthly report in the network's own fields and next month's forecast (8 s).",
      "Jacob: site planner, place a shelf in a high-FEI county and show residents brought within reach and driving time (12 s).",
      "Jacob: supply allocation by need rather than visits (8 s). Back to the deck with the browser Back button.",
    ],
    files: ["apps/foodbridge (county aggregates only, D-062/D-063)"],
  },
  {
    id: "close",
    speakers: ["Jacob"],
    seconds: 25,
    questions: ["Q1", "Q4", "Q5", "Q6", "Q7", "Q8"],
    part: "Close",
    notes: [
      "Four things change on Monday: allocate by need as well as visits; check the nine counties before siting; take the SNAP evidence to legislators; measure results in barriers, not only visits.",
      "Limits: FEI is a screening index, not a count of unmet people; nothing here is causal.",
      "Stop and take questions.",
    ],
    files: ["outputs/tables/research_answers.md"],
  },
  // Appendix: pulled forward only when a judge asks (Zoom 5).
  {
    id: "a-q6",
    speakers: ["Daniela"],
    seconds: 0,
    questions: ["Q6"],
    part: "Appendix",
    appendix: true,
    notes: ["Read the reject line aloud if asked how we would know we are wrong."],
    files: ["docs/reference/q6_addendum.md", "outputs/tables/q6_falsification_checks.csv"],
  },
  {
    id: "a-q7",
    speakers: ["Biruk"],
    seconds: 0,
    questions: ["Q7"],
    part: "Appendix",
    appendix: true,
    notes: ["Development error, not untouched test accuracy: the same folds chose the model."],
    files: ["outputs/eval/q7_backtest.csv", "outputs/eval/q7_interval_coverage.csv", "outputs/eval/q7_eval.md"],
  },
  {
    id: "a-fei",
    speakers: ["Jacob"],
    seconds: 0,
    questions: ["Q6"],
    part: "Appendix",
    appendix: true,
    notes: [
      "Weights are policy choices; the ranking survives re-weighting.",
      "If asked why multiply: access barriers matter where there is need, as in USDA's low-income and low-access tracts; under the old sum, 16% of top-fifth tracts had below-median need (now 5%), and supply drove 43% of the score's variation at a 25% weight.",
    ],
    files: ["outputs/tables/fei_validation.csv", "outputs/tables/fei_sensitivity.csv"],
  },
  {
    id: "a-sources",
    speakers: ["Daniela"],
    seconds: 0,
    questions: [],
    part: "Appendix",
    appendix: true,
    notes: ["Provided data first, then the additional sources the rubric scores (D-058)."],
    files: ["docs/sources/catalog.md"],
  },
];

export const MAIN_SLIDES = SLIDES.filter((s) => !s.appendix);
export const FIRST_APPENDIX = SLIDES.findIndex((s) => s.appendix);
export const TALK_SECONDS = MAIN_SLIDES.reduce((s, x) => s + x.seconds, 0);

/** Seconds each teammate speaks in the main talk (shared slides split evenly). */
export function speakerSeconds(): Record<Speaker, number> {
  const out: Record<Speaker, number> = { Jacob: 0, Daniela: 0, Biruk: 0, Roshit: 0 };
  for (const s of MAIN_SLIDES) for (const p of s.speakers) out[p] += s.seconds / s.speakers.length;
  return out;
}

/** Cumulative target time at the end of each slide (appendix slides add nothing). */
export function cumulativeSeconds(): number[] {
  let t = 0;
  return SLIDES.map((s) => (t += s.seconds));
}

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export interface RunRateStep {
  month: string;
  value: number;
  workdays: number;
  perDay: number;
  weight: number;
}

/** The D-045 rule worked through on the statewide series, for the method slide. */
export function statewideRunRate(signal: Extract<ForecastSignal, "HouseholdsTotal" | "PoundsTotal" | "IndividualsTotal">) {
  const target = research.meta.forecast_target;
  const steps: RunRateStep[] = [];
  for (let k = 3; k >= 1; k--) {
    const month = addMonths(target, -k);
    const row = research.history.find((h) => h.month === month);
    const value = row?.[signal];
    if (value == null) continue;
    const wd = workdays(month);
    steps.push({ month, value, workdays: wd, perDay: value / wd, weight: 4 - k });
  }
  const den = steps.reduce((s, x) => s + x.weight, 0);
  const perDay = den ? steps.reduce((s, x) => s + x.weight * x.perDay, 0) / den : null;
  const targetDays = workdays(target);
  return { target, steps, perDay, targetDays, yhat: perDay == null ? null : perDay * targetDays };
}

export const MODEL_LABEL: Record<string, string> = {
  seasonal_naive: "Repeat last August",
  mean12: "Last 12-month average",
  july_naive: "Repeat July",
  recent3_calendar: "3-month working-day rate",
  recent3_weighted: "Same, weighted 1:2:3 (submitted)",
};
