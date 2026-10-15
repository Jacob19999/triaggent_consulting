/* FoodBridge · a local operations workspace, grounded in published research outputs. */
(() => {
  "use strict";
  const D = window.FOODBRIDGE_DATA,
    C = window.FoodBridge;
  if (!D || !C) return;
  const $ = (s) => document.querySelector(s);
  $(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    $("#main").focus();
    $("#main").scrollIntoView();
  });
  const esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = (x, digits = 0) =>
    x == null || !Number.isFinite(x)
      ? "Unavailable"
      : x.toLocaleString("en-US", {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        });
  const compact = (x) =>
    x == null
      ? "Unavailable"
      : x >= 1e6
        ? `${fmt(x / 1e6, 2)}M`
        : x >= 1e3
          ? `${fmt(x / 1e3, 1)}k`
          : fmt(x);
  const signed = (x) => (x == null ? "—" : (x > 0 ? "+" : "") + fmt(x, 1));
  const label = {
    HouseholdsTotal: "Visits",
    PoundsTotal: "Pounds distributed",
    IndividualsTotal: "Individuals served",
    ChildrenTotal: "Children served",
    AdultsTotal: "Adults served",
    SeniorsTotal: "Seniors served",
  };
  const SIGNALS = ["HouseholdsTotal", "PoundsTotal", "IndividualsTotal"];
  const ALL = [...SIGNALS, "ChildrenTotal", "AdultsTotal", "SeniorsTotal"];
  const paths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
    plan: "M4 7h16M7 4v6M4 17h16m-7-3v6",
    check: "M9 4H4v16h16V9M9 12l4 4L22 5",
    book: "M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2V3Z",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    chevron: "m9 5 7 7-7 7",
    plus: "M12 4v16M4 12h16",
    search: "M21 21l-6-6M17 10A7 7 0 1 1 3 10a7 7 0 0 1 14 0",
    close: "m6 6 12 12M6 18 18 6",
    info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    leaf: "M4 20C0 4 14 2 21 3c1 11-5 19-17 17ZM4 20 16 8",
    people:
      "M16 21v-3c0-5-12-5-12 0v3M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-3c5 0 5 7 0 7m1 4c3 1 3 3 3 6",
    box: "m3 7 9-4 9 4-9 4-9-4Zm0 0v11l9 4 9-4V7M12 11v11M8 5l9 4",
    clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-5 10 3 3 7-7",
    print: "M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M9 10v7m6-7v7",
    refresh:
      "M21 5v6h-6M3 19v-6h6M5 7a8 8 0 0 1 13-3l3 7M3 13l3 7a8 8 0 0 0 13-3",
  };
  function icon(name) {
    return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
  }
  document
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  const key = "foodbridge.workspace.v1";
  let storageIssue = "",
    recoveryRaw = null,
    state = C.emptyState();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      recoveryRaw = raw;
      state = C.validateState(JSON.parse(raw), D.counties);
      recoveryRaw = null;
    }
  } catch {
    storageIssue = recoveryRaw
      ? "The saved workspace could not be read. Export a recovery backup, then restore a valid workspace. Changes will remain in this session."
      : "Browser storage is unavailable. Export a backup before closing this page.";
  }
  let page = "overview",
    chartSignal = "IndividualsTotal",
    countySearch = "",
    countyFilter = "all",
    accessYear = "2024";
  let planner = { total: 100000, reserve: 10, needWeight: 0, ids: [], name: "" };
  let planResult = null,
    toastTimer,
    confirmationCallback = null;
  const sourceVersion = `${D.meta.research_version} / Q7 ${D.meta.forecast_target}`;
  const county = (id) => D.counties.find((c) => c.fips === id);
  const today = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  function save(message) {
    try {
      if (recoveryRaw) throw new Error("Recovery required");
      localStorage.setItem(key, JSON.stringify(state));
      storageIssue = "";
      $("#storage-label").textContent =
        "Saved on this browser · export backups to keep your work";
      toast(message);
    } catch {
      storageIssue ||=
        "Browser storage is unavailable. Export a backup before closing this page.";
      $("#storage-label").textContent =
        "Session only · export a backup before closing";
      toast(
        "Kept in this session only. Export a backup to preserve your changes.",
      );
    }
    updateCount();
  }
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("toast-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("toast-visible"),
      5000,
    );
  }
  function updateCount() {
    $("#action-count").textContent = state.actions.filter(
      (a) => a.status !== "Completed",
    ).length;
  }
  function download(name, content, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function backup() {
    download(
      `foodbridge-${recoveryRaw ? "recovery-" : ""}${today()}.json`,
      recoveryRaw ||
        JSON.stringify(
          { ...state, exportedAt: new Date().toISOString() },
          null,
          2,
        ),
      "application/json",
    );
    toast(
      recoveryRaw ? "Recovery copy exported." : "Workspace backup exported.",
    );
  }
  $("#backup-button").addEventListener("click", backup);
  function confirmAction(title, body, button, callback) {
    confirmationCallback = callback;
    $("#confirm-dialog").innerHTML =
      `<div class="dialog-body"><h2 id="confirm-title">${esc(title)}</h2><p>${esc(body)}</p></div><div class="dialog-actions"><button class="button" data-action="close-confirm">Cancel</button><button class="button primary" data-action="confirm">${esc(button)}</button></div>`;
    $("#confirm-dialog").showModal();
  }
  function badge(c) {
    return c.minimum_gap == null
      ? '<span class="pill gray">Incomplete evidence</span>'
      : c.stable
        ? '<span class="pill green">Stable review flag</span>'
        : c.review
          ? '<span class="pill amber">Review flag</span>'
          : '<span class="pill gray">Routine review</span>';
  }
  function header(eyebrow, title, subtitle, button = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${button}</div>`;
  }
  function button(action, title, ico = "arrow", extra = "", cls = "") {
    return `<button class="button ${cls}" data-action="${action}" ${extra}>${icon(ico)}${title}</button>`;
  }
  function kpi(title, value, note, ico = "overview", unit = "") {
    return `<div class="kpi"><div class="kpi-label">${title}${icon(ico)}</div><div class="kpi-number">${value}${unit ? `<span>${unit}</span>` : ""}</div><div class="kpi-note">${note}</div></div>`;
  }
  function note() {
    return `<div class="snapshot-note">${icon("info")}<span>Statewide food_shelf_broad network · observed through July 2026 · research build ${esc(D.meta.research_version)}. Forecasts describe reported activity; they do not measure unmet need.</span></div>`;
  }
  function map() {
    const geometries = D.counties.filter((c) => c.geometry);
    if (!geometries.length)
      return '<div class="empty-state"><p>County geometry is unavailable. Use the county explorer below; rebuild the cached map to restore this view.</p></div>';
    const project = ([lon, lat]) => [
      lon * Math.cos((46.5 * Math.PI) / 180),
      -lat,
    ];
    const rings = (g) =>
      g.type === "Polygon" ? g.coordinates : g.coordinates.flat(1);
    const points = geometries.flatMap((c) =>
      rings(c.geometry).flat().map(project),
    );
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const minX = Math.min(...xs),
      minY = Math.min(...ys),
      w = Math.max(...xs) - minX,
      h = Math.max(...ys) - minY;
    const scale = Math.min(335 / w, 285 / h);
    const ox = (560 - w * scale) / 2,
      oy = (305 - h * scale) / 2;
    const path = (g) =>
      rings(g)
        .map(
          (r) =>
            r
              .map((p, i) => {
                const [x, y] = project(p);
                return `${i ? "L" : "M"}${(ox + (x - minX) * scale).toFixed(1)},${(oy + (y - minY) * scale).toFixed(1)}`;
              })
              .join(" ") + "Z",
        )
        .join(" ");
    return `<div class="map-container"><div class="map-label">MINNESOTA<br>COUNTY REVIEW SCREEN</div><svg class="county-map" viewBox="0 0 560 305" role="group" aria-label="Minnesota county screening map; each county opens its evidence">${geometries.map((c) => `<path d="${path(c.geometry)}" fill="${c.minimum_gap == null ? "#d9dddb" : c.stable ? "#4b7850" : c.review ? "#bdcd8c" : "#e4ebda"}" fill-rule="evenodd" role="button" tabindex="0" data-action="county" data-id="${c.fips}" aria-label="${esc(c.name)}, ${c.stable ? "stable review flag" : c.review ? "review flag" : c.minimum_gap == null ? "incomplete evidence" : "routine review"}"><title>${esc(c.name)} · ${c.minimum_gap == null ? "incomplete evidence" : `minimum divergence ${signed(c.minimum_gap)} pp`}</title></path>`).join("")}</svg><div class="map-caption">Choose a county<br>to understand its evidence ${"↗"}</div></div><div class="map-legend"><span><i class="legend-swatch" style="--swatch:#4b7850"></i>Stable review flag</span><span><i class="legend-swatch" style="--swatch:#bdcd8c"></i>Review flag</span><span><i class="legend-swatch" style="--swatch:#e4ebda"></i>Routine</span><span><i class="legend-swatch" style="--swatch:#d9dddb"></i>Incomplete</span></div>`;
  }
  function chart() {
    const rows = D.history.slice(-18),
      values = rows.map((r) => r[chartSignal]),
      max = Math.max(...values.filter((v) => v != null)) * 1.1;
    const w = 540,
      h = 125,
      bw = 18,
      space = w / rows.length;
    return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h + 20}" role="img" aria-label="${label[chartSignal]}, statewide reported monthly activity from February 2025 to July 2026"><title>${label[chartSignal]} · ${chartSignal} · monthly sums, food_shelf_broad</title>${[0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" y1="${h * (1 - f)}" x2="${w}" y2="${h * (1 - f)}" stroke="#eef1e7" stroke-dasharray="3 4"/>`).join("")}${rows
      .map((r, i) => {
        const v = r[chartSignal];
        return v == null
          ? ""
          : `<rect x="${i * space + 6}" y="${h - (h * v) / max}" width="${bw}" height="${(h * v) / max}" rx="3" fill="${i === rows.length - 1 ? "#406e48" : "#c5d5ae"}"><title>${esc(r.month_start.slice(0, 7))}: ${fmt(v)} ${esc(chartSignal)}</title></rect>`;
      })
      .join(
        "",
      )}<text x="${w}" y="9" text-anchor="end" font-size="9" fill="#8e9b7f">${compact(max)}</text></svg></div><div class="chart-labels"><span>FEB 2025</span><span>JUL 2025</span><span>JAN 2026</span><span>JUL 2026</span></div>`;
  }
  function overview() {
    const s = D.summary,
      priorities = D.counties.filter((c) => c.review).slice(0, 6);
    return (
      header(
        "From evidence to action",
        "Make every decision count.",
        "A clearer view of where to investigate, what to plan, and what happens next.",
        button(
          "navigate",
          "Open supply planner",
          "plan",
          'data-page="planner"',
          "primary",
        ),
      ) +
      `<section class="hero"><div class="hero-copy"><div class="hero-tag">${icon("leaf")} A more complete picture of need</div><h2>Look beyond the busiest food shelves.</h2><p>County activity and estimated need tell different stories. Start with a local review, plan with the evidence, and keep track of what you learn.</p></div><div class="hero-steps"><div class="hero-step"><span>01</span>Review</div><i></i><div class="hero-step"><span>02</span>Plan</div><i></i><div class="hero-step"><span>03</span>Follow through</div></div></section>
      <div class="kpis">${kpi("Counties to investigate", fmt(s.review), `<strong>${s.stable} stable</strong> across all activity variants`, "map")}${kpi("LILA tracts without a site", fmt(s.without_site_2024), `Of ${s.lila_2024} LILA tracts · 2024 footprint`, "leaf")}${kpi("August 2026 forecast", compact(s.forecast.PoundsTotal), `${s.forecast_counties} counties · PoundsTotal · internal`, "box", "lb")}${kpi("Open follow-up actions", fmt(state.actions.filter((a) => a.status !== "Completed").length), "Your local workspace · assigned by staff", "check")}</div>
      <div class="grid-main"><section class="panel"><div class="panel-head"><div><h2>Where to take a closer look</h2><p>Q6 screening evidence · 2024 activity</p></div><span class="pill">${s.counties} counties</span></div>${map()}</section>
      <section class="panel"><div class="panel-head"><div><h2>Start the conversation</h2><p>Stable flags, ordered by minimum divergence</p></div></div><div class="priority-list">${priorities.map((c, i) => `<button class="priority-row" data-action="county" data-id="${c.fips}"><span class="rank">${String(i + 1).padStart(2, "0")}</span><div><div class="county-name">${esc(c.name)} County</div><div class="county-meta">${c.nonmetro ? "Nonmetro" : "Metro"} · ${c.variant_flags}/${D.meta.variants.length} variants flagged</div></div><div class="gap">${signed(c.minimum_gap)}<small>percentile points</small></div>${icon("chevron")}</button>`).join("")}</div><div class="panel-foot"><button class="text-link" data-action="review-counties">Explore all ${s.review} review counties ${icon("arrow")}</button></div></section></div>
      <div class="bottom-grid"><section class="panel"><div class="panel-head"><div><h2>Keep throughput in view</h2><p>Recent statewide activity · observed monthly totals</p></div><select class="select-compact" id="chart-signal" aria-label="Activity chart signal">${SIGNALS.map((s) => `<option value="${s}" ${s === chartSignal ? "selected" : ""}>${label[s]}</option>`).join("")}</select></div><div id="activity-chart">${chart()}</div><div class="panel-foot">${esc(chartSignal)} · source: q4_state_month.csv · partial reports may understate activity</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Make the next step visible</h2><p>Close the loop with your team’s findings</p></div></div><div class="next-step"><div class="round-icon">${icon("check")}</div><div><h3>Turn a county flag into a review</h3><p>Check reporting, discuss service barriers, and record what you found. A flag is a reason to ask better questions.</p><button class="text-link" data-action="new-action">Create a follow-up ${icon("arrow")}</button></div></div><div class="panel-foot">Saved in this browser. Export a workspace backup for handoff.</div></section></div>${note()}`
    );
  }
  function filteredCounties() {
    const q = countySearch.trim().toLowerCase();
    return D.counties.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || c.fips.includes(q)) &&
        (countyFilter === "all" ||
          (countyFilter === "review" && c.review) ||
          (countyFilter === "stable" && c.stable) ||
          (countyFilter === "nonmetro" && c.nonmetro) ||
          (countyFilter === "missing" && c.minimum_gap == null)),
    );
  }
  function countyRows() {
    const rows = filteredCounties();
    return rows.length
      ? rows
          .map(
            (c) =>
              `<tr><td><button class="county-button" data-action="county" data-id="${c.fips}">${esc(c.name)}</button><div class="field-name">${c.nonmetro ? "Nonmetro" : "Metro"} · ${c.fips}</div></td><td>${badge(c)}</td>${SIGNALS.map((s) => `<td class="number-cell">${signed(c.gaps[s])}</td>`).join("")}<td class="number-cell">${fmt(c.access[accessYear].lila_without_site)}</td><td class="number-cell">${fmt(c.forecast.PoundsTotal.yhat)}</td><td><button class="icon-button" title="Review ${esc(c.name)}" aria-label="Review ${esc(c.name)}" data-action="county" data-id="${c.fips}">${icon("arrow")}</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="8"><div class="empty-state"><h3>No counties match</h3><p>Try another name or change the review filter.</p></div></td></tr>';
  }
  function countiesPage() {
    return (
      header(
        "County explorer",
        "See the evidence behind the flag.",
        "Compare all three signals, then open a county to decide what deserves a closer look.",
        button("export-counties", "Export this view", "download"),
      ) +
      `<div class="callout">${icon("info")}<span><strong>Percentile gaps are screening signals.</strong> Positive values mean the need ranking is higher than the activity-rate ranking. They are not missing people or missing pounds. Missing evidence stays unavailable.</span></div><section class="panel"><div class="toolbar"><div class="search-box">${icon("search")}<input id="county-search" aria-label="Search counties" placeholder="Find a county or FIPS…" value="${esc(countySearch)}"></div><select id="county-filter" aria-label="County review filter">${[
        ["all", "All counties"],
        ["review", "Review flags"],
        ["stable", "Stable review flags"],
        ["nonmetro", "Nonmetro counties"],
        ["missing", "Incomplete evidence"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${countyFilter === v ? "selected" : ""}>${t}</option>`,
        )
        .join(
          "",
        )}</select><select id="access-year" aria-label="Reporting footprint year"><option value="2024" ${accessYear === "2024" ? "selected" : ""}>2024 footprint</option><option value="2026" ${accessYear === "2026" ? "selected" : ""}>Jan–Jul 2026 footprint</option></select><span class="filter-count" id="filter-count">${filteredCounties().length} counties</span></div><div class="table-scroll"><table><thead><tr><th>County</th><th>Review screen</th><th class="number-cell">Household gap<br><small>percentile points</small></th><th class="number-cell">Pounds gap<br><small>percentile points</small></th><th class="number-cell">Individual gap<br><small>percentile points</small></th><th class="number-cell">LILA tracts<br><small>without a site</small></th><th class="number-cell">Aug forecast<br><small>PoundsTotal</small></th><th><span class="muted">Open</span></th></tr></thead><tbody id="county-rows">${countyRows()}</tbody></table></div><div class="panel-foot">Gaps: HouseholdsTotal / PoundsTotal / IndividualsTotal · Q6 2024 activity. Footprint: USDA 2019 flags, 2020 tracts, selected reporting year. Forecast: August 2026 internal estimate; open a county for intervals. Source: q6_need_index.csv, q8_county_footprint_gaps.csv, q7_august2026_wide.csv.</div></section>${note()}`
    );
  }
  function refreshCountyRows() {
    $("#county-rows").innerHTML = countyRows();
    $("#filter-count").textContent = `${filteredCounties().length} counties`;
  }
  function openCounty(id) {
    const c = county(id);
    if (!c) return;
    const fc = c.forecast,
      access = c.access[accessYear];
    $("#county-dialog").innerHTML =
      `<div class="dialog-head"><div><div class="eyebrow">County evidence · ${c.fips}</div><h2 id="county-title">${esc(c.name)} County</h2><p>${c.nonmetro ? "Nonmetro" : "Metro"} · USDA RUCC 2023 · ${badge(c)}</p></div><button class="icon-button" data-action="close-county" aria-label="Close county evidence">${icon("close")}</button></div><div class="dialog-body">
      <div class="callout">${icon("info")}<span>${c.minimum_gap == null ? "There is not enough complete annual activity to calculate this county’s divergence. Investigate reporting before interpreting the gap." : c.review ? `Flagged in ${c.variant_flags} of ${D.meta.variants.length} tested activity variants. Start by verifying reporting and talking with local partners about access and capacity.` : "This county is outside the declared Q6 review screen. That does not establish that local needs are being met."}</span></div>
      <section class="dialog-section"><h3>Need ranking versus activity ranking</h3><p class="helper">2024 comparison · need percentile ${fmt(c.need_percentile, 1)} · external-only, unvalidated need screen</p>${SIGNALS.map((s) => `<div class="gap-row"><span>${label[s]}</span><div class="gap-axis">${c.gaps[s] == null ? "" : `<span class="${c.gaps[s] < 0 ? "negative" : ""}" style="left:${c.gaps[s] < 0 ? 50 + c.gaps[s] / 2 : 50}%;width:${Math.abs(c.gaps[s]) / 2}%"></span>`}</div><strong>${signed(c.gaps[s])}</strong></div>`).join("")}<div class="gap-scale"><span>−100</span><span>0</span><span>+100 pp</span></div><p class="content-note">Need percentile minus each activity-rate percentile. Review screen: above-median need and &gt;25 pp in every signal. Weight alternatives shift this county’s need rank across ${fmt(c.weight_rank_range)} positions. Source: q6_need_index.csv; ACS 2019–2023, MMG 2026 (2024 estimates).</p></section>
      <section class="dialog-section"><h3>What the reporting network recorded in 2024</h3><div class="kpis">${SIGNALS.map((s) => kpi(label[s], compact(c.annual[s]), `${c.coverage[s].observed}/12 months observed · ${c.coverage[s].complete}/12 fully measured`, s === "PoundsTotal" ? "box" : "people")).join("")}</div><p class="helper">Visits are HouseholdsReg (D-039); individuals served (IndividualsReg) counts people at each visit, not unique people. Annual totals require twelve observed months; partial within-month reporting remains included. Source: q1_county_concentration.csv and q1_annual_coverage.csv.</p></section>
      <section class="dialog-section"><h3>Access evidence · ${accessYear === "2024" ? "2024" : "January–July 2026"} reporting footprint</h3><div class="data-grid"><div class="data-card"><strong>${fmt(access.lila_without_site)} <span>of ${fmt(access.lila_tracts)} LILA tracts</span></strong><p>Have no reporting site within the tract.</p></div><div class="data-card"><strong>${fmt(c.sites_2024)} <span>reporting sites in 2024</span></strong><p>Historical presence does not establish current capacity.</p></div></div><p class="content-note">USDA 2019 LILA · one urban mile / ten rural miles to large retailers · dominant-area transfer from 2010 to 2020 tracts. Cross-tract service, hours and travel barriers are unmeasured. Source: q8_county_footprint_gaps.csv.</p></section>
      <section class="dialog-section"><h3>August 2026 · internal forecast</h3><p class="helper">Historical planning example, trained through July 2026. Nominal empirical bands undercovered in backtests; July completeness is unknown.</p><div class="table-scroll"><table class="forecast-table"><thead><tr><th>Signal</th><th class="number-cell">Point</th><th class="number-cell">80% band</th><th class="number-cell">95% band</th></tr></thead><tbody>${ALL.map((s) => `<tr><td>${label[s]}<div class="field-name">${s}</div></td><td class="number-cell">${fmt(fc[s].yhat)}</td><td class="number-cell">${fc[s].yhat == null ? "Unavailable" : `${fmt(fc[s].lo80)}–${fmt(fc[s].hi80)}`}</td><td class="number-cell">${fc[s].yhat == null ? "Unavailable" : `${fmt(fc[s].lo95)}–${fmt(fc[s].hi95)}`}</td></tr>`).join("")}</tbody></table></div><p class="content-note">Model: the last three months' activity per working day, weighted 1:2:3 toward July (D-045); ages reconciled before display rounding. Source: q7_august2026_wide.csv · food_shelf_broad. The organizer file is filled from these points (mi.submission); Wilkin is submitted as 0.</p></section>
      <div class="callout">${icon("check")}<span><strong>A useful next conversation:</strong> Are reports complete? Do residents travel across county or tract lines? Which hours, transport or food preferences create barriers? What would local partners need to test an improvement?</span></div></div><div class="dialog-actions"><span class="helper">${state.actions.filter((a) => a.county === c.fips).length} saved follow-up actions</span><div class="inline-actions">${button("add-planner", "Add to supply scenario", "plus", `data-id="${c.fips}" ${fc.PoundsTotal.yhat == null ? "disabled" : ""}`)}${button("new-action", "Create follow-up", "check", `data-id="${c.fips}"`, "primary")}</div></div>`;
    if (!$("#county-dialog").open) $("#county-dialog").showModal();
  }
  function plannerPage() {
    return (
      header(
        "Supply planner",
        "Explore a plan before committing food.",
        "Select counties you have reviewed, enter an available pool, and compare a transparent scenario.",
        button(
          "navigate",
          "Review county evidence",
          "map",
          'data-page="counties"',
        ),
      ) +
      `<div class="callout amber">${icon("info")}<span><strong>Hypothetical scenario using the August 2026 forecast.</strong> This divides a user-entered pool in proportion to forecast PoundsTotal for selected counties, optionally blended with each county's share of residents below poverty. It does not measure unmet need, optimize allocations, account for inventory commitments, or dispatch food. Confirm local capacity and commitments before using a plan.</span></div>
    <div class="planner-layout"><section class="panel"><div class="panel-head"><h2>Your planning assumptions</h2></div><div class="panel-body"><div class="form-field"><label for="plan-name">Scenario name</label><input id="plan-name" maxlength="120" placeholder="e.g. Mobile outreach planning" value="${esc(planner.name)}"></div><div class="form-field"><label for="plan-total">Available food pool · whole pounds</label><input id="plan-total" type="number" min="1" max="1000000000" step="1" value="${planner.total}"><small>User-entered scenario, not live inventory.</small></div><div class="form-field"><label for="plan-reserve">Hold in reserve <span id="reserve-label">${planner.reserve}%</span></label><input id="plan-reserve" type="range" min="0" max="50" step="1" value="${planner.reserve}"><small>Reserve is your choice, not a model recommendation.</small></div><div class="form-field"><label for="plan-need">Need weight <span id="need-label">${planner.needWeight}%</span></label><input id="plan-need" type="range" min="0" max="100" step="5" value="${planner.needWeight}"><small>0% splits by forecast pounds (today's practice: allocation follows demand). 100% splits by each county's share of residents below poverty (ACS 2019–2023), the basis USDA uses for 60% of TEFAP allocations (7 CFR 251.3(h)). In between blends the two. A scenario lever, not a recommendation.</small></div><div class="form-field"><label>Counties to include</label><p class="helper">Choose the service area for this scenario. Review flags are not used as allocation weights.</p><div class="inline-actions"><button class="text-link" data-action="select-reporting">Select all with forecast</button><button class="text-link" data-action="clear-selection">Clear</button></div><div class="choice-list">${[
      ...D.counties,
    ]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (c) =>
          `<label class="choice-row"><input type="checkbox" name="plan-county" value="${c.fips}" ${planner.ids.includes(c.fips) ? "checked" : ""} ${c.forecast.PoundsTotal.yhat == null ? "disabled" : ""}><span>${esc(c.name)}</span><small>${c.forecast.PoundsTotal.yhat == null ? "No forecast" : ""}</small></label>`,
      )
      .join(
        "",
      )}</div></div><p class="helper">Method: available pool × [(1 − need weight) × county share of forecast pounds + need weight × county share of residents below poverty], over the selected counties. Whole-pound rounding preserves the pool exactly.</p></div></section><section class="panel"><div class="panel-head"><div><h2>Scenario comparison</h2><p>Staff-selected scope · demand split, optional need blend</p></div><span class="pill amber">DRAFT SCENARIO</span></div><div id="plan-result"></div></section></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Saved scenarios</h2><p>Snapshots retain their assumptions and source version.</p></div></div><div id="saved-scenarios">${savedScenarios()}</div></section>${note()}`
    );
  }
  function savedScenarios() {
    return state.scenarios.length
      ? state.scenarios
          .map(
            (s) =>
              `<div class="saved-scenario"><div><h3>${esc(s.name)}</h3><p>${fmt(s.total)} lb pool · ${s.ids.length} counties · ${s.reserve}% reserve · ${s.needWeight ?? 0}% need weight · ${esc(s.sourceVersion)}</p></div><div class="inline-actions">${button("load-scenario", "Use assumptions", "refresh", `data-id="${s.id}"`)}${button("export-scenario", "Export", "download", `data-id="${s.id}"`)}<button class="icon-button" data-action="delete-scenario" data-id="${s.id}" aria-label="Delete ${esc(s.name)}">${icon("trash")}</button></div></div>`,
          )
          .join("")
      : '<div class="empty-state"><p>Save a scenario to keep a reviewable snapshot of your assumptions.</p></div>';
  }
  function updatePlan() {
    const el = $("#plan-result");
    if (!el) return;
    if (!planner.ids.length) {
      planResult = null;
      el.innerHTML = `<div class="empty-state">${icon("plan")}<h3>Start with your service area.</h3><p>Select one or more counties to see a draft distribution of your food pool. Wilkin remains unavailable because it has no reporting history.</p></div>`;
      return;
    }
    try {
      planResult = C.allocate(D.counties, planner);
    } catch (e) {
      planResult = null;
      el.innerHTML = `<div class="panel-body"><div class="error" role="alert">${esc(e.message)}</div></div>`;
      return;
    }
    const r = planResult;
    el.innerHTML = `<div class="summary-strip section-gap"><div><small>SCENARIO DISTRIBUTION</small><strong>${fmt(r.available)} <small>lb</small></strong></div><div><small>HELD IN RESERVE</small><strong>${fmt(r.reservePounds)} <small>lb</small></strong></div><div><small>SELECTED COUNTIES</small><strong>${r.rows.length}</strong></div></div><div class="panel-body"><p class="helper">Selected county point forecasts total <strong>${fmt(r.forecastTotal)} lb</strong>. The draft pool equals ${fmt((r.available / r.forecastTotal) * 100, 1)}% of that reported-throughput forecast. This is not a measure of household food adequacy.</p></div><div class="table-scroll"><table><thead><tr><th>County</th><th class="number-cell">Draft pounds</th>${r.needWeight ? '<th class="number-cell">Demand-only split</th><th class="number-cell">Change</th>' : ""}<th class="number-cell">Forecast point</th><th class="number-cell">Upper 80%<br><small>planning reference</small></th></tr></thead><tbody>${r.rows.map((row) => `<tr><td><button class="county-button" data-action="county" data-id="${row.fips}">${esc(row.name)}</button><div class="bar-track"><span style="width:${(row.pounds / r.available) * 100}%"></span></div></td><td class="number-cell">${fmt(row.pounds)}</td>${r.needWeight ? `<td class="number-cell">${fmt(row.demandPounds)}</td><td class="number-cell">${row.pounds - row.demandPounds > 0 ? "+" : ""}${fmt(row.pounds - row.demandPounds)}</td>` : ""}<td class="number-cell">${fmt(row.forecast)}</td><td class="number-cell">${fmt(row.upper80)}</td></tr>`).join("")}</tbody></table></div><div class="panel-body"><div class="inline-actions">${button("save-scenario", "Save scenario", "check", "", "primary")}${button("export-plan", "Export draft CSV", "download")}</div><p class="content-note">All food is accounted for: ${fmt(r.available)} lb distributed in this scenario + ${fmt(r.reservePounds)} lb reserved = ${fmt(r.total)} lb entered. County upper bands are shown individually; their sum would not be a network uncertainty interval. ${r.needWeight ? `Need weight ${r.needWeight}%: residents below poverty from ACS 2019–2023 (B17001), carried in q6_need_index.csv. A need-weighted split can send food beyond a county's recent throughput; confirm local capacity first.` : ""} Source: PoundsTotal in q7_august2026_wide.csv.</p></div>`;
  }
  function exportScenario(s) {
    const rows = s.rows.map((r) => ({
      scenario: s.name || planner.name || "Unsaved draft",
      county_fips: r.fips,
      county: r.name,
      draft_pounds: r.pounds,
      demand_only_pounds: r.demandPounds ?? r.pounds,
      need_weight_pct: s.needWeight ?? 0,
      forecast_PoundsTotal: r.forecast,
      forecast_hi80: r.upper80,
      pool_pounds: s.total,
      reserve_pounds: s.reservePounds,
      target_month: D.meta.forecast_target,
      status: "hypothetical_not_dispatched",
      method: (s.needWeight ?? 0)
        ? "forecast_and_poverty_share_blend_selected_counties"
        : "forecast_proportional_selected_counties",
      source_version: s.sourceVersion || sourceVersion,
      universe: D.meta.universe,
      source: "outputs/forecasts/q7_august2026_wide.csv",
    }));
    download("foodbridge-draft-scenario.csv", C.csv(rows));
    toast("Draft scenario exported. No food has been dispatched.");
  }
  function actionsPage() {
    const done = state.actions.filter((a) => a.status === "Completed"),
      open = state.actions.filter((a) => a.status !== "Completed");
    return (
      header(
        "Action board",
        "Keep the follow-through in view.",
        "Assign a local review, record what you learned, and make the next decision easier.",
        button("new-action", "Create follow-up", "plus", "", "primary"),
      ) +
      `<div class="kpis">${kpi("Open reviews", fmt(open.length), "Staff-created actions · local workspace", "check")}${kpi("Reviews completed", fmt(done.length), "Completion requires a recorded finding", "shield")}${kpi("Access barriers reported", fmt(done.filter((a) => a.result === "Access barrier reported").length), "Staff observations · not independent validation", "map")}${kpi("Counties being reviewed", fmt(new Set(open.map((a) => a.county)).size), "Counties with at least one open action", "people")}</div><div class="callout">${icon("info")}<span>These are workflow measures, not demonstrated reductions in food insecurity. Record aggregate observations only. Do not enter client names, contact details, or sensitive household information. Work is saved in this browser and is not shared automatically.</span></div><div class="inline-actions" style="margin-bottom:20px">${button("export-actions", "Export action log", "download")}${button("backup", "Back up workspace", "download")}${button("restore", "Restore backup", "upload")}</div><div class="board">${C.STATUSES.map(
        (status) => {
          const rows = state.actions
            .filter((a) => a.status === status)
            .sort((a, b) => a.due.localeCompare(b.due));
          return `<section class="board-column"><h2 class="column-title">${status}<span>${rows.length}</span></h2>${rows.length ? rows.map((a) => `<button class="task-card" data-action="edit-action" data-id="${a.id}"><span class="pill ${status === "Completed" ? "green" : status === "In progress" ? "amber" : "gray"}">${esc(a.kind)}</span><h3>${esc(county(a.county).name)} County</h3><p>${esc((a.status === "Completed" ? a.outcome : a.notes) || "Open this action to add review notes.")}</p><div class="task-footer"><span>${esc(a.owner)}</span><span class="${a.due < today() && status !== "Completed" ? "overdue" : ""}">${a.due < today() && status !== "Completed" ? "Overdue · " : ""}${esc(a.due)}</span></div></button>`).join("") : `<div class="board-empty">${status === "To review" ? "Create a follow-up from any county." : status === "In progress" ? "Move a review here when work begins." : "Completed reviews and findings will appear here."}</div>`}</section>`;
        },
      ).join("")}</div>${note()}`
    );
  }
  function openAction(id, countyId) {
    if ($("#county-dialog").open) $("#county-dialog").close();
    const a = id ? state.actions.find((x) => x.id === id) : null;
    const due = new Date();
    due.setDate(due.getDate() + 7);
    $("#action-dialog").innerHTML =
      `<form id="action-form"><div class="dialog-head"><div><div class="eyebrow">Make the next step specific</div><h2 id="action-title">${a ? "Update follow-up" : "Create a follow-up"}</h2><p>A review is complete when its finding has been recorded.</p></div><button class="icon-button" type="button" data-action="close-action" aria-label="Close action form">${icon("close")}</button></div><div class="dialog-body"><input name="id" type="hidden" value="${esc(a?.id || "")}"><p class="required-note">County, review type, owner, and due date are required. Use team roles for owners.</p><div class="form-row"><div class="form-field"><label for="action-county">County</label><select name="county" id="action-county" required>${[
        ...D.counties,
      ]
        .sort((x, y) => x.name.localeCompare(y.name))
        .map(
          (c) =>
            `<option value="${c.fips}" ${c.fips === (a?.county || countyId) ? "selected" : ""}>${esc(c.name)}</option>`,
        )
        .join(
          "",
        )}</select></div><div class="form-field"><label for="action-kind">Review type</label><select name="kind" id="action-kind">${C.KINDS.map((k) => `<option ${k === a?.kind ? "selected" : ""}>${k}</option>`).join("")}</select></div></div><div class="form-row"><div class="form-field"><label for="action-owner">Owner / team role</label><input name="owner" id="action-owner" required maxlength="100" placeholder="e.g. Regional operations lead" value="${esc(a?.owner || "")}"></div><div class="form-field"><label for="action-due">Due date</label><input type="date" name="due" id="action-due" required value="${esc(a?.due || due.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }))}"></div></div><div class="form-field"><label for="action-notes">What should this review establish?</label><textarea name="notes" id="action-notes" maxlength="3000" placeholder="Check reporting completeness and discuss service hours with local partners.">${esc(a?.notes || "")}</textarea><small>Aggregate observations only; keep client and household information out.</small></div><div class="form-row"><div class="form-field"><label for="action-status">Status</label><select name="status" id="action-status">${C.STATUSES.map((s) => `<option ${s === a?.status ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="form-field"><label for="action-result">Review finding</label><select name="result" id="action-result">${C.RESULTS.map((r) => `<option ${r === a?.result ? "selected" : ""}>${r}</option>`).join("")}</select></div></div><div class="form-field"><label for="action-outcome">Finding and next step</label><textarea name="outcome" id="action-outcome" maxlength="3000" placeholder="Record the evidence reviewed, what changed your interpretation, and the next action.">${esc(a?.outcome || "")}</textarea><small>Required when marking a review Completed. A finding is a staff observation, not proof of impact.</small></div><p id="action-error" class="form-error" role="alert"></p></div><div class="dialog-actions">${a ? button("delete-action", "Delete action", "trash", `type="button" data-id="${a.id}"`, "danger") : '<span class="helper">Saved locally in this browser</span>'}<button type="submit" class="button primary">${icon("check")}Save follow-up</button></div></form>`;
    $("#action-dialog").showModal();
    $("#action-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const now = new Date().toISOString();
      const item = {
        id: a?.id || C.uid(),
        county: f.get("county"),
        kind: f.get("kind"),
        owner: f.get("owner").trim(),
        due: f.get("due"),
        notes: f.get("notes").trim(),
        status: f.get("status"),
        result: f.get("result"),
        outcome: f.get("outcome").trim(),
        createdAt: a?.createdAt || now,
        updatedAt: now,
        sourceVersion: a?.sourceVersion || sourceVersion,
      };
      if (!item.owner) {
        $("#action-error").textContent = "Enter an owner or team role.";
        return;
      }
      if (
        item.status === "Completed" &&
        (item.result === "Not yet recorded" || !item.outcome)
      ) {
        $("#action-error").textContent =
          "Choose a review finding and describe the finding and next step before completing this action.";
        return;
      }
      try {
        C.validateState(
          {
            ...state,
            actions: [...state.actions.filter((x) => x.id !== item.id), item],
          },
          D.counties,
        );
      } catch {
        $("#action-error").textContent =
          "Check the required fields and date before saving.";
        return;
      }
      state.actions = state.actions.filter((x) => x.id !== item.id);
      state.actions.unshift(item);
      save("Follow-up saved.");
      $("#action-dialog").close();
      render();
    });
  }
  function modelTable(rows, value, labelName) {
    return `<table><thead><tr><th>Signal</th><th class="number-cell">${labelName}</th><th class="number-cell">95% interval</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${label[r.signal]}<div class="field-name">${r.signal}</div></td><td class="number-cell">${fmt(r[value], 3)}</td><td class="number-cell">${fmt(r.lo95, 3)} to ${fmt(r.hi95, 3)}</td></tr>`).join("")}</tbody></table>`;
  }
  function evidencePage() {
    return (
      header(
        "Research & sources",
        "Know what the evidence can support.",
        "Six answered research questions, a traceable source trail, and clear limits on every decision.",
        button("print", "Print this brief", "print"),
      ) +
      `<div class="print-only">FoodBridge · research ${esc(sourceVersion)} · statewide food_shelf_broad · observed through July 2026</div><div class="evidence-grid">
    <section class="panel research-card"><div class="question-number">Q1 · NEED & ACTIVITY</div><h2>Busy does not necessarily mean greater need.</h2><p>County totals agree strongly with estimated need counts. Once compared per resident, activity and food-insecurity rates diverge. Use throughput and independent need evidence together.</p>${modelTable(D.evidence.q1, "correlation", "Spearman ρ")}<p class="content-note">2024 broad-network rates · county-bootstrap intervals · fixed ACS 2019–2023 population denominator. Source: q1_correlations.csv.</p><div class="research-action"><strong>Decision:</strong> Audit unusually high or low activity before changing resources.</div></section>
    <section class="panel research-card"><div class="question-number">Q4 · FOOD PRICES</div><h2>Watch prices; avoid a precise surge promise.</h2><p>The selected Midwest model suggests a short response in individuals served. A common reliable lag or elasticity across the three signals is not established.</p>${modelTable(D.evidence.q4, "cumulative_elasticity", "Elasticity")}<p class="content-note">Controlled monthly log-change models · selected lag window · conditional HAC intervals exclude model-selection uncertainty. Source: q4_price_models.csv.</p><div class="research-action"><strong>Decision:</strong> Review recent activity and calendar capacity alongside prices.</div></section>
    <section class="panel research-card"><div class="question-number">Q5 · SNAP & FOOD SHELVES</div><h2>Complementarity is plausible, not proven.</h2><p>Enrollment and visits show some positive co-movement, weaker in the core network. The evidence does not establish household substitution or a causal benefit-cut effect.</p>${modelTable(D.evidence.q5, "coefficient", "Log caseload β")}<p class="content-note">Controlled administrative-unit panel · joint county agencies aggregated, tribal agencies separate · April 2023 first reduced payment month. Source: q5_panel_coefficients.csv.</p><div class="research-action"><strong>Decision:</strong> Use this context for policy conversations with its uncertainty intact.</div></section>
    <section class="panel research-card"><div class="question-number">Q6 · HIDDEN NEED SCREEN</div><h2>Build a review list, then test the hypothesis.</h2><p>The need index averages county percentile ranks of MMG rate, poverty, and no-vehicle share. It contains no activity measure. Gaps compare its percentile to each activity-rate percentile.</p><div class="evidence-kpi">${D.summary.stable} <small>stable review counties</small></div><p class="helper">${D.summary.review} primary flags; ${D.meta.variants.length} activity variants. Equal weights and the review threshold are provisional conventions. They do not establish unmet need or eligibility.</p><p class="content-note">Reject the ranking if an independent, adequately powered survey rules out a useful hardship difference. Revise unstable weights, vintages or reporting assumptions. Source: q6_need_index.csv, q6_divergence_sensitivity.csv.</p><div class="research-action"><strong>Decision:</strong> Verify reports and investigate local barriers before allocation changes.</div></section>
    <section class="panel research-card"><div class="question-number">Q7 · REPORTED ACTIVITY FORECAST</div><h2>Plan for throughput, keep room for uncertainty.</h2><p>Recent activity per working day, weighted toward July, had the lowest development RMSE (the competition metric). Children, adults and seniors reconcile to individuals served. Wilkin has no reporting history (submitted as 0).</p><table><thead><tr><th>Signal</th><th class="number-cell">August 2026 forecast</th></tr></thead><tbody>${ALL.map((s) => `<tr><td>${label[s]}<div class="field-name">${s}</div></td><td class="number-cell">${fmt(D.summary.forecast[s])}</td></tr>`).join("")}</tbody></table><p class="content-note">${D.summary.forecast_counties} counties · no August actuals · internal forecast pending sponsor submission rules. County bands are available in the explorer. Source: q7_august2026_wide.csv.</p><div class="research-action"><strong>Decision:</strong> Use explicit buffers and confirm reporting lapses; the bands are not guaranteed coverage.</div></section>
    <section class="panel research-card"><div class="question-number">Q8 · RETAIL ACCESS & FOOTPRINT</div><h2>A location gap is a starting point.</h2><p>Within low-income urban and rural strata, low-access tracts have a lower food-shelf presence share than their better-access counterparts. Presence cannot establish whether households are adequately served.</p><div class="evidence-kpi">${D.summary.without_site_2024} <small>of ${D.summary.lila_2024} LILA tracts</small></div><p class="helper">Had no reporting site inside the tract in 2024. USDA 2019 flags are assigned from 2010 to 2020 tracts by dominant land-area overlap. Newer SRAM uses a different retailer universe.</p><p class="content-note">No household distance, route, service-area boundary or current opening hours can be inferred. Source: q8_county_footprint_gaps.csv.</p><div class="research-action"><strong>Decision:</strong> Verify catchments, transport, hours and mobile stops with local partners.</div></section></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Historical interval checks</h2><p>Observed coverage of nominal bands; undercoverage remains.</p></div></div><div class="panel-body table-scroll"><table><thead><tr><th>Historical target</th><th>Signal</th><th class="number-cell">Counties</th><th class="number-cell">80% band coverage</th><th class="number-cell">95% band coverage</th></tr></thead><tbody>${D.evidence.intervals.map((r) => `<tr><td>${esc(r.target_month)}</td><td>${label[r.signal]}</td><td class="number-cell">${fmt(r.n)}</td><td class="number-cell">${fmt(r.coverage80 * 100, 1)}%</td><td class="number-cell">${fmt(r.coverage95 * 100, 1)}%</td></tr>`).join("")}</tbody></table><p class="content-note">Chronological coverage checks in q7_interval_coverage.csv; method revised after initial undercoverage. These development checks do not certify future interval probabilities.</p></div></section>
    <div class="method-grid section-gap"><section class="panel method-card"><h3>One analytical authority</h3><p>All research values come from existing output tables. The app does not train a model or recompute the research. The supply planner performs labeled scenario arithmetic using staff-entered assumptions.</p></section><section class="panel method-card"><h3>Know the population</h3><p>Statewide broad reporting network: brick-and-mortar, outreach/mobile, tribal and college programs. This is not a view limited to The Food Group partners. Repeated activity is not unique people.</p></section><section class="panel method-card"><h3>Measure a pilot honestly</h3><p>Use the action board to record review findings. A future sponsor pilot should measure planning time, reporting corrections, verified barriers and service changes; assess household food security independently before claiming impact.</p></section></div>
    <section class="panel section-gap"><div class="panel-head"><div><h2>Source ledger</h2><p>Every bundled source is identified and hashed at build time.</p></div></div><div class="section-gap">${D.sources.map((s) => `<details><summary>${esc(s.id)} · ${esc(s.publisher)}</summary><p>${esc(s.vintage)} · catalog rows ${esc(s.catalog)}</p><p>${esc(s.meaning)}</p><code>outputs/${esc(s.file)}</code><p>SHA-256: <code>${esc(s.sha256 || "Not bundled")}</code></p></details>`).join("")}</div></section>
    <section class="panel section-gap"><div class="panel-body"><h2>Reproduce and hand off</h2><p class="helper" style="margin:10px 0">Build from the existing outputs with <code>uv run python -m mi.operations --serve</code>. The build reads no raw sponsor files and makes no network requests. After an approved research refresh, rebuild to update the snapshot; the current competition cutoff continues to apply.</p><p class="helper">Source ledger: <code>docs/sources/catalog.md</code>. Research details: <code>outputs/tables/research_answers.md</code>. Need-screen rejection design: <code>docs/reference/q6_addendum.md</code>. Forecast model card: <code>outputs/eval/q7_model_card.md</code>.</p><div class="inline-actions section-gap">${button("backup", "Export workspace backup", "download")}${button("restore", "Restore workspace backup", "upload")}${button("export-data", "Export aggregate evidence", "download")}</div><p class="content-note">Local single-browser prototype. No shared accounts, live inventory, dispatch integration or sponsor pilot is configured. A static hosted copy would still save each browser’s work separately.</p></div></section>${note()}`
    );
  }
  function render() {
    const route = location.hash.slice(1) || "overview";
    page = ["overview", "counties", "planner", "actions", "evidence"].includes(
      route,
    )
      ? route
      : "overview";
    const names = {
      overview: "Overview",
      counties: "County explorer",
      planner: "Supply planner",
      actions: "Action board",
      evidence: "Research & sources",
    };
    $("#page-label").textContent = names[page];
    document.title = `${names[page]} · FoodBridge`;
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === page);
      if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const body = {
      overview,
      counties: countiesPage,
      planner: plannerPage,
      actions: actionsPage,
      evidence: evidencePage,
    }[page]();
    $("#main").innerHTML =
      (storageIssue
        ? `<div class="callout amber" role="alert">${icon("info")}<span>${esc(storageIssue)}</span></div>`
        : "") + body;
    if (page === "planner") updatePlan();
    updateCount();
    if (storageIssue)
      $("#storage-label").textContent =
        "Session only · export a backup before closing";
  }
  function navigate(to) {
    if (location.hash === `#${to}`) render();
    else location.hash = to;
  }
  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
    $("#main").focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (e) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.matches("path[data-action]")
    ) {
      e.preventDefault();
      openCounty(e.target.dataset.id);
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "county-search") {
      countySearch = e.target.value;
      refreshCountyRows();
    }
    if (e.target.id === "plan-name") planner.name = e.target.value;
    if (e.target.id === "plan-total") {
      planner.total = e.target.value === "" ? NaN : Number(e.target.value);
      updatePlan();
    }
    if (e.target.id === "plan-need") {
      planner.needWeight = Number(e.target.value);
      $("#need-label").textContent = `${planner.needWeight}%`;
      updatePlan();
    }
    if (e.target.id === "plan-reserve") {
      planner.reserve = Number(e.target.value);
      $("#reserve-label").textContent = `${planner.reserve}%`;
      updatePlan();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "chart-signal") {
      chartSignal = e.target.value;
      $("#activity-chart").innerHTML = chart();
      $("#activity-chart").nextElementSibling.textContent =
        `${chartSignal} · source: q4_state_month.csv · partial reports may understate activity`;
    }
    if (e.target.id === "county-filter") {
      countyFilter = e.target.value;
      refreshCountyRows();
    }
    if (e.target.id === "access-year") {
      accessYear = e.target.value;
      refreshCountyRows();
    }
    if (e.target.name === "plan-county") {
      planner.ids = [
        ...document.querySelectorAll('[name="plan-county"]:checked'),
      ].map((el) => el.value);
      updatePlan();
    }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    const action = b.dataset.action,
      id = b.dataset.id;
    if (action === "navigate") navigate(b.dataset.page);
    else if (action === "county") openCounty(id);
    else if (action === "close-county") $("#county-dialog").close();
    else if (action === "close-action") $("#action-dialog").close();
    else if (action === "close-confirm") $("#confirm-dialog").close();
    else if (action === "confirm") {
      const fn = confirmationCallback;
      confirmationCallback = null;
      $("#confirm-dialog").close();
      fn?.();
    } else if (action === "review-counties") {
      countyFilter = "review";
      countySearch = "";
      navigate("counties");
    } else if (action === "new-action") openAction(null, id);
    else if (action === "edit-action") openAction(id);
    else if (action === "delete-action")
      confirmAction(
        "Delete this follow-up?",
        "This removes the action and its recorded finding from this browser. Export a backup first if you need to keep it.",
        "Delete action",
        () => {
          state.actions = state.actions.filter((a) => a.id !== id);
          save("Follow-up deleted.");
          $("#action-dialog").close();
          render();
        },
      );
    else if (action === "add-planner") {
      if (!planner.ids.includes(id)) planner.ids.push(id);
      $("#county-dialog").close();
      navigate("planner");
      toast(`${county(id).name} added to the scenario.`);
    } else if (action === "select-reporting" || action === "clear-selection") {
      planner.ids =
        action === "clear-selection"
          ? []
          : D.counties
              .filter((c) => c.forecast.PoundsTotal.yhat > 0)
              .map((c) => c.fips);
      document
        .querySelectorAll('[name="plan-county"]')
        .forEach((el) => (el.checked = planner.ids.includes(el.value)));
      updatePlan();
    } else if (action === "save-scenario") {
      if (!planResult) return;
      if (!planner.name.trim()) {
        toast("Give this scenario a name before saving.");
        $("#plan-name").focus();
        return;
      }
      state.scenarios.unshift({
        ...planResult,
        id: C.uid(),
        ids: [...planner.ids],
        name: planner.name.trim(),
        createdAt: new Date().toISOString(),
        sourceVersion,
      });
      save("Scenario snapshot saved.");
      $("#saved-scenarios").innerHTML = savedScenarios();
    } else if (action === "load-scenario") {
      const s = state.scenarios.find((x) => x.id === id);
      planner = {
        total: s.total,
        reserve: s.reserve,
        needWeight: s.needWeight ?? 0,
        ids: [...s.ids],
        name: `${s.name} (copy)`.slice(0, 120),
      };
      render();
      toast(
        "Assumptions loaded. The comparison now uses the current bundled forecast.",
      );
    } else if (action === "delete-scenario")
      confirmAction(
        "Delete this scenario?",
        "The saved scenario will be removed from this browser. Existing actions stay available.",
        "Delete scenario",
        () => {
          state.scenarios = state.scenarios.filter((s) => s.id !== id);
          save("Scenario deleted.");
          render();
        },
      );
    else if (action === "export-scenario")
      exportScenario(state.scenarios.find((s) => s.id === id));
    else if (action === "export-plan" && planResult) exportScenario(planResult);
    else if (action === "export-counties") {
      const rows = filteredCounties().map((c) => ({
        county_fips: c.fips,
        county: c.name,
        screen:
          c.minimum_gap == null
            ? "incomplete_evidence"
            : c.stable
              ? "stable_review"
              : c.review
                ? "review"
                : "routine",
        HouseholdsTotal_gap_pp: c.gaps.HouseholdsTotal,
        PoundsTotal_gap_pp: c.gaps.PoundsTotal,
        IndividualsTotal_gap_pp: c.gaps.IndividualsTotal,
        lila_without_site: c.access[accessYear].lila_without_site,
        footprint_year: accessYear,
        forecast_PoundsTotal: c.forecast.PoundsTotal.yhat,
        forecast_lo80: c.forecast.PoundsTotal.lo80,
        forecast_hi80: c.forecast.PoundsTotal.hi80,
        target_month: D.meta.forecast_target,
        forecast_status: c.forecast.PoundsTotal.status,
        universe: D.meta.universe,
        research_version: D.meta.research_version,
        sources:
          "q6_need_index.csv; q8_county_footprint_gaps.csv; q7_august2026_wide.csv",
      }));
      if (!rows.length) {
        toast("No counties to export.");
        return;
      }
      download("foodbridge-county-review.csv", C.csv(rows));
      toast(`${rows.length} counties exported.`);
    } else if (action === "export-actions") {
      if (!state.actions.length) {
        toast("Create a follow-up before exporting the action log.");
        return;
      }
      download(
        "foodbridge-action-log.csv",
        C.csv(
          state.actions.map((a) => ({
            ...a,
            county_name: county(a.county).name,
          })),
        ),
      );
      toast("Action log exported.");
    } else if (action === "backup") backup();
    else if (action === "restore") $("#import-file").click();
    else if (action === "export-data") {
      download(
        "foodbridge-aggregate-evidence.json",
        JSON.stringify(D, null, 2),
        "application/json",
      );
      toast("Aggregate evidence exported with source metadata.");
    } else if (action === "print") window.print();
  });
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("Backup is too large. The limit is 10 MB.");
      return;
    }
    try {
      const imported = C.validateState(
        JSON.parse(await file.text()),
        D.counties,
      );
      confirmAction(
        "Restore this workspace?",
        `Replace this browser’s ${state.actions.length} actions and ${state.scenarios.length} scenarios with ${imported.actions.length} actions and ${imported.scenarios.length} scenarios from the backup. Export your current workspace first if you need to keep both.`,
        "Restore workspace",
        () => {
          state = imported;
          recoveryRaw = null;
          save("Workspace restored.");
          render();
        },
      );
    } catch (err) {
      toast(
        err instanceof SyntaxError
          ? "This file is not valid JSON. Existing work has not changed."
          : err.message,
      );
    }
  });
  render();
})();
