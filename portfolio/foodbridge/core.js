/* Pure application rules. Q6 review flags never set allocation weights (D-038).
   An optional need weight (D-048) blends the forecast-demand split with each county's
   share of residents below poverty (ACS), the basis of 60% of USDA's TEFAP formula. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FoodBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STATUSES = ["To review", "In progress", "Completed"];
  const KINDS = [
    "Reporting audit",
    "Access conversation",
    "Capacity check",
    "Outreach pilot",
  ];
  const RESULTS = [
    "Not yet recorded",
    "Reporting issue identified",
    "Access barrier reported",
    "Capacity confirmed",
    "Further investigation needed",
    "No issue found",
  ];
  const number = (x) => typeof x === "number" && Number.isFinite(x);
  const text = (x, max) => typeof x === "string" && x.length <= max;
  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function emptyState() {
    return { version: 1, actions: [], scenarios: [] };
  }
  function allocate(counties, input) {
    const { total, reserve, ids } = input;
    const needWeight = input.needWeight ?? 0;
    if (!Number.isSafeInteger(total) || total <= 0 || total > 1e9)
      throw new Error("Enter whole pounds between 1 and 1,000,000,000.");
    if (!Number.isInteger(reserve) || reserve < 0 || reserve > 50)
      throw new Error("Reserve must be between 0% and 50%.");
    if (!Number.isInteger(needWeight) || needWeight < 0 || needWeight > 100)
      throw new Error("Need weight must be between 0% and 100%.");
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length)
      throw new Error("Choose at least one county, without duplicates.");
    const selected = ids.map((id) => counties.find((c) => c.fips === id));
    if (selected.some((c) => !c))
      throw new Error("A selected county is unavailable.");
    if (
      selected.some(
        (c) =>
          !number(c.forecast.PoundsTotal.yhat) ||
          c.forecast.PoundsTotal.yhat <= 0,
      )
    )
      throw new Error(
        "Selected counties need a positive PoundsTotal forecast. Missing forecasts cannot be treated as zero.",
      );
    if (
      needWeight > 0 &&
      selected.some((c) => !number(c.poverty_persons) || c.poverty_persons <= 0)
    )
      throw new Error(
        "A need-weighted split needs the ACS poverty count for every selected county.",
      );
    const forecastTotal = selected.reduce(
      (sum, c) => sum + c.forecast.PoundsTotal.yhat,
      0,
    );
    const povertyTotal = selected.reduce(
      (sum, c) => sum + (number(c.poverty_persons) ? c.poverty_persons : 0),
      0,
    );
    const w = needWeight / 100;
    const reservePounds = Math.round((total * reserve) / 100);
    const available = total - reservePounds;
    const rows = selected.map((c) => {
      const demandShare = c.forecast.PoundsTotal.yhat / forecastTotal;
      const needShare = w > 0 ? c.poverty_persons / povertyTotal : 0;
      const exact =
        w > 0
          ? available * ((1 - w) * demandShare + w * needShare)
          : (available * c.forecast.PoundsTotal.yhat) / forecastTotal;
      return {
        fips: c.fips,
        name: c.name,
        pounds: Math.floor(exact),
        remainder: exact - Math.floor(exact),
        forecast: c.forecast.PoundsTotal.yhat,
        upper80: c.forecast.PoundsTotal.hi80,
        demandPounds: Math.round(available * demandShare),
      };
    });
    let left = available - rows.reduce((sum, r) => sum + r.pounds, 0);
    const ordered = [...rows].sort(
      (a, b) => b.remainder - a.remainder || a.fips.localeCompare(b.fips),
    );
    for (let i = 0; i < left; i++) ordered[i].pounds += 1;
    return {
      total,
      reserve,
      needWeight,
      reservePounds,
      available,
      forecastTotal,
      rows: rows
        .sort((a, b) => b.pounds - a.pounds)
        .map(({ remainder, ...r }) => r),
    };
  }
  function validateState(value, counties) {
    const fail = () => {
      throw new Error(
        "This backup is invalid or incompatible. Existing work has not changed.",
      );
    };
    if (
      !value ||
      value.version !== 1 ||
      !Array.isArray(value.actions) ||
      !Array.isArray(value.scenarios) ||
      value.actions.length > 5000 ||
      value.scenarios.length > 1000
    )
      fail();
    const ids = new Set(counties.map((c) => c.fips));
    const unique = new Set();
    const identifier = (x) => text(x, 100) && /^[a-zA-Z0-9_-]+$/.test(x);
    const date = (x) => {
      if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
      const parsed = new Date(`${x}T00:00:00Z`);
      return (
        !Number.isNaN(parsed.valueOf()) &&
        parsed.toISOString().slice(0, 10) === x
      );
    };
    const timestamp = (x) => text(x, 40) && !Number.isNaN(Date.parse(x));
    const actions = value.actions.map((a) => {
      if (
        !a ||
        !identifier(a.id) ||
        unique.has(a.id) ||
        !ids.has(a.county) ||
        !KINDS.includes(a.kind) ||
        !STATUSES.includes(a.status) ||
        !RESULTS.includes(a.result) ||
        !text(a.owner, 100) ||
        !a.owner.trim() ||
        !text(a.notes, 3000) ||
        !text(a.outcome, 3000) ||
        !text(a.sourceVersion, 100) ||
        !date(a.due) ||
        !timestamp(a.createdAt) ||
        !timestamp(a.updatedAt)
      )
        fail();
      if (
        a.status === "Completed" &&
        (a.result === "Not yet recorded" || !a.outcome.trim())
      )
        fail();
      unique.add(a.id);
      return Object.fromEntries(
        [
          "id",
          "county",
          "kind",
          "status",
          "result",
          "owner",
          "notes",
          "outcome",
          "sourceVersion",
          "due",
          "createdAt",
          "updatedAt",
        ].map((k) => [k, a[k]]),
      );
    });
    const scenarios = value.scenarios.map((s) => {
      if (
        !s ||
        !identifier(s.id) ||
        unique.has(s.id) ||
        !text(s.name, 120) ||
        !s.name.trim() ||
        !text(s.sourceVersion, 100) ||
        !timestamp(s.createdAt) ||
        !Array.isArray(s.ids) ||
        !Array.isArray(s.rows)
      )
        fail();
      unique.add(s.id);
      // Retain the saved analytical snapshot; never silently recalculate old plans
      // when a research refresh changes the forecast.
      if (
        !Number.isSafeInteger(s.total) ||
        s.total < 1 ||
        s.total > 1e9 ||
        !Number.isInteger(s.reserve) ||
        s.reserve < 0 ||
        s.reserve > 50 ||
        !Number.isInteger(s.needWeight ?? 0) ||
        (s.needWeight ?? 0) < 0 ||
        (s.needWeight ?? 0) > 100 ||
        s.reservePounds !== Math.round((s.total * s.reserve) / 100) ||
        s.available !== s.total - s.reservePounds ||
        !number(s.forecastTotal) ||
        s.forecastTotal <= 0
      )
        fail();
      if (
        !s.ids.length ||
        new Set(s.ids).size !== s.ids.length ||
        s.ids.some((id) => !ids.has(id)) ||
        s.rows.length !== s.ids.length
      )
        fail();
      const rowIds = new Set();
      const rows = s.rows.map((r) => {
        if (
          !s.ids.includes(r.fips) ||
          rowIds.has(r.fips) ||
          !Number.isSafeInteger(r.pounds) ||
          r.pounds < 0 ||
          !number(r.forecast) ||
          r.forecast <= 0 ||
          !number(r.upper80) ||
          r.upper80 < r.forecast
        )
          fail();
        rowIds.add(r.fips);
        if (r.demandPounds != null && !Number.isSafeInteger(r.demandPounds)) fail();
        return {
          fips: r.fips,
          name: counties.find((c) => c.fips === r.fips).name,
          pounds: r.pounds,
          forecast: r.forecast,
          upper80: r.upper80,
          demandPounds: r.demandPounds ?? r.pounds,
        };
      });
      if (
        rows.reduce((sum, r) => sum + r.pounds, 0) !== s.available ||
        Math.abs(
          rows.reduce((sum, r) => sum + r.forecast, 0) - s.forecastTotal,
        ) > 0.01
      )
        fail();
      return {
        id: s.id,
        name: s.name,
        sourceVersion: s.sourceVersion,
        createdAt: s.createdAt,
        ids: [...s.ids],
        total: s.total,
        reserve: s.reserve,
        needWeight: s.needWeight ?? 0,
        reservePounds: s.reservePounds,
        available: s.available,
        forecastTotal: s.forecastTotal,
        rows,
      };
    });
    return { version: 1, actions, scenarios };
  }
  function csv(rows) {
    if (!rows.length) return "";
    const keys = Object.keys(rows[0]);
    const cell = (value) => {
      let s = value == null ? "" : String(value);
      // Spreadsheet formula injection protection for user-entered fields.
      if (typeof value === "string" && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    return (
      "\uFEFF" +
      [
        keys.map(cell).join(","),
        ...rows.map((row) => keys.map((k) => cell(row[k])).join(",")),
      ].join("\r\n")
    );
  }
  return {
    STATUSES,
    KINDS,
    RESULTS,
    emptyState,
    allocate,
    validateState,
    csv,
    uid,
  };
});
