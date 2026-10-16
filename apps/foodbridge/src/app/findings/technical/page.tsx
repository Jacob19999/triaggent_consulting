import { Markdown } from "@/components/Markdown";
import { Card, PageHeader, SourceNote } from "@/components/ui";
import { fmt } from "@/lib/format";
import { feiReady, research } from "@/lib/research";

export const metadata = { title: "Technical details" };

function Box({ x, y, w, h, title, lines, tone = "surface" }: { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: "surface" | "deep" }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={tone === "deep" ? "#143f35" : "var(--surface-2)"} stroke="var(--line)" />
      <text x={x + 12} y={y + 22} fontSize={13} fontWeight={650} fill={tone === "deep" ? "#ffffff" : "var(--ink)"}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 12} y={y + 42 + i * 16} fontSize={11} fill={tone === "deep" ? "#d9e7a9" : "var(--ink-2)"}>
          {l}
        </text>
      ))}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={1.4} markerEnd="url(#arrow)" />
      {label && (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fontSize={10.5} textAnchor="middle" fill="var(--muted)">
          {label}
        </text>
      )}
    </g>
  );
}

const SECTIONS = [
  {
    title: "Forecasts",
    body: "County August 2026 values are the submitted Q7 model (D-045): the last three monthly working-day rates weighted 1:2:3 toward July, times August's 21 working days, with empirical 80%/95% bands. Shelf forecasts in the portal apply the same rule to each shelf's own reports; their bands come from the shelf's one-step backtest errors (at least six), otherwise a stated ±20%/±35% default.",
  },
  {
    title: "Alerts",
    body: "Deterministic rules, each with its numbers and a next step. Stock: on-hand plus typical receipts vs forecast pounds (critical below the point, serious below the upper 80% band, warning under 14 days on hand). Demand: forecast visits 15%+ above the 6-month mean. Capacity: upper 80% visits above 90% of stated capacity. Turn-aways, overdue reports and data checks (visits above individuals; ages not summing). County: Q6 audit-first, FEI top quintile, LILA tracts with no shelf, wide forecast bands. Policy: dated events from primary sources within six months back and three ahead.",
  },
  {
    title: "New-shelf scenario",
    body: "Residents are placed at tract centroids. A tract benefits when the new site is closer than its current mean distance to the nearest reporting shelf (D-051). Residents beyond the USDA threshold (1 mile urban, 10 miles rural) count as newly within reach when the centroid falls inside it. The FEI change follows the FEI build: the new site's 2SFCA ratio (its pounds over its own decay-weighted low-income demand) is added to each tract's access, S and T are re-normalized with the build's published bounds, and only S and T change. Dollar values use editable, labelled assumptions.",
  },
  {
    title: "AI briefing agent",
    body: "Server-side function calling with Google Gemini. Tools are read-only: the policy timeline, county profiles and rankings, research findings, the FEI method, and the caller's own alerts and network totals. The system prompt forbids computing numbers, requires a source after each figure, and applies the team's wording rules (D-052, D-053). Without an API key, or if the model declines, the same facts are returned as an offline briefing.",
  },
  {
    title: "Data and privacy contract",
    body: "The app ships county and tract aggregates only, chosen column by column by mi.foodbridge_bundle from tracked outputs/ tables, plus public Census and USDA tract fields. No site rows, site keys, block IDs, per-tract shelf counts or Map the Meal Gap county values (D-021, D-050). Shelf markers sit at county centres with counts. A privacy scan runs on every bundle build and in npm run check. Supabase holds only app state (shelves registered in the app, their reports, requests, alert follow-up, scenarios) behind row-level security.",
  },
  {
    title: "Stack and deployment",
    body: "Next.js 15 (App Router, TypeScript) on Vercel; Supabase Postgres + Auth with row-level security; Google Gemini API for the agent (server only). Without Supabase the app runs on the county networks (statewide extract, county totals by month) kept in the browser. The whole site sits behind a portal password checked in middleware. Security headers (CSP, nosniff, frame-ancestors), noindex by default, per-IP and daily limits on the agent route.",
  },
];

export default function Technical() {
  const report = research.findings.sections;
  return (
    <>
      <PageHeader
        eyebrow="Technical details"
        title="How FoodBridge and the analysis fit together"
        description={`Bundle built ${fmt.date(research.meta.generated_at)} from commit ${research.meta.git_commit ?? "—"} by \`${research.meta.script}\`. Research observed to ${research.meta.observed_end}; forecast target ${research.meta.forecast_target}.`}
      />
      <Card title="Architecture">
        <div className="overflow-x-auto">
          <svg viewBox="0 0 980 330" className="min-w-[760px]" role="img" aria-label="FoodBridge architecture diagram">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
              </marker>
            </defs>
            <Box x={10} y={20} w={220} h={120} title="Research pipeline (Python)" lines={["mi.research · mi.forecast (Q7)", "mi.fei (FEI, task A4)", "outputs/tables · outputs/forecasts", "sponsor microdata stays local"]} />
            <Box x={10} y={180} w={220} h={120} title="Public sources" lines={["Census ACS, 2020 PL, TIGER", "USDA LILA / SRAM, CDC SVI", "BLS CPI, DCYF SNAP", "policy timeline (primary)"]} />
            <Box x={290} y={95} w={210} h={130} title="mi.foodbridge_bundle" lines={["column allowlist", "FEI adapter (pillar letters)", "privacy scan", "→ data/research.json", "→ public/data/fei-tracts.json"]} tone="deep" />
            <Box x={560} y={20} w={200} h={130} title="Next.js app on Vercel" lines={["Manager workspace", "Food shelf portal", "Findings & presentation", "forecast · alerts · scenarios", "run in the browser"]} />
            <Box x={560} y={180} w={200} h={120} title="/api/agent (server)" lines={["Gemini function calling", "read-only retrieval tools", "cited briefing", "offline fallback"]} />
            <Box x={820} y={20} w={150} h={130} title="Supabase" lines={["Postgres + Auth", "row-level security", "shelves, reports,", "requests, alerts,", "scenarios"]} />
            <Box x={820} y={180} w={150} h={120} title="Google Gemini API" lines={["model: Gemini Flash", "key server-side", "refusal fallback"]} />
            <Arrow x1={230} y1={80} x2={290} y2={140} label="aggregates" />
            <Arrow x1={230} y1={240} x2={290} y2={185} />
            <Arrow x1={500} y1={140} x2={560} y2={90} label="static" />
            <Arrow x1={760} y1={85} x2={820} y2={85} label="RLS" />
            <Arrow x1={660} y1={150} x2={660} y2={180} />
            <Arrow x1={760} y1={240} x2={820} y2={240} />
          </svg>
        </div>
      </Card>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title} title={s.title}>
            <p className="text-[13.5px] leading-relaxed text-ink-2">{s.body}</p>
          </Card>
        ))}
      </div>
      {feiReady && (
        <Card className="mt-4" title="FEI build parameters">
          <pre className="max-h-[320px] overflow-auto rounded-lg bg-surface-2 p-3 text-[11.5px] text-ink-2">
            {JSON.stringify((research.fei.meta as Record<string, unknown>)?.params ?? {}, null, 2)}
          </pre>
        </Card>
      )}
      <Card className="mt-4" title="Full research report" subtitle="outputs/tables/research_answers.md, generated from code">
        {report.map((s) => (
          <details key={s.id} className="border-t border-line py-2 first:border-t-0">
            <summary className="cursor-pointer text-[14px] font-semibold text-ink">{s.title}</summary>
            <Markdown source={s.markdown} className="mt-2 text-[13.5px]" />
          </details>
        ))}
      </Card>
      <SourceNote>Run `uv run python -m mi.foodbridge_bundle` to refresh every number on this site.</SourceNote>
    </>
  );
}
