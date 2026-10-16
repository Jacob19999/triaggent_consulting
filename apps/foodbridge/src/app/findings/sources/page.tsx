import { Card, PageHeader, SourceNote } from "@/components/ui";
import { research } from "@/lib/research";

export const metadata = { title: "Sources" };

export default function Sources() {
  const fei = research.fei.source ?? {};
  return (
    <>
      <PageHeader
        eyebrow="Sources & data"
        title="Every file behind the numbers"
        description="Each table the app reads, with publisher, vintage, what it means and its SHA-256 at build time. The full public-source catalog is docs/sources/catalog.md in the repository."
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 pr-3 font-medium">File</th>
                <th className="py-1.5 pr-3 font-medium">Publisher</th>
                <th className="py-1.5 pr-3 font-medium">Vintage</th>
                <th className="py-1.5 pr-3 font-medium">Meaning</th>
                <th className="py-1.5 font-medium">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {research.sources.map((s) => (
                <tr key={s.file} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-mono text-[12px] text-ink">{s.file}</td>
                  <td className="py-2 pr-3 text-ink-2">{s.publisher}</td>
                  <td className="py-2 pr-3 text-ink-2">{s.vintage}</td>
                  <td className="py-2 pr-3 text-ink-2">{s.meaning}</td>
                  <td className="py-2 font-mono text-[11px] text-muted">{s.sha256?.slice(0, 12) ?? "—"}</td>
                </tr>
              ))}
              {research.fei.status === "ready" && (
                <tr className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-mono text-[12px] text-ink">{fei.counties} · {fei.tracts} · {fei.meta}</td>
                  <td className="py-2 pr-3 text-ink-2">Team analysis · FEI (task A4{fei.commit ? `, commit ${fei.commit}` : ""})</td>
                  <td className="py-2 pr-3 text-ink-2">2024 reporting network · Census 2020 · SVI 2022 · SRAM 2025</td>
                  <td className="py-2 pr-3 text-ink-2">Food Access Equity Index, pillars and validation.</td>
                  <td className="py-2 font-mono text-[11px] text-muted">{fei.counties_sha256?.slice(0, 12)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mt-4" title="Policy timeline" subtitle="docs/reference/policy_events.csv · primary sources accessed 2026-10-10">
        <ul className="divide-y divide-line text-[13px]">
          {research.policy.map((e) => (
            <li key={e.id} className="py-2">
              <span className="tabular font-medium text-ink">{e.start}</span> · {e.program} · {e.name}{" "}
              <a className="text-accent underline" href={e.url} target="_blank" rel="noreferrer noopener">
                {e.publisher}
              </a>
            </li>
          ))}
        </ul>
      </Card>
      <SourceNote>
        Feeding America Map the Meal Gap (2024, 2025 v2 and 2026 editions) is a licensed input to Q1 and Q6. It is cited, never
        redistributed: this app carries no county Map the Meal Gap value.
      </SourceNote>
    </>
  );
}
