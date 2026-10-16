"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MinnesotaMap } from "@/components/MinnesotaMap";
import { Button, Card, PageHeader } from "@/components/ui";
import { monthLabel } from "@/lib/calendar";
import { fmt } from "@/lib/format";
import { equityValue, feiReady, research, SIGNAL_LABEL } from "@/lib/research";

const st = research.findings.stats;
const kpis = (research.fei.meta?.kpis ?? {}) as Record<string, number | string[] | undefined>;

function CorrBars({ rows }: { rows: { label: string; r: number; lo: number; hi: number; color: string }[] }) {
  // Dot-and-interval chart on one shared −1…1 axis.
  const x = (v: number) => 50 + v * 45;
  return (
    <svg viewBox="0 0 100 64" className="h-auto w-full" role="img" aria-label="Rank correlations with 95% intervals">
      <line x1={x(0)} x2={x(0)} y1={2} y2={60} stroke="var(--line)" strokeWidth={0.4} />
      {[-1, -0.5, 0, 0.5, 1].map((t) => (
        <text key={t} x={x(t)} y={63.5} fontSize={2.6} textAnchor="middle" fill="var(--muted)">
          {t}
        </text>
      ))}
      {rows.map((r, i) => {
        const y = 6 + i * 9;
        return (
          <g key={r.label}>
            <text x={1} y={y + 1} fontSize={2.8} fill="var(--ink)">
              {r.label}
            </text>
            <line x1={x(r.lo)} x2={x(r.hi)} y1={y + 3.5} y2={y + 3.5} stroke={r.color} strokeWidth={0.8} strokeLinecap="round" />
            <circle cx={x(r.r)} cy={y + 3.5} r={1.3} fill={r.color} stroke="var(--surface)" strokeWidth={0.4} />
            <text
              x={r.hi > 0.6 ? x(r.lo) - 1.5 : x(r.hi) + 1.5}
              y={y + 4.4}
              fontSize={2.6}
              textAnchor={r.hi > 0.6 ? "end" : "start"}
              fill="var(--ink-2)"
            >
              ρ {r.r.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const COLORS = { HouseholdsTotal: "var(--sig-households)", PoundsTotal: "var(--sig-pounds)", IndividualsTotal: "var(--sig-individuals)" };

function Slide({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="text-[13px] font-semibold uppercase tracking-wider text-accent">{kicker}</div>
      <h2 className="mt-2 max-w-4xl text-[26px] font-semibold leading-tight text-ink sm:text-[32px]">{title}</h2>
      <div className="mt-5 min-h-0 flex-1">{children}</div>
    </div>
  );
}

export default function Present() {
  const [i, setI] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const values = Object.fromEntries(research.counties.map((c) => [c.fips, equityValue(c)]));
  const robust = new Set(research.counties.filter((c) => c.robust).map((c) => c.fips));
  const visits = st.q7_state.find((r) => r.signal === "HouseholdsTotal");

  const slides: ReactNode[] = [
    <Slide key="1" kicker="MinneMUDAC 2026 · The Food Group" title="Need and demand: where they agree, where they split, what to do on Monday">
      <p className="max-w-3xl text-[17px] leading-relaxed text-ink-2">
        The Food Group sees demand: the people who show up. It cannot see need: the people who never do. We measured where
        the two diverge, built an index of the barriers between them, and turned it into a tool managers and shelves can use
        every month.
      </p>
    </Slide>,
    <Slide key="2" kicker="Q1 · Need estimates vs activity" title="Busy counties are big counties. Per resident, activity barely follows estimated need.">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[13px] font-medium text-ink-2">Counts (2024)</p>
          <CorrBars rows={st.q1_count.map((r) => ({ label: SIGNAL_LABEL[r.signal], r: r.correlation, lo: r.lo95, hi: r.hi95, color: COLORS[r.signal] }))} />
        </div>
        <div>
          <p className="mb-1 text-[13px] font-medium text-ink-2">Per resident (2024)</p>
          <CorrBars rows={st.q1_rate.map((r) => ({ label: SIGNAL_LABEL[r.signal], r: r.correlation, lo: r.lo95, hi: r.hi95, color: COLORS[r.signal] }))} />
        </div>
      </div>
      <p className="mt-4 text-[15px] text-ink"><b>Monday:</b> allocation by visits rewards size. Keep a need measure that does not depend on visit volume.</p>
    </Slide>,
    <Slide
      key="3"
      kicker={feiReady ? "Q6 · New measure: Food Access Equity Index" : "Q6 · A need measure that is not demand"}
      title={feiReady ? "Barriers between need and the network are concentrated, and we can name where." : "Need without activity data, with rules that could reject it."}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr] md:items-center">
        <div className="mx-auto w-full max-w-[380px]">
          <MinnesotaMap values={values} legendTitle={feiReady ? "FEI" : "Need percentile"} highlight={robust} format={(v) => fmt.num(v, 0)} />
        </div>
        <div className="space-y-3 text-[16px] text-ink-2">
          {feiReady ? (
            <>
              <p>
                <b className="text-ink">{fmt.int(kpis.residents_top_quintile as number)}</b> residents live in top-quintile tracts,
                including <b className="text-ink">{fmt.int(kpis.children_top_quintile as number)}</b> children.
              </p>
              <p>
                <b className="text-ink">{kpis.counties_top_quintile_and_q6_priority as number}</b> counties are both FEI top quintile
                and Q6 priority: {(kpis.counties_top_quintile_and_q6_priority_names as string[] | undefined)?.join(", ")}.
              </p>
            </>
          ) : null}
          <p>
            Q6 audit-first counties (dashed): <b className="text-ink">{st.q6_robust.join(", ")}</b>. A call list for local checks,
            not proof of unmet need.
          </p>
          <p className="text-ink"><b>Monday:</b> audit first, reallocate second. Start with a conversation about hours, transport and language.</p>
        </div>
      </div>
    </Slide>,
    <Slide key="4" kicker="Q4 prices · Q5 SNAP" title="Prices give no reliable early warning, and statewide totals cannot isolate what SNAP changes did.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Q4 · % change per 1% food-at-home price rise">
          <ul className="tabular space-y-1 text-[15px]">
            {st.q4.map((r) => (
              <li key={r.signal}>
                {SIGNAL_LABEL[r.signal]}: <b>{fmt.num(r.cumulative_elasticity, 2)}</b> [{fmt.num(r.lo95, 2)}, {fmt.num(r.hi95, 2)}]
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Q5 · SNAP months among all months (visits)">
          <ul className="tabular space-y-1 text-[15px]">
            {st.q5_noise
              .filter((r) => r.signal === "HouseholdsTotal")
              .map((r) => (
                <li key={r.event}>
                  {monthLabel(r.month, "long")}: rank <b>{r.rank_of_all}</b> of {r.months_ranked}, {fmt.num(r.residual_pp, 1)} pts above a usual month
                </li>
              ))}
          </ul>
        </Card>
      </div>
      <p className="mt-4 text-[15px] text-ink"><b>Monday:</b> ask DCYF for advance notice of payment gaps and a de-identified SNAP–shelf linkage pilot.</p>
    </Slide>,
    <Slide key="5" kicker="Q8 · LILA and reach" title="Low-income, low-access tracts are farther from a reporting shelf, in town and country.">
      <table className="tabular w-full max-w-3xl text-[15px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1 font-medium">Tracts</th>
            <th className="py-1 text-right font-medium">Residents</th>
            <th className="py-1 text-right font-medium">Mean miles</th>
            <th className="py-1 text-right font-medium">Beyond 10 mi</th>
          </tr>
        </thead>
        <tbody>
          {st.q8.strata.map((s) => (
            <tr key={s.group} className="border-t border-line">
              <td className="py-1.5">{s.group.replaceAll("_", " ")}</td>
              <td className="py-1.5 text-right">{fmt.int(s.population)}</td>
              <td className="py-1.5 text-right font-semibold">{fmt.num(s.mean_miles, 1)}</td>
              <td className="py-1.5 text-right">{fmt.pct(s.share_beyond_10, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[15px] text-ink">
        {fmt.int(st.q8.lila_without_site)} of {fmt.int(st.q8.lila_tracts)} LILA tracts had no reporting shelf in 2024. <b>Monday:</b> verify catchments, hours and mobile stops.
      </p>
    </Slide>,
    <Slide key="6" kicker="FoodBridge" title="One tool for managers and shelves, from evidence to a decision the same week.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-[15px]">
        <Card title="Managers">FEI overview and map · new-shelf scenarios with FEI change and dollar value · priority list · forecast alerts · AI policy briefing.</Card>
        <Card title="Food shelves">Monthly report in the network&apos;s own fields · next-month forecast with a band · stock and capacity warnings · requests.</Card>
        <Card title="Guardrails">County and tract aggregates only · forecasts labelled · AI retrieves and cites, never computes · row-level security.</Card>
      </div>
      <p className="mt-4 text-[15px] text-ink-2">
        August 2026 statewide visits, internal forecast: <b className="text-ink">{fmt.int(visits?.yhat)}</b>.
      </p>
    </Slide>,
  ];

  const go = useCallback((d: number) => setI((v) => Math.max(0, Math.min(slides.length - 1, v + d))), [slides.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      else if (e.key.toLowerCase() === "f") void frame.current?.requestFullscreen?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <>
      <PageHeader
        eyebrow="Presentation"
        title="Offline PDFs and backup slides"
        description="The judging talk is the live deck at /present (← → to move, N for notes, F for full screen). This page keeps the six-slide walkthrough and the plan-B PDFs."
        actions={
          <a href="/present" className="inline-flex h-9 items-center rounded-lg border border-accent bg-accent px-3.5 text-[13.5px] font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]">
            Open judging talk
          </a>
        }
      />
      <div ref={frame} className="relative rounded-[14px] border border-line bg-surface p-6 sm:p-10" style={{ minHeight: 520 }}>
        {slides[i]}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" onClick={() => go(-1)} disabled={i === 0}>
            ← Back
          </Button>
          <span className="tabular text-[13px] text-muted">
            {i + 1} / {slides.length}
          </span>
          <Button variant="secondary" onClick={() => go(1)} disabled={i === slides.length - 1}>
            Next →
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Slide deck (PDF)" actions={<a className="text-[13px] text-accent underline" href="/deck/present.pdf" target="_blank" rel="noreferrer">Open</a>}>
          <object data="/deck/present.pdf" type="application/pdf" className="h-[480px] w-full rounded-lg border border-line" aria-label="Slide deck PDF">
            <a href="/deck/present.pdf">Download the deck</a>
          </object>
        </Card>
        <Card title="One-page handout (PDF)" actions={<a className="text-[13px] text-accent underline" href="/deck/handout.pdf" target="_blank" rel="noreferrer">Open</a>}>
          <object data="/deck/handout.pdf" type="application/pdf" className="h-[480px] w-full rounded-lg border border-line" aria-label="Handout PDF">
            <a href="/deck/handout.pdf">Download the handout</a>
          </object>
        </Card>
      </div>
    </>
  );
}
