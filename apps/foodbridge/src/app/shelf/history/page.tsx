"use client";

import Link from "next/link";
import { TimeChart } from "@/components/charts";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { useMyShelf } from "@/components/useMyShelf";
import { monthLabel } from "@/lib/calendar";
import { downloadText, fmt, toCsv } from "@/lib/format";

export default function HistoryPage() {
  const { shelf, outlook } = useMyShelf();
  if (!shelf || !outlook) return <Empty title="No shelf selected." />;
  const rows = [...outlook.reports].reverse();
  const exportCsv = () =>
    downloadText(
      `${shelf.name.replace(/\W+/g, "-").toLowerCase()}-reports.csv`,
      toCsv(
        outlook.reports.map((r) => ({
          month: r.month,
          HouseholdsReg: r.households,
          IndividualsReg: r.individuals,
          ChildrenReg: r.children,
          AdultsReg: r.adults,
          SeniorsReg: r.seniors,
          PoundsReg: r.pounds_distributed,
          pounds_received: r.pounds_received ?? "",
          inventory_lbs: r.inventory_lbs ?? "",
          volunteer_hours: r.volunteer_hours ?? "",
          turned_away: r.turned_away ?? "",
          notes: r.notes ?? "",
        })),
      ),
    );
  return (
    <>
      <PageHeader
        eyebrow="History"
        title={shelf.is_demo ? "Network reports" : "Your reports"}
        description={
          shelf.is_demo
            ? "County totals from the statewide extract, plus any month added in this browser. Edit a month to correct it; the forecast updates immediately."
            : "Every month you have submitted. Edit a month to correct it; the forecast updates immediately."
        }
        actions={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Visits">
          <TimeChart points={outlook.reports.map((r) => ({ month: r.month, value: r.households }))} color="var(--sig-households)" label="Visits" height={180} />
        </Card>
        <Card title="Pounds distributed">
          <TimeChart points={outlook.reports.map((r) => ({ month: r.month, value: r.pounds_distributed }))} color="var(--sig-pounds)" label="Pounds" height={180} />
        </Card>
        <Card title="Individuals served">
          <TimeChart points={outlook.reports.map((r) => ({ month: r.month, value: r.individuals }))} color="var(--sig-individuals)" label="Individuals" height={180} />
        </Card>
      </div>
      <Card className="mt-4">
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {["Month", "Visits", "Individuals", "Children", "Adults", "Seniors", "Pounds out", "Pounds in", "On hand", "Turned away", ""].map((h) => (
                  <th key={h} className="py-1.5 pr-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-medium text-ink">{monthLabel(r.month)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.households)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.individuals)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.children)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.adults)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.seniors)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.pounds_distributed)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.pounds_received)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.inventory_lbs)}</td>
                  <td className="py-1.5 pr-2">{fmt.int(r.turned_away)}</td>
                  <td className="py-1.5 text-right">
                    <Link className="text-[12.5px] text-accent underline" href={`/shelf/report?month=${r.month}`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
