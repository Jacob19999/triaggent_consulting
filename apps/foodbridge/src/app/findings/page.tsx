import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { Badge, Card, PageHeader, SourceNote } from "@/components/ui";
import { fmt } from "@/lib/format";
import { feiReady, research, SIGNAL_LABEL } from "@/lib/research";

export const metadata = { title: "Findings" };

const st = research.findings.stats;
const section = (id: string) => research.findings.sections.find((s) => s.id === id);

const central = (() => {
  const s = section("status-and-central-finding");
  const paras = (s?.markdown ?? "").split("\n\n").filter((p) => p.trim());
  return paras[1] ?? paras[0] ?? "";
})();

const QUESTIONS: {
  id: string;
  short: string;
  monday: string;
  link?: { href: string; label: string };
  chips: { label: string; value: string }[];
}[] = [
  {
    id: "q1",
    short: "Q1 · Need estimates vs activity",
    monday: "Allocation by visits rewards county size. Keep a need measure that does not depend on visit volume.",
    link: { href: "/manager/map", label: "Explore activity vs need on the map" },
    chips: [
      ...st.q1_count.map((r) => ({ label: `${SIGNAL_LABEL[r.signal]} · counts`, value: `ρ ${fmt.num(r.correlation, 2)}` })),
      ...st.q1_rate.map((r) => ({
        label: `${SIGNAL_LABEL[r.signal]} · per resident`,
        value: `ρ ${fmt.num(r.correlation, 2)} [${fmt.num(r.lo95, 2)}, ${fmt.num(r.hi95, 2)}]`,
      })),
    ],
  },
  {
    id: "q4",
    short: "Q4 · Food prices",
    monday: "Prices give no reliable early warning by themselves. Warn shelves with the statewide signal and their own trend.",
    chips: st.q4.map((r) => ({
      label: `${SIGNAL_LABEL[r.signal]} · % per 1% price rise`,
      value: `${fmt.num(r.cumulative_elasticity, 2)} [${fmt.num(r.lo95, 2)}, ${fmt.num(r.hi95, 2)}]`,
    })),
  },
  {
    id: "q5",
    short: "Q5 · SNAP",
    monday:
      "Ask Minnesota DCYF for advance notice of payment gaps and a de-identified SNAP–shelf linkage pilot. Our data do not show shelves absorbing benefit cuts, so do not plan on it.",
    link: { href: "/manager/briefing", label: "Policy briefing agent" },
    chips: [
      ...st.q5.map((r) => ({
        label: `${SIGNAL_LABEL[r.signal]} · per 1% caseload`,
        value: `${fmt.num(r.coefficient, 2)} [${fmt.num(r.lo95, 2)}, ${fmt.num(r.hi95, 2)}]`,
      })),
      ...st.q5_noise
        .filter((r) => r.signal === "HouseholdsTotal")
        .map((r) => ({ label: `${r.month} visits swing`, value: `rank ${r.rank_of_all} of ${r.months_ranked}` })),
    ],
  },
  {
    id: "q6",
    short: "Q6 · A need measure that is not demand",
    monday: "Use the score to decide where to look, not how much food to move: audit first, reallocate second.",
    link: { href: "/manager/fei", label: "FEI overview" },
    chips: [
      { label: "Review counties", value: String(st.q6_review) },
      { label: "Audit first (robust)", value: st.q6_robust.join(", ") },
      ...st.q6_checks.slice(0, 1).map((c) => ({ label: "Need score vs SNAP participation", value: `ρ ${fmt.num(c.spearman, 2)} [${fmt.num(c.lo95, 2)}, ${fmt.num(c.hi95, 2)}]` })),
    ],
  },
  {
    id: "q7",
    short: "Q7 · August 2026 forecast",
    monday: "Plan August supply with the band, not the point, and with the access gaps in view.",
    link: { href: "/manager/map", label: "County forecasts on the map" },
    chips: st.q7_state
      .filter((r) => ["HouseholdsTotal", "PoundsTotal", "ChildrenTotal", "AdultsTotal", "SeniorsTotal"].includes(r.signal))
      .map((r) => ({ label: `${SIGNAL_LABEL[r.signal]} (forecast)`, value: fmt.int(r.yhat) })),
  },
  {
    id: "q8",
    short: "Q8 · LILA areas and network reach",
    monday: "Verify catchments, hours and mobile stops in LILA tracts with no reporting shelf before siting anything.",
    link: { href: "/manager/scenarios", label: "Model a new shelf" },
    chips: [
      { label: "LILA tracts (2024)", value: fmt.int(st.q8.lila_tracts) },
      { label: "LILA tracts with no reporting shelf", value: fmt.int(st.q8.lila_without_site) },
      ...st.q8.strata.map((s) => ({ label: `${s.group.replaceAll("_", " ")} · mean miles`, value: fmt.num(s.mean_miles, 1) })),
    ],
  },
];

export default function FindingsPage() {
  const kpis = (research.fei.meta?.kpis ?? {}) as Record<string, number | string[] | undefined>;
  return (
    <>
      <PageHeader
        eyebrow="Findings"
        title="Need and demand: where they agree, where they split, what to do on Monday"
        description="The team's generated answers to the six scored graduate questions, each tied to a decision. Every number here is read from the analysis outputs."
        actions={
          <Link href="/findings/present" className="inline-flex h-9 items-center rounded-lg border border-accent bg-accent px-3.5 text-[13.5px] font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]">
            Open presentation
          </Link>
        }
      />
      <Card title="Central finding">
        <Markdown source={central} />
      </Card>

      {feiReady && (
        <Card className="mt-4" title="New measure · Food Access Equity Index" actions={<Badge tone="green">Built 2024 network</Badge>}>
          <p className="text-[14px] leading-relaxed text-ink-2">
            FEI scores every census tract 0–100 for the barriers between residents who may need food and the food-shelf network:
            need, local supply, travel, mobility and demographic vulnerability. Median tract FEI is{" "}
            <strong className="text-ink">{fmt.num(kpis.median_fei as number, 1)}</strong>;{" "}
            <strong className="text-ink">{fmt.int(kpis.residents_top_quintile as number)}</strong> residents live in top-quintile
            tracts; <strong className="text-ink">{kpis.counties_top_quintile_and_q6_priority as number}</strong> counties are in
            both the FEI top quintile and the Q6 priority list.
          </p>
          <p className="mt-2 text-[13px] text-ink">
            <span className="font-semibold">Monday:</span> site a new shelf or mobile stop where FEI is high and activity per
            low-income resident is low, then measure the change.{" "}
            <Link className="text-accent underline" href="/manager/fei">
              FEI overview
            </Link>
          </p>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {QUESTIONS.map((q) => {
          const s = section(q.id);
          return (
            <Card key={q.id} title={q.short} subtitle={s?.title.replace(/^Q\d\s*—\s*/, "")}>
              <Markdown source={s?.lead ?? ""} className="text-[14px]" />
              <dl className="mt-3 flex flex-wrap gap-1.5">
                {q.chips.map((c) => (
                  <div key={c.label} className="rounded-md bg-surface-2 px-2 py-1 text-[12px]">
                    <dt className="inline text-muted">{c.label}: </dt>
                    <dd className="tabular inline font-semibold text-ink">{c.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t border-line pt-3 text-[13.5px] text-ink">
                <span className="font-semibold">Monday decision:</span> {q.monday}
              </p>
              {q.link && (
                <Link className="mt-2 inline-block text-[13px] font-medium text-accent underline" href={q.link.href}>
                  {q.link.label}
                </Link>
              )}
            </Card>
          );
        })}
      </div>
      <SourceNote>
        Text: outputs/tables/research_answers.md (generated by scripts/build_research_report.py). Statistics: the q1_, q4_, q5_,
        q6_, q7_ and q8_ tables in outputs/. Map the Meal Gap is cited, never redistributed; the deck PDFs are in the
        Presentation tab.
      </SourceNote>
    </>
  );
}
