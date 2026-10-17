/** Expanded rehearsal explanations. Keep the timed script in presentation.ts short.
 * These notes describe the current D-069 bundle and D-070 scenario corrections. */
export const PRESENTER_DETAILS: Record<string, { label: string; explain: string[]; transition: string }> = {
  title: {
    label: "The decision problem",
    explain: [
      "A recorded visit tells us that a household reached a reporting provider. It cannot tell us how many households needed help but did not arrive. Pounds describe distribution and available supply; individuals describe people served. Keep those three signals separate throughout the talk.",
      "The national survey establishes context. Its food-insecurity and charitable-food measures are not complementary categories, so subtracting the bars would not estimate unserved people. Our Minnesota analysis asks where activity and independent need screens disagree, then identifies what local evidence would resolve that disagreement.",
    ],
    transition: "First, we make the access barriers visible.",
  },
  fei: {
    label: "How FEI works",
    explain: [
      "Move through the five layers one at a time. Need combines hardship and demographic vulnerability; access combines supply scarcity, travel and mobility. The geometric mean reduces the ability of one side to compensate for the other. It is not a rule requiring both sides to exceed a threshold, and the weights are policy choices rather than estimated causal effects.",
      "Reported pounds enter the supply pillar. FEI therefore cannot be described as independent of all activity. The separate county Q6 score excludes visits, pounds and individuals. Neither score estimates a number of hungry households: they answer different screening questions at different geographic scales.",
    ],
    transition: "Daniela will show where the barriers cluster and what we would check locally.",
  },
  "fei-map": {
    label: "Where barriers cluster",
    explain: [
      "Read the map as a comparison between places, not a diagnosis of every person living there. The highest fifth refers to scored tracts; it does not mean one fifth of residents. Quote the resident and child counts shown on this current slide, because they changed when the FEI aggregation changed.",
      "Shelf symbols show the reporting footprint and researched coordinates. They do not establish hours, capacity, eligibility or the presence of every provider. County agreement with SNAP or modeled food insecurity is a consistency check with overlapping social factors, not independent household validation.",
    ],
    transition: "Our separate county need definition tells us what evidence could prove the screen wrong.",
  },
  q6: {
    label: "A falsifiable need screen",
    explain: [
      "State all four parts: need includes non-users; the county score excludes shelf activity; an independent survey could reject the ranking; and unstable inputs or contradictory field evidence would trigger revision. Poverty overlaps conceptually with the Feeding America model, so three inputs do not provide three independent confirmations.",
      "A rejection test needs a sampling plan, a fixed food-security recall period and a meaningful difference specified before collecting data. If the confidence interval rules out that difference, reject the ranking hypothesis. A wide interval is inconclusive. No such survey has been run, and SNAP agreement cannot replace it.",
    ],
    transition: "Now compare estimated need with the three recorded activity measures.",
  },
  q1: {
    label: "Activity versus estimated need",
    explain: [
      "First show totals, then change to per-resident rates. County size contributes strongly to the total-count agreement. The near-zero rate associations mean that the total relationship should not be read as evidence that activity identifies need reliably. The confidence ranges overlap, so do not declare pounds decisively superior to visits or individuals.",
      "Treat outliers as data and service-area checks. Scott's county booking issue is documented; the claim that other high-activity counties draw neighbors is a hypothesis until client origins are known. We analyzed the full required multi-year window even though the slide uses one year to keep the visual legible.",
    ],
    transition: "Activity can also look different where access is harder.",
  },
  divergence: {
    label: "Barriers and recorded activity",
    explain: [
      "The comparison uses travel and mobility, excluding the pounds-derived supply pillar. Higher barriers accompany lower activity per lower-income resident. That association is consistent with several mechanisms, including transport, reporting and cross-county catchments; it does not identify a causal reduction in visits or a count of people denied access.",
      "The overlap list is a repeatable place to start calls. The underlying Q6 flag count was not beyond the random-pairing comparison. Ask local partners about reporting, hours, language, eligibility and other providers before discussing a supply change.",
    ],
    transition: "The grocery-access geography provides another, differently measured view of access.",
  },
  q8: {
    label: "Grocery access and shelf reach",
    explain: [
      "Presence asks whether a reporting shelf is inside a tract. Distance asks how far residents are from the nearest reporting shelf, including across a tract border. Those are different measures, and neither establishes that a household can use the service. The raw presence contrast is weaker evidence than the distance comparison.",
      "Name both vintages: USDA's grocery-access flag and the reporting-shelf footprint are from different years. State whether each bar uses straight-line or road miles. Routing adds road geometry, but not transit, congestion, opening times or service eligibility. Local catchments and feasible alternatives still need checking.",
    ],
    transition: "Geography is one constraint; next we test whether changing prices help explain the timing.",
  },
  q4: {
    label: "Prices and the calendar",
    explain: [
      "Distinguish rising levels from month-to-month changes. Two series can trend upward without one providing a useful early warning. The selected one-month individuals association changes when early 2022 is removed; visits and pounds are less clear. The interval from the selected model does not include uncertainty from choosing that model or lag.",
      "The practical result is to examine working days and recent activity when planning. The calendar coefficient is an association, not proof that opening one extra day causes the stated increase. Regional CPI gives context but has not demonstrated reliable county forecasting value in this analysis.",
    ],
    transition: "We also examined SNAP, using its actual reporting geography.",
  },
  q5: {
    label: "SNAP and shelf activity",
    explain: [
      "The controlled model compares changes within reporting units while accounting for common month effects and listed controls. The visits association is clearer than pounds or individuals. It does not link households, so it cannot establish whether a particular family substitutes one service for another.",
      "Benefit events coincided with unusual activity months. A ranking of unusual months is not an identified policy effect. Joint county units and separate tribal agencies remain in their proper administrative geography; we do not allocate their caseloads to host counties. The operational request is advance notice and coordinated preparation.",
    ],
    transition: "Biruk will show the forecast we can reproduce from information through July.",
  },
  q7: {
    label: "Forecast result and method",
    explain: [
      "For each county and field, divide May, June and July totals by each month's working days. Multiply those rates by one, two and three, divide by six, then multiply by August's working days. When a report is missing, keep the calendar position and renormalize the observed weights; never replace missing with a reported zero or reach back to an older month.",
      "The earlier August folds informed model choice, so the error comparison is development evidence. It is not known accuracy for the target August. Age predictions are scaled to add to the internal individuals forecast. Wilkin's template zero is an organizer convention; the analytical forecast remains unknown. Historical bands have uneven coverage, especially for children, and are planning ranges rather than guaranteed probabilities.",
    ],
    transition: "Roshit, show how a manager can inspect these assumptions in FoodBridge.",
  },
  demo: {
    label: "FoodBridge demonstration",
    explain: [
      "Roshit: open one county and name the reporting cutoff. In the sample portal, say county network before showing a forecast; this is not a validated individual-shelf forecast. Avoid reading every card. Show one action and the evidence behind it, then hand over.",
      "Jacob: place a site and show the assumption controls. Additional visits and additional network food start at zero; a county correlation cannot determine either. Avoided travel belongs to shifted visits, while new visits add travel. In allocation, show the pool and reserve, then explain that a need weight is a planning choice. Saving a draft does not move food. Return to the deck with Back; if routing fails, identify the straight-line fallback and continue.",
    ],
    transition: "The tool supports four checks before action; it does not establish that the intervention worked.",
  },
  close: {
    label: "What to do next",
    explain: [
      "Compare activity with need screens before allocating; investigate flagged places before siting; coordinate with SNAP administrators before disruptions; measure access, reporting and actual uptake separately. Avoid promising that shifting a model score has reduced food insecurity.",
      "The first follow-up is to verify high-impact county bookings and reporting completeness, then discuss hours and catchments with local partners. A pilot with predefined outcomes and a relevant comparison can test a service change. A household survey including non-users is needed to test hidden need. End with the proposed checks, not an unmeasured benefit claim.",
    ],
    transition: "Thank you. We can open the method, forecast or source appendix for questions.",
  },
  "a-q6": {
    label: "Q6 methods and rejection tests",
    explain: [
      "Keep the construct and test separate. The county index ranks external inputs; it is not a measured food-insecurity prevalence or the five-pillar FEI. A non-user survey tests the hidden-need claim independently of recorded use.",
      "Report both sensitivity and uncertainty. A county can remain on a list under alternative weights while the overall flag count is consistent with chance. Stability helps organize follow-up; it does not establish statistical significance or the correct allocation.",
    ],
    transition: "The next appendix covers forecasting and its uncertainty.",
  },
  "a-q7": {
    label: "Forecast validation",
    explain: [
      "Read the units before comparing errors: visits, pounds and age-group counts have different scales. The table compares methods within each field over historical August development folds. Aggregate RMSE can favor a model that loses in individual years, especially when large counties dominate squared errors.",
      "Calibration uses preceding outcomes, but the study does not have historical database snapshots proving which reports had arrived at each old origin. Rebuilding repairs at the cutoff prevents future rows entering that fold; it cannot reconstruct publication vintages. Preserve the frozen point rule and test future operational forecasts prospectively before promoting a challenger.",
    ],
    transition: "Use the empirical coverage table to discuss uncertainty, without promising nominal coverage.",
  },
  "a-fei": {
    label: "FEI consistency and sensitivity",
    explain: [
      "Consistency with SNAP and modeled food insecurity is useful, but their socioeconomic drivers overlap FEI inputs. A stronger rank correlation after changing the formula is not an independent validation if that correlation was considered during development.",
      "State the current aggregation and show the alternative-weight and supply-definition checks. Nominal weights are not fixed shares of score variation, and a geometric mean does not make components independent. The score remains a relative screen for local investigation, with no household-level or intervention-effect validation.",
    ],
    transition: "The final appendix identifies sources, vintages and what each contributes.",
  },
  "a-sources": {
    label: "Sources and provenance",
    explain: [
      "Lead with sources that changed an answer, not the length of the source list. Distinguish challenge-specified inputs from additional geographic, Census and vulnerability data. State the publisher, geographic unit, data year and publication lag where relevant.",
      "A dataset's edition year is not its measurement year. The catalog records those differences and licensing limits. Cached reproduction and leakage guards are strengths, but neither proves that July reporting was complete or that all historical data were available in real time.",
    ],
    transition: "Return to the question the judge asked and state the remaining uncertainty directly.",
  },
};
