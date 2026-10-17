"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { GeoMap, LegendBar } from "@/components/map/GeoMap";
import { auditGeoms } from "@/components/map/useMapData";
import { useTheme } from "@/components/theme";
import { Badge, Button, Card, cx, ForecastBadge, Icon, Input, PageHeader, Segmented, Select, SourceNote, Stat } from "@/components/ui";
import { allocate, type Allocation } from "@/lib/allocate";
import { downloadText, fmt, toCsv } from "@/lib/format";
import { makeScale } from "@/lib/ramps";
import { countiesByFips, EQUITY_SHORT, equityValue, research } from "@/lib/research";

// Categorical slots (validated order) for the pool composition bar; the tail folds into "Other".
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
const SLOTS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];

const withForecast = research.counties.filter((c) => (c.forecast.PoundsTotal?.yhat ?? 0) > 0 && (c.poverty_persons ?? 0) > 0);

type Preset = "audit" | "feiTop" | "nonmetro" | "all" | "custom";
const PRESETS: { id: Preset; label: string; ids: () => string[]; hint: string }[] = [
  { id: "audit", label: "Q6 audit-first", ids: () => withForecast.filter((c) => c.robust).map((c) => c.fips), hint: "Counties where need outruns activity on every signal (D-052)." },
  { id: "feiTop", label: "Top FEI quintile", ids: () => withForecast.filter((c) => c.fei?.quintile === 5).map((c) => c.fips), hint: "The 20% of counties with the most access barriers." },
  { id: "nonmetro", label: "Nonmetro", ids: () => withForecast.filter((c) => c.nonmetro).map((c) => c.fips), hint: "USDA RUCC 2023 nonmetro counties with a forecast." },
  { id: "all", label: "All counties", ids: () => withForecast.map((c) => c.fips), hint: "Every county with a positive PoundsReg forecast." },
];

const POLICIES = [
  { w: 0, label: "Follow demand", hint: "Split by each county's August pounds forecast (PoundsReg): today's demand-led practice." },
  { w: 50, label: "Balanced", hint: "Half by forecast demand, half by residents below poverty." },
  { w: 100, label: "Follow need", hint: "Split by ACS residents below poverty, the basis of 60% of USDA's TEFAP formula." },
];

const POOL_CHIPS = [40000, 100000, 250000, 500000];

export default function AllocationPage() {
  const { store, refresh, data } = useData();
  const theme = useTheme();
  const [preset, setPreset] = useState<Preset>("audit");
  const [ids, setIds] = useState<string[]>(() => PRESETS[0].ids());
  const [total, setTotal] = useState(250000);
  const [reserve, setReserve] = useState(10);
  const [needWeight, setNeedWeight] = useState(0);
  const [pick, setPick] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [sort, setSort] = useState<"draft" | "change" | "fei">("draft");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("county");
    if (q && withForecast.some((c) => c.fips === q)) {
      setIds((cur) => (cur.includes(q) ? cur : [...cur, q]));
      setPreset("custom");
    }
  }, []);

  const toggle = useCallback(
    (fips: string) => {
      if (!withForecast.some((c) => c.fips === fips)) return;
      setPreset("custom");
      setIds((cur) => (cur.includes(fips) ? cur.filter((x) => x !== fips) : [...cur, fips]));
      setSaved(null);
    },
    [],
  );

  const run = (w: number): { result: Allocation | null; error: string | null } => {
    try {
      return { result: ids.length ? allocate(research.counties, { total, reserve, ids, needWeight: w }) : null, error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  };
  const { result, error } = useMemo(() => run(needWeight), [ids, total, reserve, needWeight]); // eslint-disable-line react-hooks/exhaustive-deps
  const needOnly = useMemo(() => run(100).result, [ids, total, reserve]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!result) return [];
    const needBy = new Map(needOnly?.rows.map((r) => [r.fips, r.pounds]) ?? []);
    const out = result.rows.map((r) => {
      const c = countiesByFips[r.fips];
      const poor = c.poverty_persons ?? null;
      return {
        ...r,
        needPounds: needBy.get(r.fips) ?? null,
        change: r.pounds - r.demandPounds,
        perPoor: poor ? r.pounds / poor : null,
        coverage: r.forecast ? r.pounds / r.forecast : null,
        fei: equityValue(c),
      };
    });
    return out.sort((a, b) => (sort === "change" ? b.change - a.change : sort === "fei" ? (b.fei ?? 0) - (a.fei ?? 0) : b.pounds - a.pounds));
  }, [result, needOnly, sort]);

  const maxBar = Math.max(1, ...rows.flatMap((r) => [r.pounds, r.demandPounds, r.needPounds ?? 0]));
  const moved = rows.reduce((s, r) => s + Math.max(0, r.change), 0);

  // Map: draft pounds per resident below poverty for pooled counties; others faded.
  const perPoor = useMemo(() => Object.fromEntries(rows.map((r) => [r.fips, r.perPoor])), [rows]);
  const scale = useMemo(() => makeScale(Object.values(perPoor), "seq", theme), [perPoor, theme]);
  const inPool = useMemo(() => new Set(ids), [ids]);
  const fill = useCallback(
    (fips: string) => {
      const v = perPoor[fips];
      if (v != null) return scale.color(v);
      return withForecast.some((c) => c.fips === fips) ? (theme === "dark" ? "#3a4756" : "#b7c2cf") : null;
    },
    [perPoor, scale, theme],
  );
  const dim = useCallback((fips: string) => !inPool.has(fips), [inPool]);

  const palette = theme === "dark" ? SLOTS_DARK : SLOTS;
  const composition = useMemo(() => {
    if (!result) return [];
    const top = [...result.rows].sort((a, b) => b.pounds - a.pounds);
    const head = top.slice(0, 6).map((r, i) => ({ key: r.fips, label: r.name, value: r.pounds, color: palette[i] }));
    const tail = top.slice(6).reduce((s, r) => s + r.pounds, 0);
    return [
      ...head,
      ...(tail > 0 ? [{ key: "other", label: `${top.length - 6} other counties`, value: tail, color: theme === "dark" ? "#5b6b7c" : "#9aa7b5" }] : []),
      ...(result.reservePounds > 0 ? [{ key: "reserve", label: "Reserve", value: result.reservePounds, color: "transparent" }] : []),
    ];
  }, [result, palette, theme]);

  const exportCsv = () => {
    if (!result) return;
    downloadText(
      "foodbridge-allocation-draft.csv",
      toCsv(
        rows.map((r) => ({
          county: r.name,
          county_fips: r.fips,
          draft_pounds: r.pounds,
          demand_only_pounds: r.demandPounds,
          need_only_pounds: r.needPounds ?? "",
          change_vs_demand: r.change,
          need_weight_pct: needWeight,
          aug_forecast_PoundsReg: Math.round(r.forecast),
          upper80: r.upper80 == null ? "" : Math.round(r.upper80),
          draft_per_resident_below_poverty: r.perPoor == null ? "" : r.perPoor.toFixed(2),
          [EQUITY_SHORT]: r.fei == null ? "" : r.fei.toFixed(1),
        })),
      ),
    );
  };

  const saveDraft = async () => {
    if (!result) return;
    await store.saveScenario({
      name: `Allocation · ${fmt.int(total)} lb · ${needWeight}% need · ${ids.length} counties`,
      kind: "allocation",
      payload: { input: { total, reserve, needWeight, ids }, rows: result.rows.map((r) => ({ fips: r.fips, pounds: r.pounds })) },
    });
    await refresh();
    setSaved("Saved");
  };

  const policy = POLICIES.reduce((best, p) => (Math.abs(p.w - needWeight) < Math.abs(best.w - needWeight) ? p : best), POLICIES[0]);
  const savedDrafts = data.scenarios.filter((s) => s.kind === "allocation");

  return (
    <>
      <PageHeader
        eyebrow="Analyze & plan"
        title="Supply allocation"
        description="Draft how a pool of food is split between counties: by forecast pounds (demand), by need, or a blend. A draft for discussion; it never moves food on its own."
        actions={
          <>
            <Button variant="secondary" onClick={saveDraft} disabled={!result}>
              <Icon name="save" /> {saved ?? "Save draft"}
            </Button>
            <Button onClick={exportCsv} disabled={!result}>
              <Icon name="download" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon="box" label="Pool" value={`${fmt.compact(total)} lb`} sub="Pounds available this cycle" />
        <Stat icon="save" label="Reserve" value={`${fmt.compact(result?.reservePounds ?? 0)} lb`} sub={`${reserve}% held back`} accent="var(--muted)" />
        <Stat icon="truck" label="To allocate" value={`${fmt.compact(result?.available ?? 0)} lb`} sub={`${ids.length} counties in the pool`} accent="var(--seq-3)" />
        <Stat
          icon="scale"
          label="Moved toward need"
          value={`${fmt.compact(moved)} lb`}
          sub={result ? `${fmt.pct(result.available ? moved / result.available : 0)} of the pool vs a demand-only split` : "—"}
          accent="var(--accent)"
        />
        <Stat
          icon="users"
          label="Per resident in poverty"
          value={rows.length ? `${fmt.num(Math.min(...rows.map((r) => r.perPoor ?? Infinity)), 0)}–${fmt.num(Math.max(...rows.map((r) => r.perPoor ?? 0)), 0)}` : "—"}
          sub="Draft lb range across pooled counties"
          accent="var(--p-m)"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="1 · Pool size" icon="box">
            <Input type="number" min={1} value={total} onChange={(e) => setTotal(Math.max(1, Math.round(Number(e.target.value))))} aria-label="Pounds available" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {POOL_CHIPS.map((v) => (
                <button
                  key={v}
                  onClick={() => setTotal(v)}
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-[12px] font-medium",
                    total === v ? "border-accent bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {fmt.compact(v)} lb
                </button>
              ))}
            </div>
            <label className="mt-4 block text-[12.5px] font-medium text-ink-2">
              Reserve held back <span className="tabular text-ink">{reserve}%</span>
              <input type="range" min={0} max={50} value={reserve} onChange={(e) => setReserve(Number(e.target.value))} className="mt-1.5 w-full" />
            </label>
          </Card>

          <Card title="2 · Allocation policy" icon="scale" subtitle={policy.hint}>
            <Segmented<string>
              className="w-full"
              label="Policy preset"
              value={String(POLICIES.find((p) => p.w === needWeight)?.w ?? "custom")}
              onChange={(v) => setNeedWeight(Number(v))}
              options={POLICIES.map((p) => ({ value: String(p.w), label: p.label }))}
            />
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11.5px] font-medium">
                <span className="text-[var(--seq-3)]">Forecast pounds (demand)</span>
                <span className="tabular rounded-md bg-surface-2 px-2 py-0.5 text-[12px] text-ink">{100 - needWeight}% · {needWeight}%</span>
                <span className="text-accent">Poverty (need)</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={needWeight}
                onChange={(e) => setNeedWeight(Number(e.target.value))}
                className="mt-1.5 w-full"
                aria-label="Need weight"
              />
            </div>
            <div className="mt-3 rounded-lg bg-surface-2 p-3 text-[11.5px] leading-relaxed text-ink-2">
              County pounds = pool × [<b>{100 - needWeight}%</b> × its share of forecast <code>PoundsReg</code> + <b>{needWeight}%</b> × its share of
              residents below poverty (ACS)]. Largest-remainder rounding keeps drafts + reserve equal to the pool (D-048).
            </div>
          </Card>

          <Card title="3 · Counties in the pool" icon="map" subtitle="Pick a preset, click counties on the map, or add one below.">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  title={p.hint}
                  onClick={() => {
                    setPreset(p.id);
                    setIds(p.ids());
                    setSaved(null);
                  }}
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-[12px] font-medium",
                    preset === p.id ? "border-accent bg-[var(--accent-soft)] text-ink" : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {p.label}
                </button>
              ))}
              {preset === "custom" && <Badge tone="green">Custom</Badge>}
            </div>
            <div className="mt-3 flex gap-2">
              <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a county">
                <option value="">Add a county…</option>
                {withForecast
                  .filter((c) => !ids.includes(c.fips))
                  .map((c) => (
                    <option key={c.fips} value={c.fips}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              <Button
                variant="secondary"
                disabled={!pick}
                onClick={() => {
                  toggle(pick);
                  setPick("");
                }}
              >
                <Icon name="plus" /> Add
              </Button>
            </div>
            <div className="mt-3 flex max-h-[148px] flex-wrap gap-1.5 overflow-y-auto">
              {ids.map((id) => (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink hover:border-[var(--critical)]"
                  title="Remove from the pool"
                >
                  {countiesByFips[id]?.name} <Icon name="x" className="h-3 w-3 text-muted" />
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-muted">Counties without a PoundsReg forecast (Wilkin) cannot join: a missing forecast is never read as zero.</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {error && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--critical)_40%,transparent)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] p-3 text-[13px] text-[var(--critical-text)]">
              {error}
            </div>
          )}
          {!result && !error && (
            <Card>
              <p className="py-10 text-center text-[13px] text-muted">Add at least one county to draft a split.</p>
            </Card>
          )}
          {result && (
            <>
              <Card title="How the pool is split" icon="dashboard" subtitle={`${fmt.int(result.total)} lb · ${fmt.int(result.available)} allocated · ${fmt.int(result.reservePounds)} held in reserve`}>
                <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
                  {composition.map((p) => (
                    <div
                      key={p.key}
                      title={`${p.label}: ${fmt.int(p.value)} lb`}
                      style={{
                        width: `${(p.value / result.total) * 100}%`,
                        background: p.key === "reserve" ? "repeating-linear-gradient(45deg, var(--surface-3) 0 4px, transparent 4px 8px)" : p.color,
                      }}
                      className={cx("transition-[width] duration-300", p.key === "reserve" && "ring-1 ring-inset ring-line-strong")}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-ink-2">
                  {composition.map((p) => (
                    <span key={p.key} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-line"
                        style={{ background: p.key === "reserve" ? "repeating-linear-gradient(45deg, var(--muted) 0 1.5px, transparent 1.5px 4px)" : p.color }}
                      />
                      {p.label} <span className="tabular font-semibold text-ink">{fmt.compact(p.value)}</span>
                    </span>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                <Card title="Draft per resident in poverty" icon="map" subtitle="Click a county to add or remove it. Faded counties are outside the pool." padded={false}>
                  <div className="relative h-[560px] overflow-hidden border-t border-line">
                    <GeoMap
                      geometry={research.geometry}
                      fill={fill}
                      dim={dim}
                      fillOpacity={0.82}
                      onSelect={toggle}
                      dashed={preset === "audit" ? auditGeoms : undefined}
                      basemap={theme === "dark" ? "dark" : "light"}
                      ariaLabel="Allocation map"
                      fitPadding={[16, 56, 16, 16]}
                      hoverCard={(fips) => {
                        const r = rows.find((x) => x.fips === fips);
                        const c = countiesByFips[fips];
                        return (
                          <div>
                            <div className="font-semibold text-ink">{c?.name} County</div>
                            {r ? (
                              <div className="tabular mt-1 space-y-0.5 text-ink-2">
                                <div className="flex justify-between gap-4">
                                  <span>Draft</span>
                                  <span className="font-semibold text-ink">{fmt.int(r.pounds)} lb</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span>Per resident in poverty</span>
                                  <span className="font-semibold text-ink">{fmt.num(r.perPoor, 1)} lb</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span>vs demand-only split</span>
                                  <span className="font-semibold text-ink">
                                    {r.change > 0 ? "+" : ""}
                                    {fmt.int(r.change)} lb
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] text-muted">Click to remove from the pool</div>
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-muted">
                                {withForecast.some((x) => x.fips === fips) ? "Not in the pool. Click to add." : "No PoundsReg forecast; cannot be pooled."}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                  </div>
                  <div className="border-t border-line px-4 py-3 sm:px-5">
                    <LegendBar title="Draft lb per resident in poverty" scale={scale} format={(v) => fmt.num(v, 0)} low="Less" high="More" />
                  </div>
                </Card>

                <Card
                  title="Where the pounds go"
                  icon="truck"
                  subtitle="Bar = this draft. Ticks: what a demand-only (forecast pounds) and a need-only split would give."
                  actions={
                    <Segmented<"draft" | "change" | "fei">
                      size="sm"
                      label="Sort"
                      value={sort}
                      onChange={setSort}
                      options={[
                        { value: "draft", label: "Draft" },
                        { value: "change", label: "Shift" },
                        { value: "fei", label: EQUITY_SHORT },
                      ]}
                    />
                  }
                >
                  <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-4 rounded-sm bg-accent" /> Draft
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-[3px] rounded bg-[var(--seq-3)]" /> Demand-only split
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-[3px] rounded bg-[var(--p-s)]" /> Need-only split
                    </span>
                  </div>
                  <ul className="fb-scroll max-h-[540px] space-y-2 overflow-y-auto pr-1">
                    {rows.map((r) => (
                      <li key={r.fips} className="grid grid-cols-[92px_1fr_92px] items-center gap-2.5">
                        <span className="truncate text-[12.5px] text-ink" title={`${r.name} County`}>
                          {r.name}
                        </span>
                        <span className="relative h-4">
                          <span className="absolute inset-y-[5px] left-0 right-0 rounded-full bg-surface-3" />
                          <span
                            className="absolute inset-y-[3px] left-0 rounded-full bg-accent transition-[width] duration-300"
                            style={{ width: `${(r.pounds / maxBar) * 100}%` }}
                          />
                          <span
                            className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded bg-[var(--seq-3)] ring-2 ring-[var(--surface)]"
                            style={{ left: `${(r.demandPounds / maxBar) * 100}%` }}
                            title={`Demand-only: ${fmt.int(r.demandPounds)} lb`}
                          />
                          {r.needPounds != null && (
                            <span
                              className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded bg-[var(--p-s)] ring-2 ring-[var(--surface)]"
                              style={{ left: `${(r.needPounds / maxBar) * 100}%` }}
                              title={`Need-only: ${fmt.int(r.needPounds)} lb`}
                            />
                          )}
                        </span>
                        <span className="tabular text-right text-[12px]">
                          <span className="font-semibold text-ink">{fmt.compact(r.pounds)}</span>{" "}
                          <span className={cx(r.change > 0 ? "text-[var(--good-text)]" : r.change < 0 ? "text-[var(--critical-text)]" : "text-muted")}>
                            {r.change > 0 ? "+" : r.change < 0 ? "−" : "±"}
                            {fmt.compact(Math.abs(r.change))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card
                title="Draft against the August forecast"
                icon="history"
                subtitle="Draft as a share of each county's forecast PoundsReg. Above 100% covers more than the forecast; the 80% upper band is a planning reference, not a capacity limit."
                actions={<ForecastBadge />}
              >
                <div className="overflow-x-auto">
                  <table className="tabular w-full min-w-[680px] text-[12.5px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                        <th className="py-2 font-medium">County</th>
                        <th className="py-2 text-right font-medium">Draft lb</th>
                        <th className="py-2 text-right font-medium">Demand-only lb</th>
                        <th className="py-2 text-right font-medium">Aug forecast</th>
                        <th className="py-2 pl-4 font-medium">Draft ÷ forecast</th>
                        <th className="py-2 text-right font-medium">{EQUITY_SHORT}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const cov = r.coverage ?? 0;
                        return (
                          <tr key={r.fips} className="border-b border-line last:border-0">
                            <td className="py-1.5 text-ink">{r.name}</td>
                            <td className="py-1.5 text-right font-semibold text-ink">{fmt.int(r.pounds)}</td>
                            <td className="py-1.5 text-right text-ink-2">{fmt.int(r.demandPounds)}</td>
                            <td className="py-1.5 text-right text-ink-2">{fmt.int(r.forecast)}</td>
                            <td className="py-1.5 pl-4">
                              <span className="flex items-center gap-2">
                                <span className="relative h-2 w-28 overflow-hidden rounded-full bg-surface-3">
                                  <span
                                    className="absolute inset-y-0 left-0 rounded-full"
                                    style={{ width: `${Math.min(1, cov / 2) * 100}%`, background: cov >= 1 ? "var(--accent)" : "var(--seq-3)" }}
                                  />
                                  <span className="absolute inset-y-0 left-1/2 w-px bg-ink" aria-hidden />
                                </span>
                                <span className="text-ink-2">{fmt.pct(r.coverage)}</span>
                              </span>
                            </td>
                            <td className="py-1.5 text-right text-ink-2">{fmt.num(r.fei, 1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <SourceNote>
                  Forecast: outputs/forecasts/q7_august2026_wide.csv (D-045), an internal forecast for one month; the pool covers
                  whatever period staff set. The midline marks 100% of the forecast. Not modelled: product mix, shelf capacity, delivery
                  cost, existing commitments.
                </SourceNote>
              </Card>

              {savedDrafts.length > 0 && (
                <Card title="Saved drafts" icon="save">
                  <ul className="divide-y divide-line">
                    {savedDrafts.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 py-2 text-[12.5px]">
                        <span className="flex-1 text-ink">{s.name}</span>
                        <span className="text-muted">{fmt.date(s.created_at)}</span>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-[var(--critical-text)]"
                          aria-label={`Delete ${s.name}`}
                          onClick={async () => {
                            await store.deleteScenario(s.id);
                            await refresh();
                          }}
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
