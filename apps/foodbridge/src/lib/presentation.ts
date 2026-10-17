// Run sheet for the 17 October judging talk (D-066): who speaks, for how long, which scored
// question each slide answers and which workspace page holds its full visual. The page in
// src/app/present renders these slides; tests/presentation.test.ts keeps the budget honest.
// Story order: the business problem, our need measure (Q6), then each scored question,
// the forecast (Q7), the tool and the Monday actions. Step labels name the sub-question
// each build answers, so a judge can tick the rubric off the screen.
// Scripts and judge answers follow the D-067 rehearsal script and Q&A guide, with every
// figure re-read from the current bundles (research.json, deck.json, outputs/tables).

import { addMonths, workdays } from "./calendar";
import { research } from "./research";
import type { ForecastSignal } from "./types";

export type Speaker = "Jacob" | "Daniela" | "Biruk" | "Roshit";
export type Question = "Q1" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8";

export interface JudgeQuestion {
  q: string;
  /** The strongest truthful answer, in words a teammate can say. */
  a: string;
  /** Where the numbers in the answer come from. */
  src?: string;
}

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
  /** What to say, at about 130 words a minute. [Brackets] are silent cues; "Name:" hands over. */
  script: string;
  /** Cue lines per build step: say the first one, point at the number in the second. */
  notes: string[];
  /** Questions judges are likely to ask here, answered within what the evidence supports. */
  qa: JudgeQuestion[];
  /** Where the slide's wording runs ahead of the evidence: say the qualifier before a judge asks. */
  watch?: string[];
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
    script:
      "The Food Group can see who reaches a food shelf. It can't see everyone who needs help. [Point at the two bars.] These national figures show why that gap matters. Our question: where should Minnesota look first?",
    notes: [
      "The Food Group allocates by visits. Visits are demand, not need.",
      "Point at the bars: nationally 27.7% of working-age adults are food insecure, 16.7% got charitable food, and 3 in 10 in food-insecure households went without help they needed.",
      "Today: where need and demand split in Minnesota, why, and what to change on Monday.",
    ],
    qa: [
      {
        q: "Can we subtract the two bars to get the number of unserved Minnesotans?",
        a: "No. The Urban Institute figures describe U.S. adults aged 18–64 in its December 2025 survey. Food insecurity and getting charitable food are different measures, and neither bar is a Minnesota or county count. They frame why observed use can miss need; every Minnesota comparison after this slide uses named county data.",
        src: "docs/sources/catalog.md rows 63–64",
      },
      {
        q: "What exactly is “demand” in your data?",
        a: "Recorded food-shelf activity, as three separate signals: household visits (HouseholdsReg), pounds distributed (PoundsReg) and individuals served (IndividualsReg). Pounds also depend on how much food was on hand, and individuals are not unique people across months. None counts everyone who needs food; that is the sponsor glossary's line between demand and need.",
        src: "Glossary_of_Terms.docx; D-039",
      },
      {
        q: "Is this only The Food Group's own shelves?",
        a: "No. It is the statewide food-shelf reporting network, collected by The Food Group with Minnesota DCYF across seven food banks; The Food Group's own sites are about a fifth of the rows. We classify sites on the master Organization.AgencyType, keep closed sites' history, and add up to counties. Providers outside the network are invisible to us, so low activity is not automatically low service.",
        src: "docs/reference/data_profile.md §1.3",
      },
      {
        q: "The sponsor publishes about 9 million visits a year. Why are your visits households?",
        a: "The sponsor told us visits are HouseholdsReg (Zoom 3). Its published statewide figure, 9,026,842 in 2025, tracks individuals served within about 1%, so it is a different statistic. We report all three signals and name the field each time.",
        src: "D-039; docs/reference/monthly_totals.csv",
      },
    ],
    watch: ["The bars are national survey context. Never call them a Minnesota estimate of unserved people."],
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
    script:
      "[Press → through the five layers.] Every census tract gets five barrier scores: money, food nearby, distance, getting there, and household vulnerability. Need and access combine geometrically, emphasizing places with both kinds of barriers. About 2.67 million residents live over a mile in town, or ten miles in the country, from a reporting shelf. That screens access; it doesn't count people without food.",
    notes: [
      "Press → through the five barriers: each one recolors every census tract. Red = more of that barrier.",
      "Last step: need (N, V) and access (S, T, M) multiply into one 0–100 score, the Food Access Equity Index, emphasizing joint need and access barriers without a hard threshold. No visit counts go in (pounds do, through supply), so it can disagree with demand.",
      "Point at: 2.7 million Minnesotans live beyond easy reach of a reporting shelf.",
      "Hand-off: “Daniela will show you where it is worst.”",
    ],
    qa: [
      {
        q: "Does FEI really leave demand out? Pounds distributed go into it.",
        a: "Not entirely, and we say so. The supply pillar, 15% of the weights, is 2024 pounds distributed within reach per low-income resident, so FEI is a barrier-and-supply screen. Visit counts, SNAP and Map the Meal Gap do not enter. The county Q6 score on the next slides excludes all three activity measures, and when we compare FEI with activity we use only the travel and mobility pillars.",
        src: "src/mi/fei.py (supply pillar); src/lib/pillars.ts",
      },
      {
        q: "Why these weights, and why multiply instead of add?",
        a: "The weights are policy choices, not fitted effects: need 50 (money 35, vulnerability 15) and access 50 (supply 15, travel 20, mobility 15). The geometric mean reduces compensation between need and access, but does not require both to exceed a threshold. USDA's low-income and low-access flag motivates considering both dimensions. Under the earlier sum, 16% of top-fifth tracts had below-median need; now 5%. Equal weights keep the county ranking at ρ 0.98.",
        src: "D-069; fei_sensitivity.csv",
      },
      {
        q: "What does “2.67 million beyond easy reach” actually measure?",
        a: "2020 Census residents at populated block points whose nearest reporting shelf is more than 1 mile away in urban areas or 10 miles in rural areas, in a straight line: 47% of Minnesotans. It is a geographic threshold, not travel time, a household survey or a count of people lacking food. Non-reporting shelves, mobile stops and options across a state line can change real access.",
        src: "fei_meta.json kpis (residents_beyond 2,669,235)",
      },
      {
        q: "Does race enter the score?",
        a: "Only through the minority-status theme of CDC's 2022 Social Vulnerability Index, half of the demographics pillar: 7.5% of the weights (D-068). It marks documented barriers such as language and discrimination; it is not a causal claim or an eligibility rule. Without it the county ranking holds at ρ 0.99 and all 18 top-fifth counties stay.",
        src: "fei_sensitivity.csv (no_race); D-068",
      },
      {
        q: "Why not use tract-level poverty directly?",
        a: "51% of Minnesota tract ACS poverty estimates fail the Census Bureau's own reliability test (CV above 0.30); at county level none do. So continuous Census inputs come in at county grain, and tract detail comes from published SVI percentiles, USDA flags, exact 2020 counts and geography.",
        src: "D-020; docs/reference/data_profile.md",
      },
    ],
    watch: [
      "Don't say “no food-shelf activity goes in”: pounds enter the supply pillar. “No visit counts” is accurate.",
      "Supply carries 15% of the weight but explains about 28% of FEI's variation across tracts.",
      "FEI (tracts, five pillars) and the Q6 score (counties, three inputs) are different measures. Don't call both “our need index”.",
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
    script:
      "[Point to the west and north; pause as the shelf icons appear.] The darkest tracts are mostly in western and northern Minnesota, and the reddest have few reporting shelves. The highest-barrier fifth of tracts holds about 1.06 million residents, including 250,000 children. Those are residents of higher-barrier places, not a count of food-insecure people. Before proposing a shelf, we would ask local partners about hours, travel and other providers.",
    notes: [
      "Step 1: red tracts have the most barriers, in the rural west and north, not the metro.",
      "Step 2: each icon is a food shelf reporting in July. They sit where people are; the reddest tracts have few.",
      "Step 3: 1.06 million residents, 250,000 of them children, live in the highest-barrier fifth.",
      "If asked “is it need?”: it rises with SNAP use (0.59) and Feeding America's estimate (0.85), and neither is an input.",
      "Bridge: “So how would we know this score is wrong?”",
    ],
    qa: [
      {
        q: "How do you know the red tracts have more food insecurity?",
        a: "Tract by tract, we don't. At county level FEI ranks agree with SNAP participation (ρ 0.59, 95% range 0.40 to 0.73, 82 SNAP units) and with Feeding America's food-insecurity rate (ρ 0.85), and neither is an FEI input. Those are consistency checks, not a household survey; the Q6 addendum names the survey that could reject the idea.",
        src: "fei_validation.csv; appendix A3",
      },
      {
        q: "Are the shelf icons exact locations?",
        a: "415 of July's 449 reporting sites are mapped at researched coordinates, 248 of them at a verified street point; hollow icons are approximate (a town or ZIP), and 34 could not be placed. The map shows site type only, never activity per shelf (D-063). An icon means a site reported in July, not its hours, its capacity, or that it is the only provider.",
        src: "public/data/sites.json meta; D-063, D-064",
      },
      {
        q: "Why are a million people in the “highest fifth”?",
        a: "It is a fifth of the 1,501 scored tracts, not a fifth of the population, and tracts differ in size. They hold 1.06 million residents and 250,000 children by 2020 Census block counts. Those residents face higher barriers; we do not count them as food insecure.",
        src: "fei_meta.json kpis (residents_top_quintile, children_top_quintile)",
      },
      {
        q: "Which counties are worst, and why is Wilkin there with no shelf?",
        a: "Mahnomen (70), Clearwater (70), Swift (69), Wilkin (65), then Beltrami and Nobles (63). Wilkin has no reporting shelf in the extract, so its distance barrier is high by construction. Residents may use non-reporting or North Dakota providers we cannot see; 192 tracts within 10 miles of a state line are flagged for that reason.",
        src: "fei_counties.csv; fei_meta.json (border_tracts)",
      },
    ],
    watch: [
      "Say “not food-insecure people” right after the 1.06 million.",
      "The SNAP and Feeding America checks are county level, and FEI contains pounds, so they are not a clean test of a demand-free measure.",
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
    script:
      "Our separate county need score uses Feeding America's food-insecurity rate, poverty and households without a car. No shelf activity enters, so people who never visit still count. [Press →; pause.] A household survey that includes non-users could reject it. We have not run one. Next: does recorded activity follow estimated need?",
    notes: [
      "1: need is a household without reliable food, whether or not it asks. 2: built only from public hardship data; visits, pounds and people served never go in.",
      "→ 3: reject it if a survey of non-users finds no more hardship in high-score counties. That survey is not run yet. 4: revise if one input or the Feeding America edition moves a county by a fifth.",
      "Checks run now: it rises with SNAP use (passed); with poverty held fixed, only just.",
      "Bridge: “Now, does today's demand follow need?”",
    ],
    qa: [
      {
        q: "What exactly would make you reject the measure?",
        a: "An independent sample of households, users and non-users, with a fixed food-security recall period. We would set the sampling design and a practically useful difference before collecting. If high-score counties show no more hardship and the upper confidence bound rules out that difference, we reject the county ranking. A wide interval is inconclusive. The survey has not been run.",
        src: "docs/reference/q6_addendum.md; appendix A1",
      },
      {
        q: "Isn't this just Map the Meal Gap renamed?",
        a: "Map the Meal Gap is one of three equal-weight county percentiles, with ACS poverty and households without a vehicle. They are correlated, and poverty overlaps Feeding America's own model inputs. So it is a transparent relative screen, not a new estimate of food-insecure people. Dropping each input and changing weights is tested.",
        src: "q6_need_index.csv; q6_weight_sensitivity.csv",
      },
      {
        q: "SNAP agrees with it. Why isn't that validation?",
        a: "SNAP participation is not an input and agrees well (ρ 0.66, 0.50 to 0.79). But poverty alone gets 0.62. Holding poverty fixed, the partial correlation is 0.28 (0.02 to 0.50): positive, only just. That supports more checking, not proof the score sees hidden need.",
        src: "q6_falsification_checks.csv",
      },
      {
        q: "What would make you revise rather than reject?",
        a: "If dropping one input or switching the Feeding America edition moves a county by more than a fifth of the ranking, or fieldwork shows the no-car measure mostly flags well-served urban households. Then we change the inputs or weights, not the definition.",
        src: "q6_vintage_sensitivity.csv; q6_weight_sensitivity.csv",
      },
      {
        q: "How does the score compare with the three activity measures?",
        a: "Rank correlation with 2024 activity per resident: visits 0.09, pounds 0.12, individuals 0.14, each interval crossing zero. The two screens disagree; that disagreement is the Q6 divergence. It is not confirmed hidden need.",
        src: "q6_activity_correlations.csv",
      },
    ],
    watch: [
      "This is the county Q6 score, a different formula and geography from FEI on the two slides before.",
      "The survey rule is proposed, not fielded or preregistered.",
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
    script:
      "[Point to the totals.] County totals line up closely with Feeding America's estimated food-insecure count, mostly because big counties have more of everything. [Press →; pause.] Per resident, agreement is near zero for household visits, pounds and individuals. [Press →.] Scott shows why we check the exceptions: its largest shelf is booked to Hennepin. We would verify bookings and client catchments before shifting resources.",
    notes: [
      "Each dot is a county. Totals sit on a line: bigger county, more visits. Pounds track Feeding America closest (0.92), visits least (0.90).",
      "→ Per resident, the agreement falls to zero for all three.",
      "→ The counties furthest from the pattern: Scott, Pope, Nicollet with less activity than need suggests; Steele, Washington, Rice with more.",
      "→ Why: farther from a shelf, fewer visits per resident (−0.33). County traits explain little; Scott's biggest shelf is booked to Hennepin, and Steele and Rice may serve neighbours (client origins are not observed).",
    ],
    qa: [
      {
        q: "Why do the count correlations look so strong?",
        a: "Larger counties have more residents, more estimated food-insecure people and more activity. 2024 rank correlations on counts: visits 0.90, pounds 0.92, individuals 0.91. The intervals overlap, so pounds is not decisively best. Per resident they are −0.02, 0.03 and 0.01.",
        src: "q1_correlations.csv",
      },
      {
        q: "Are Scott, Pope and Nicollet underserved?",
        a: "They are the largest shortfalls of 2024 visits per resident against Feeding America's rate: a reporting pattern, not a count of unmet people. Scott depends on booking: its largest shelf sits in Scott but is booked under Hennepin. Catchments, missing months and one dominant site can move a county, so we would check booking and client origins first.",
        src: "q1_outliers.csv; q1_county_concentration.csv",
      },
      {
        q: "How do you know Steele, Rice and Olmsted are regional hubs?",
        a: "We don't: there is no client-origin data. It is a hypothesis. A crude adjacency check in our review found the flagged counties' neighbours are no busier than other counties' (p = 0.76), and one site supplies 95% of Steele's pounds. It is an item for a service-area audit.",
        src: "docs/review/2026-10-15_findings.csv (E-09, O-03); q1_county_concentration.csv",
      },
      {
        q: "How did you match the years and Feeding America editions?",
        a: "Same data year on both sides: 2022 activity with the 2024 edition, 2023 with the revised 2025 edition (v2), 2024 with the 2026 edition. An annual total needs twelve observed months; missing stays missing. 85 counties in 2024: Wilkin has no reporting history and Stevens reported only nine months. All three years are in the table; the slide shows 2024.",
        src: "q1_correlations.csv; q1_annual_coverage.csv; D-025, D-042",
      },
      {
        q: "What explains the mismatch besides distance?",
        a: "A model with poverty, households without a car, rurality and site density explains only 10–13% of the differences. No-car share goes with more activity per resident (+0.19 SD, 0.02 to 0.37), perhaps because some shelves sit within walking or transit reach; poverty and rurality are unclear once the others are held fixed. Distance: ρ −0.33 visits, −0.21 pounds, −0.41 individuals. Associations only.",
        src: "q1_explanatory_models.csv; distance_findings.csv",
      },
    ],
    watch: [
      "Pause between totals and per resident: that turn is the finding.",
      "The slide calls Steele, Rice and Olmsted regional hubs. Say “may serve neighbours”; client origins are not observed.",
      "The slide shows 2024; Q1 asks for 2022–2024. The other two years are in q1_correlations.csv.",
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
    script:
      "Where travel and mobility barriers are higher, recorded activity per lower-income resident is lower, for all three measures. [Press →.] Nine counties are in the top fifth on barriers and on our county need list. [Pause.] That is a call list, not proof of unmet need. Ask about transport, hours and reporting before any allocation decision.",
    notes: [
      "The line slopes down for visits, pounds and individuals: where travel and mobility barriers are higher, fewer low-income residents show up. Say “goes with”, not “causes”.",
      "→ Nine counties are both top-fifth on barriers and on our Q6 list. A call list: hours, transport, language. Not proof: the Q6 screen alone flags about what chance would.",
    ],
    qa: [
      {
        q: "Does the downward slope prove barriers cause fewer visits?",
        a: "No, it is a cross-county association. Travel plus mobility against 2024 activity per 1,000 lower-income residents: visits −0.35 (−0.52 to −0.13), pounds −0.23 (−0.42 to −0.02), individuals −0.32 (−0.50 to −0.11). County traits, network coverage and travel across county lines can explain part of it. We use it to choose whom to call, not to claim an effect.",
        src: "fei_validation.csv; appendix A3",
      },
      {
        q: "Are the nine counties a statistically unusual cluster?",
        a: "We don't claim that. Nine is the overlap of FEI's top-fifth counties and the Q6 priority list. The Q6 procedure flags 14 counties; random pairings flag about 16, so the count is not beyond chance. Six flags survive every documented perturbation (Chippewa, Lyon, Nobles, Swift, Todd, Wadena): a reason to check them first, not proof.",
        src: "q6_permutation_null.csv; q6_robust_set.csv",
      },
      {
        q: "Which nine counties?",
        a: "Aitkin, Beltrami, Chippewa, Clearwater, Lyon, Nobles, Swift, Todd and Wadena.",
        src: "fei_meta.json kpis (counties_top_quintile_and_q6_priority_names)",
      },
      {
        q: "Why people below 200% of poverty as the denominator?",
        a: "It is a plausible at-risk population that gives a comparable rate. It is not a count of food-insecure people or eligible users, it comes from county ACS estimates with their uncertainty, and it cannot fix catchments: a shelf in one county can serve residents of another.",
        src: "ACS 2020–2024 county estimates (catalog row 25)",
      },
      {
        q: "Why only travel and mobility here, not the full FEI?",
        a: "The full FEI's supply pillar is built from pounds distributed, so comparing it with activity would be partly circular. Travel and mobility contain no activity data.",
        src: "fei_validation.csv (access_TM checks)",
      },
    ],
    watch: [
      "The title says “That is need not turning into demand”; the evidence is a county association. Say “goes with” and “call list”.",
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
    script:
      "[Press → to the rural bars.] Among low-income rural tracts, 48 percent of low-access tracts contain a reporting shelf, versus 57 percent of the others. [Press →.] Their residents are 7.9 versus 4.1 straight-line miles from one. The grocery flag dates to 2019 and the shelf footprint to 2024, and a marker says nothing about hours or capacity.",
    notes: [
      "Step 1: red = USDA low-income, low-access tracts: far from a grocery store.",
      "Step 2: among low-income tracts, the low-access ones are less likely to have a shelf: 48% vs 57% in the country, 29% vs 36% in town.",
      "Step 3: and they are farther from one: 7.9 vs 4.1 miles in the country. Shelves repeat the grocery gap. Limits on the slide: 2019 LILA, straight-line miles, presence is not service.",
    ],
    qa: [
      {
        q: "Is the presence difference statistically significant?",
        a: "Borderline. Rural 48% vs 57%, urban 29% vs 36%; pooled across both, the odds ratio is 0.71 with p = 0.066, so we don't oversell presence. Adjusting for tract population and land area gives 0.48 (p = 0.001), but we chose that adjustment after seeing the raw result. Distance is the clearer evidence.",
        src: "q8_size_adjusted.csv",
      },
      {
        q: "Are those driving miles?",
        a: "The bars are straight-line miles from populated census-block points to the nearest validated reporting shelf, weighted by population. By road (OSRM on OpenStreetMap), rural low-access residents are 10.5 vs 5.4 miles away, and half of them are more than 10 road miles out (50% vs 18%). Neither measure covers hours, transit, walking or eligibility.",
        src: "distance_findings.csv; deck.json q8_road",
      },
      {
        q: "USDA's tracts are 2010 geography. How did you join them?",
        a: "The Food Access Research Atlas is 2019 data on 2010 tracts. We carry it to 2020 tracts through the Census relationship file by dominant land-area overlap and flag the 10 of 1,505 tracts that draw under 90% from one parent. We never string-join tract IDs, and we use USDA's published flag rather than a noisy ACS tract poverty rate.",
        src: "q8_geography_audit.csv; D-020–D-022",
      },
      {
        q: "So would you open a shelf in every red tract?",
        a: "No. Of 217 low-income, low-access tracts, 142 have no shelf inside: that is a field-check list. LILA is about grocery access, a marker says nothing about capacity or hours, and a new site may duplicate a neighbour's catchment. Check non-reporting providers, mobile stops, client travel, hours and capacity, then compare options with partners.",
        src: "research.json findings.q8; q8_county_footprint_gaps.csv",
      },
      {
        q: "What about urban tracts?",
        a: "Same direction, smaller distances: urban low-access residents are 1.4 vs 0.9 straight-line miles from a shelf, 2.0 vs 1.2 by road.",
        src: "distance_findings.csv; deck.json q8_road",
      },
    ],
    watch: [
      "“Repeat the grocery gap” is stronger than the raw presence test (p = 0.066). Lead with distance.",
      "“2024 map year” is the shelf footprint; the LILA flag is 2019 data.",
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
    script:
      "[Point to the lines, then the verdicts.] Prices and shelf activity both rose, but the month-to-month link is weak. Only individuals served show a one-month association, and it depends on early 2022. [Press →.] We would not use price alone as an alert. Working days and recent activity plan better.",
    notes: [
      "On the chart (2022 average = 100) prices end near 111 and visits near 146. Month to month, only individuals served follow prices, about 3% a month later, with a wide range that depends on early 2022. Visits and pounds: no clear link.",
      "→ What remains is the calendar: each extra working day adds about 3% to a month. Net of that, August is an ordinary month.",
    ],
    qa: [
      {
        q: "So a 1% price rise brings 3% more people?",
        a: "No. With the Midwest food-at-home CPI, a 1% monthly rise goes with about +3.0% individuals served the next month, 95% range 0.7% to 5.4%. It is a regional series, not a county causal effect. Leave out February–June 2022 and it becomes −0.9% (−3.2 to 1.5); from 2023 on it is negative. Not a dependable alert.",
        src: "q4_price_models.csv; q4_price_fragility.csv",
      },
      {
        q: "And visits and pounds?",
        a: "No clear link: visits +2.1% (−0.7 to 4.9) a month later, pounds −0.5% (−3.0 to 2.0) in the same month.",
        src: "q4_price_models.csv",
      },
      {
        q: "Why the Midwest CPI and not county grocery prices?",
        a: "There is no official monthly county food-at-home series. BLS CPI-U food at home for the Midwest (CUUR0200SAF11) is the finest official monthly series covering every Minnesota county; we also ran the U.S. and Minneapolis–St. Paul series. Map the Meal Gap's cost per meal is annual and changed method. The cost: every county gets the same price change.",
        src: "docs/sources/catalog.md row 5",
      },
      {
        q: "What cycles remain after prices?",
        a: "The calendar. Each extra working day goes with +2.6% visits, +3.3% pounds and +2.8% individuals, measured within calendar month across years. Visits grow more slowly than January in April and September, individuals in December and February. Net of working days, August is an ordinary month.",
        src: "eda_calendar_effect.csv; q4_residual_calendar.csv",
      },
      {
        q: "Both lines go up on your chart. Isn't that the link?",
        a: "Shared trends always correlate. Since the 2022 average, prices are up 11% and visits 46%. We test monthly changes with season and working days held fixed, and there the link is weak.",
        src: "deck.json q4_prices; research.json history",
      },
    ],
    watch: ["The title “only individuals served follow them” sounds firm; say the early-2022 caveat aloud."],
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
    script:
      "When a county's SNAP caseload is one percent higher, household visits run about 0.27 percent higher; pounds and individuals are less clear. [Press →.] April 2023 and November 2025 were unusually busy months, without proving cause. [Press →.] No clear rural difference. Advance notice of benefit changes would help shelves prepare.",
    notes: [
      "In a county, more SNAP enrollment comes with more visits (+0.27% per +1%). They move together; no sign shelves stand in for SNAP.",
      "→ The April 2023 cut and the November 2025 delay were among the most unusual months for visits (#1 and #5 of 52). We don't claim the cause.",
      "→ Rural counties look no different, and November 2025 hit high-SNAP counties no harder.",
      "Hand-off: “So what did we submit for August? Biruk.”",
    ],
    qa: [
      {
        q: "Does moving together mean SNAP and shelves complement each other?",
        a: "Not at household level. Within a SNAP unit over time, with county and month effects, reporting-site count and unemployment: visits +0.27% per +1% caseload (0.05 to 0.48). Pounds +0.04 (−0.27 to 0.34) and individuals +0.25 (−0.03 to 0.52) are unclear. These are administrative totals with no linked households, so we cannot tell substitution from complementarity. The policy line: both systems face demand together.",
        src: "q5_panel_coefficients.csv",
      },
      {
        q: "Did the benefit changes cause those busy months?",
        a: "We can't attribute them. After season, April 2023 was the most unusual visit month of 52 (+18.6 points) and November 2025 fifth (+11.3). Minnesota paid its last emergency allotment in March 2023, so April was the first reduced month (D-033); the November 2025 delay coincided with other changes. Worth examining, not a causal estimate.",
        src: "q5_noise_summary.csv; D-033",
      },
      {
        q: "Is the SNAP data really county by month? What's the lag?",
        a: "Minnesota DCYF publishes monthly accounting records by administrative agency. Two multi-county agencies cover Dodge, Steele and Waseca, and Pope and Grant, so we add shelf activity up to those units; three tribal agencies report separately and are not assigned to host counties. Publication lag is about three weeks; USDA FNS state data is a cross-check.",
        src: "docs/sources/catalog.md row 3; D-027, D-028",
      },
      {
        q: "Do rural counties respond differently?",
        a: "The nonmetro interaction for visits is −0.11 (−0.73 to +0.51): not enough evidence of a difference, which is not the same as no difference. November 2025 did not hit high-SNAP counties harder.",
        src: "deck.json q5_place; q5_event_study.csv",
      },
      {
        q: "What would you tell lawmakers?",
        a: "Where SNAP caseloads rise, visits rise too; in these data shelves don't stand in for SNAP. Ask DCYF for advance notice of benefit gaps so shelves can stock up. “Protect SNAP” is a position from broader evidence; this project does not estimate what a specific cut would do.",
        src: "outputs/tables/research_answers.md (Q5)",
      },
    ],
    watch: [
      "“Move together” holds clearly for visits only.",
      "Never say benefit changes caused the spikes, or that individual households use both programs.",
    ],
    files: ["outputs/tables/q5_panel_coefficients.csv", "outputs/tables/q5_noise_summary.csv", "outputs/tables/q5_event_study.csv"],
  },
  {
    id: "q7",
    speakers: ["Biruk"],
    seconds: 30,
    questions: ["Q7"],
    part: "Forecast",
    workspace: { href: "/manager/map", label: "Map explorer: forecast layer" },
    script:
      "Our August file: 230,620 household visits and 12.1 million pounds across 87 counties, plus three age groups. [Point to the strip.] Pace per working day in May, June and July, weighted one, two, three toward July, times August's 21 working days, county by county. On three earlier Augusts, county visit error was a sixth of repeating last August; those tests also chose the rule. Only data through July went in.",
    notes: [
      "This is our August file for team G08: about 231,000 visits and 12.1 million pounds statewide, a touch below July because August has 21 working days to July's 22.",
      "The rule, top strip: each month's visits per working day, weighted 1, 2, 3 toward July, times August's 21 working days. A manager can redo it by hand; the same rule fills all five fields in every county. No August 2026 actual touched it.",
      "Point at the table: on the last three Augusts our county error in visits is about a sixth of “repeat last August.” Gradient boosting on the same folds beat the rule only on adults, so we retained the rule. Children, adults and seniors add up; Wilkin is 0.",
      "Hand-off: “Roshit, show them the tool.”",
    ],
    qa: [
      {
        q: "Has the file actually been submitted?",
        a: "The repository verifies a prepared G08 file, but does not verify organizer receipt or upload time. Say “prepared” until the team checks the receipt; do not infer submission from a filename. The file is built by mi.submission --team-id G08: 87 rows, and every byte outside the filled cells is checked against the organizer template. No August 2026 outcome was used.",
        src: "outputs/submission/Graduate_Predictions_Submit.csv and .provenance.json",
      },
      {
        q: "Six times better than what, exactly?",
        a: "County RMSE for visits over August 2023, 2024 and 2025: 371 for our rule, 2,295 for repeating last August, 983 for repeating July, 424 for equal weights. The same folds helped choose the rule and large counties dominate squared error, so this is development error, not 2026 accuracy.",
        src: "q7_backtest.csv; appendix A2",
      },
      {
        q: "Why weight 1:2:3?",
        a: "Across 37 monthly forecast origins it cut county visit RMSE 3.3% against equal weights, winning 23 of 37. On the three August folds it is 12.5% better overall but won only one of the three years. It follows the current pace and a manager can redo it by hand.",
        src: "q7_origin_check_summary.csv",
      },
      {
        q: "Why not machine learning?",
        a: "We tested one fixed gradient-boosting model on the same folds. It beat the rule only on adults (572 vs 653) and lost on visits (654 vs 371), pounds, children and seniors, so it missed our promotion criterion and we kept the rule staff can audit.",
        src: "q7_ml_eval.md; deck.json q7_ml",
      },
      {
        q: "How did you keep August data out?",
        a: "Operational data end in July 2026. mi.guards fails any outcome table holding an August 2026 row and trims external monthly series before August; each back-test fold repairs its training data at its own cutoff. We never fetched August 2026 actuals or a proxy for them.",
        src: "src/mi/guards.py; outputs/eval/q7_guard_log.csv",
      },
      {
        q: "Why 87 rows when 86 counties report? Is Wilkin really zero?",
        a: "The template requires all 87 counties, and Wilkin has no reporting shelf in the period, so it gets the organizer's 0. That is a filing convention, not a claim that nobody in Wilkin needs food or gets help elsewhere.",
        src: "D-040; Graduate_Predictions_Submit.csv",
      },
      {
        q: "Do the age groups add up?",
        a: "Yes. Each age group follows the same rule, then is scaled so children + adults + seniors equal the individuals forecast in every county: 251,086 + 378,592 + 82,965 = 712,643. Individuals is a check, not a submitted field.",
        src: "research.json findings.q7_state",
      },
      {
        q: "What could break the forecast?",
        a: "Late July reports, a large shelf that stops reporting, or a sudden policy or supply change. Our 80% bands covered 91% of counties for visits and 81% for pounds in August 2025, but only 35% for children in August 2024. They are planning ranges, not guarantees.",
        src: "q7_interval_coverage.csv",
      },
    ],
    watch: [
      "Say “prepared” unless the team has verified the organizer receipt; file validation is not upload confirmation.",
      "The sixfold figure is for visits, on development folds.",
      "August has passed by judging day: present it as a competition entry and a planning workflow, not an order.",
    ],
    files: [
      "outputs/submission/Graduate_Predictions_Submit.csv",
      "outputs/eval/q7_eval.md",
      "outputs/eval/q7_backtest.csv",
      "outputs/eval/q7_ml_eval.md",
      "D-045",
    ],
  },
  {
    id: "demo",
    speakers: ["Roshit", "Jacob"],
    seconds: 40,
    questions: ["Q1", "Q6", "Q7", "Q8"],
    part: "Demo",
    workspace: { href: "/manager", label: "Command center" },
    script:
      "Roshit: [Open the command center; click a county.] A manager sees a county's reported activity beside its barriers and the August forecast. [Open the shelf portal.] This sample is a county network, not one shelf. Jacob: [Open the site planner; place a shelf.] We compare a proposed location's reach and driving access. [Open allocation.] And we test a hypothetical supply split. These screens organize a local conversation; they don't show that an intervention worked. [Browser Back.]",
    notes: [
      "Roshit: command center, click a county: its trend, the August forecast and its sites (12 s).",
      "Roshit: shelf portal, the monthly report in the network's own fields and next month's forecast; say “county network” at the first click (8 s).",
      "Jacob: site planner, place a shelf in a high-FEI county and show residents brought within reach and driving time (12 s).",
      "Jacob: supply allocation by need rather than visits (8 s). Back to the deck with the browser Back button.",
    ],
    qa: [
      {
        q: "Is The Food Group using FoodBridge?",
        a: "No. A hosted prototype and a local workflow are built: manager view, county-network workspace, site planner, allocation scenarios and sourced briefings. We have no evidence of sponsor adoption, shared use or measured impact. Activity is county aggregates, which is why the sample “shelf” records are county networks; a real shelf account would need a verified connection and role review.",
        src: "apps/foodbridge/README.md; D-038, D-061, D-062",
      },
      {
        q: "Are the proposed sites or allocation gains validated?",
        a: "No. The planner computes geographic reach and free-flow driving routes; allocation splits a hypothetical supply pool under chosen weights. Neither tells us demand at a new site, its hours, partner capacity, cost or household outcomes. They shortlist options to compare with partners, then pilot and measure.",
        src: "/manager/scenarios; /manager/allocation",
      },
      {
        q: "Does the AI make the forecasts or decide where food goes?",
        a: "No. Forecasts, FEI and scenarios are computed by code from versioned inputs. The briefing is instructed to retrieve and cite figures; it is not the calculation engine and its answers still need checking; if the provider fails, a sourced offline briefing appears. Managers choose the scenario.",
        src: "src/lib/agent; D-061",
      },
      {
        q: "Does the public app expose shelf-level data?",
        a: "No. Activity is shown at county grain only. The map places each July reporting site at researched coordinates with its type, never its activity, ID or name (D-063), and the whole portal sits behind a password (D-062).",
        src: "public/data/sites.json; D-062, D-063",
      },
      {
        q: "What if the internet or routing fails mid-demo?",
        a: "The planner falls back to straight-line distance. Map tiles and road times may not load. Bundled data do not guarantee the website works after a fresh offline load. Keep a verified export matching this current deck on the iPad and rehearse it in airplane mode; browser Back returns to the deck during the live demo.",
        src: "outputs/deck/present.pdf; D-065",
      },
      {
        q: "Why do extra visits and extra food start at zero in the planner?",
        a: "A cross-county distance association cannot estimate the causal effect of opening a site. We therefore model existing visits shifting location first. Additional visits and additional network food are separate, editable assumptions. Only extra food increases network supply; additional visits incur travel rather than receiving credit for an old trip they never made.",
        src: "src/lib/siteModel.ts; src/lib/scenario.ts; D-070",
      },
      {
        q: "Are the five ranked locations a plan to open five sites?",
        a: "No. Each is a separate alternative evaluated against today's network. Minimum spacing does not jointly optimize a network or account for sites competing with each other. Rerun after changing assumptions, then verify hours, catchments, capacity and feasibility with local partners.",
        src: "src/lib/siteModel.ts optimizeSites",
      },
    ],
    watch: [
      "The sample is a county network. Say so at the first click; it is not a validated shelf-level model.",
      "If a page stalls, describe what it would show and move on.",
    ],
    files: ["apps/foodbridge (county aggregates only, D-062/D-063)"],
  },
  {
    id: "close",
    speakers: ["Jacob"],
    seconds: 25,
    questions: ["Q1", "Q4", "Q5", "Q6", "Q7", "Q8"],
    part: "Close",
    script:
      "For Monday, four steps. Allocate: compare activity with the need screens before moving supply. Site: check flagged places with local partners first. Argue: coordinate with SNAP administrators before benefit disruptions. Measure: report access and reporting alongside visits. FoodBridge organizes those checks; only a pilot and household evidence can show whether access improves. Thank you.",
    notes: [
      "Four things change on Monday: allocate by need as well as visits; check the nine counties before siting; take the SNAP evidence to legislators; measure results in barriers, not only visits.",
      "Limits: FEI is a screening index, not a count of unmet people; nothing here is causal.",
      "Stop and take questions.",
    ],
    qa: [
      {
        q: "Would you take food from busy shelves to fund the nine counties?",
        a: "No automatic shift. Visits show where supply is used today, and low activity may be a booking or catchment issue. We would review the nine with local partners (hours, capacity, client origins, reporting), run a bounded scenario, and only then decide on a mobile stop, a schedule change or a supply adjustment.",
        src: "q6_robust_set.csv; /manager/allocation",
      },
      {
        q: "How would you know a recommendation helped?",
        a: "Agree on the intervention and the outcome first. For a mobile stop, record reach, uptake, hours and stockouts, and compare with a pre-period or a comparison area while watching for reporting changes. Don't call FEI “improved” because a scenario moved its score. A food-security survey that includes non-users is the stronger evidence.",
      },
      {
        q: "What is the strongest policy claim you can make?",
        a: "In the reporting units, faster SNAP caseload growth goes with modestly faster growth in household visits, with no sign one replaces the other. Unusual visit months coincided with benefit disruptions, without a causal estimate. The practical request is advance notice and coordination so shelves can prepare.",
        src: "q5_panel_coefficients.csv; q5_noise_summary.csv",
      },
      {
        q: "What's the single biggest limitation?",
        a: "Need is never observed. FEI and the Q6 score are screens, nothing here is a causal effect, and the reporting network is not every provider. That is why each recommendation starts with a local check.",
      },
      {
        q: "With one more month, what would you do first?",
        a: "Reconcile high-impact county bookings and July reporting, which move both the gap and the forecast; ask the shortlisted networks about hours, catchments and non-reporting providers; and plan a household survey that includes non-users to test the need screen.",
      },
    ],
    watch: [
      "The evidence identifies associations and places to investigate, not the mechanism or effect of an intervention.",
      "August has passed; demonstrate the historical planning workflow, not a current food order.",
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
    script:
      "Need is household food insecurity over a set period, including people who never come to a shelf. The county score ranks three public inputs: Feeding America's rate, poverty and households without a car; no shelf activity enters. A household survey that includes non-users could reject the ranking if high-score counties show no meaningfully higher hardship. We would revise if one input or a new Feeding America edition moves a county by more than a fifth. No survey result is claimed today.",
    notes: ["Read the reject line aloud if asked how we would know we are wrong."],
    qa: [
      {
        q: "Is the rejection rule fixed in advance?",
        a: "It is written in the Q6 addendum, but no survey has been fielded or preregistered. We would fix sampling, weights and a useful effect size before collecting. The SNAP association is an exploratory check, not a substitute.",
        src: "docs/reference/q6_addendum.md",
      },
      {
        q: "Which flagged counties are robust?",
        a: "Six of the 14 survive every documented activity, weight, input, ACS-noise and geography perturbation: Chippewa, Lyon, Nobles, Swift, Todd and Wadena. Others depend on choices; Benton drops out when shelves are counted in their physical county. Even a robust flag is a reason to investigate, not a finding of unserved households.",
        src: "q6_robust_set.csv",
      },
      {
        q: "What do the checks on this slide show?",
        a: "The score agrees with SNAP participation (ρ 0.66), but poverty alone gets 0.62, and with poverty held fixed the partial is 0.28 (0.02 to 0.50). Consistent so far, not validated.",
        src: "q6_falsification_checks.csv",
      },
    ],
    watch: [
      "The source line calls FEI the “tract-level extension” of the Q6 score; FEI is a different five-pillar measure with a pounds-based supply input.",
    ],
    files: ["docs/reference/q6_addendum.md", "outputs/tables/q6_falsification_checks.csv"],
  },
  {
    id: "a-q7",
    speakers: ["Biruk"],
    seconds: 0,
    questions: ["Q7"],
    part: "Appendix",
    appendix: true,
    script:
      "County error over three earlier Augusts. Our weighted run rate is lower than every simple baseline in each field. The competition scores visits, pounds, children, seniors and adults; individuals is a reconciliation check. These folds also chose the rule, so the table is optimistic. Gradient boosting won only adults, so we kept the rule. The last column is how often the 80 percent band covered counties in August 2025, not a guarantee.",
    notes: ["Development error, not untouched test accuracy: the same folds chose the model."],
    qa: [
      {
        q: "Did the rule win every August?",
        a: "No. Overall RMSE favours it, but against equal weights it won only one of three Augusts for visits and for pounds. We report the aggregate because the competition scores squared county error; the per-year pattern shows the instability.",
        src: "q7_origin_check_summary.csv (august_folds)",
      },
      {
        q: "Why show individuals if it isn't submitted?",
        a: "The graduate template asks for visits, pounds and three age groups. Individuals equal the three ages summed, so we forecast it to reconcile the ages. It is an arithmetic check, not a sixth scored field.",
        src: "brief rev. 2026-09-29; D-040",
      },
      {
        q: "What do the bands mean?",
        a: "Empirical planning ranges from past forecast errors. Coverage varies by month and county size: in August 2025 the 80% band covered 81–91% of counties by field, in August 2024 only 35% for children and 54% for adults. Inspect the band and reporting status before using a county number.",
        src: "q7_interval_coverage.csv; q7_interval_coverage_by_size.csv",
      },
    ],
    watch: [
      "“Beats every simple baseline in all six fields” holds for aggregate development RMSE in this table only.",
      "“Submitted” in the title needs the G08 receipt.",
    ],
    files: ["outputs/eval/q7_backtest.csv", "outputs/eval/q7_interval_coverage.csv", "outputs/eval/q7_eval.md"],
  },
  {
    id: "a-fei",
    speakers: ["Jacob"],
    seconds: 0,
    questions: ["Q6"],
    part: "Appendix",
    appendix: true,
    script:
      "County FEI agrees with SNAP participation and Feeding America's rate, and neither is an input. The travel-and-mobility part runs against all three activity measures per low-income resident. Re-weighting keeps the county ranking close; counting shelves instead of pounds for supply moves it the most. Pounds do enter the supply pillar, so FEI is a barrier-and-supply screen. These checks justify where to look, not individual need or a causal effect.",
    notes: [
      "Weights are policy choices; the ranking survives re-weighting.",
      "If asked why multiply: access barriers matter where there is need, as in USDA's low-income and low-access tracts; under the old sum, 16% of top-fifth tracts had below-median need (now 5%), and supply drove 43% of the score's variation at a 25% weight.",
    ],
    qa: [
      {
        q: "What is your strongest independent check?",
        a: "SNAP participation, not an input: county ρ 0.59 (0.40 to 0.73) over 82 SNAP units. Feeding America's rate, also excluded: 0.85 (0.76 to 0.90) over 87 counties. Both share hardship factors with FEI, so neither shows a high-score tract holds unserved households. A household survey is still needed.",
        src: "fei_validation.csv",
      },
      {
        q: "How sensitive is FEI to weights and the supply definition?",
        a: "Without race: county ρ 0.99, all 18 top-fifth counties kept. Equal weights: 0.98, 17 of 18. Supply as a shelf count instead of pounds: 0.82, 15 of 18, the biggest change, because pounds are both capacity and observed distribution. Show that variant before prioritizing a county.",
        src: "fei_sensitivity.csv",
      },
      {
        q: "Isn't comparing FEI with activity circular?",
        a: "For the full score, partly, because supply uses pounds. That is why the activity rows use only the travel and mobility pillars. The SNAP and Feeding America checks have neither series as an input.",
        src: "fei_validation.csv (access_TM rows)",
      },
    ],
    watch: [
      "The title says FEI “agrees with need signals it never used”: true for SNAP and Feeding America, but pounds are an input, so the full FEI against activity is not an independent test.",
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
    script:
      "The sponsor supplied the food-shelf records; the challenge specified Map the Meal Gap, food prices and SNAP. Beyond those, the sources that changed our answers are Census income, poverty and population, USDA's low-income, low-access flags, CDC vulnerability measures and a routed road network. The catalog records publisher, series, geography, period, lag and why each was chosen, and we keep vintages visible, especially 2019 LILA.",
    notes: ["Provided data first, then the additional sources the rubric scores (D-058)."],
    qa: [
      {
        q: "Which sources count as additional under the final rubric?",
        a: "The rubric asks for sources beyond Map the Meal Gap, food prices and SNAP enrollment. Ours: Census ACS and 2020 blocks, USDA's Food Access Research Atlas, SNAP Retailer Access Map and rural-urban codes, CDC SVI, BLS county unemployment, HUD rents and OpenStreetMap roads routed with OSRM. School-meal data is labelled provided. The catalog separates inputs from context.",
        src: "docs/sources/catalog.md; Rubric_Graduate_Final.pdf; D-058",
      },
      {
        q: "Which source changed your answer most?",
        a: "Census ACS and 2020 block counts (the need inputs and every per-resident rate), USDA's LILA flag (all of Q8), CDC SVI (FEI's tract detail) and the road network (driving distance). Lead with those, not the length of the list.",
      },
      {
        q: "How did you avoid stale or licensed-data mistakes?",
        a: "2023 food insecurity uses Feeding America's corrected 2025 edition (v2) and 2024 the 2026 edition; an edition's title is not its data year. The licensed workbook is cited, never redistributed. Every catalog row has the exact series, vintage, access date and why it was chosen.",
        src: "D-025, D-026; data/external/map_the_meal_gap/README.md",
      },
    ],
    watch: ["Some listed sources are context or cross-checks, not inputs to a scored result."],
    files: ["docs/sources/catalog.md"],
  },
];

export const MAIN_SLIDES = SLIDES.filter((s) => !s.appendix);
export const FIRST_APPENDIX = SLIDES.findIndex((s) => s.appendix);
export const TALK_SECONDS = MAIN_SLIDES.reduce((s, x) => s + x.seconds, 0);

export const WORDS_PER_MINUTE = 130;

/** Spoken seconds for a script at WORDS_PER_MINUTE, leaving out [cues] and "Name:" hand-overs. */
export function scriptSeconds(script: string): number {
  const spoken = script.replace(/\[[^\]]*\]/g, " ").replace(/\b(?:Jacob|Daniela|Biruk|Roshit):/g, " ");
  const words = spoken.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return (60 * words) / WORDS_PER_MINUTE;
}

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

export const clock = (sec: number) => {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export interface RunRateStep {
  month: string;
  value: number;
  workdays: number;
  perDay: number;
  weight: number;
}

/** The D-045 rule worked through on the statewide series, for the forecast slide. */
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
  recent3_weighted: "Same, weighted 1:2:3 (selected)",
};
