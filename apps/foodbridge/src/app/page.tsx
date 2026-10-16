"use client";

import Link from "next/link";
import { BrandMark } from "@/components/AppShell";
import { useData } from "@/components/DataProvider";
import { setThemePref, useTheme } from "@/components/theme";
import { Badge, buttonClass, cx, Icon } from "@/components/ui";
import { monthLabel } from "@/lib/calendar";
import { liveAvailable } from "@/lib/config";
import { fmt } from "@/lib/format";
import { feiReady, research } from "@/lib/research";

export default function Home() {
  const { setRole, setMode, session } = useData();
  const theme = useTheme();
  const stats = research.findings.stats;
  const q1Rate = stats.q1_rate.find((r) => r.signal === "IndividualsTotal");
  const q1Count = stats.q1_count.find((r) => r.signal === "IndividualsTotal");
  const visits = stats.q7_state.find((r) => r.signal === "HouseholdsTotal");
  const kpis = (research.fei.meta?.kpis ?? {}) as { residents_beyond?: number; residents_top_quintile?: number };

  const doors = [
    {
      href: "/manager",
      role: "manager" as const,
      icon: "dashboard",
      title: "Manager workspace",
      body: "Equity index overview, a layered Minnesota map, a site planner that finds the best new locations, supply allocation, shelf priorities, alerts and an AI briefing.",
      tags: ["Map explorer", "Site planner", "Allocation"],
    },
    {
      href: "/shelf",
      role: "shelf" as const,
      icon: "store",
      title: "Food shelf portal",
      body: "Submit the monthly report, see next month's forecast, get early warnings on stock and capacity, and request support from the food bank.",
      tags: ["Monthly report", "Forecast", "Requests"],
    },
    {
      href: "/findings",
      role: null,
      icon: "book",
      title: "Findings & presentation",
      body: "The answers to Q1, Q4, Q5, Q6, Q7 and Q8 with their numbers, the deck, the technical method and every source.",
      tags: ["Story", "Deck", "Sources"],
    },
  ];

  const tiles = [
    { label: "Counts track size", value: `ρ ${fmt.num(q1Count?.correlation, 2)}`, sub: "Individuals served vs food-insecure persons, 2024 (Q1)" },
    { label: "Rates do not", value: `ρ ${fmt.num(q1Rate?.correlation, 2)}`, sub: `Per-resident activity vs food-insecurity rate, 95% ${fmt.num(q1Rate?.lo95, 2)} to ${fmt.num(q1Rate?.hi95, 2)}` },
    ...(feiReady && kpis.residents_beyond
      ? [{ label: "Beyond reach of a shelf", value: fmt.compact(kpis.residents_beyond), sub: "Residents beyond 1 mi (urban) or 10 mi (rural) of a reporting shelf" }]
      : []),
    { label: "August 2026 · forecast", value: fmt.int(visits?.yhat), sub: "Statewide visits (HouseholdsReg), internal forecast, not an actual" },
  ];

  return (
    <div className="min-h-dvh">
      <section className="relative overflow-hidden bg-[var(--rail)] text-[var(--rail-ink)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(900px 420px at 85% -10%, rgba(60,207,159,0.22), transparent 60%), radial-gradient(700px 380px at -10% 110%, rgba(57,135,229,0.18), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          <header className="flex h-16 items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <span className="text-[16px] font-semibold tracking-[-0.01em]">FoodBridge</span>
            <span className="hidden text-[11px] font-medium tracking-[0.14em] text-[var(--rail-muted)] sm:inline">NETWORK INTELLIGENCE</span>
            <span className="flex-1" />
            {!session.signedIn && <Badge tone="lime">Demo workspace</Badge>}
            <button
              onClick={() => setThemePref(theme === "dark" ? "light" : "dark")}
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--rail-muted)] hover:bg-white/10 hover:text-white"
              aria-label="Switch theme"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </header>
          <div className="pb-16 pt-10 sm:pt-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-[var(--rail-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3ccf9f]" /> Research observed to {monthLabel(research.meta.observed_end)} · FEI{" "}
              {feiReady ? "loaded" : "pending"}
            </div>
            <h1 className="mt-5 max-w-3xl text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[52px]">
              See where need and demand split, and act on it the same week.
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--rail-muted)]">
              The Food Group can see who shows up. It cannot see who never does. FoodBridge puts the access equity index, county
              forecasts, site planning and each shelf&apos;s monthly numbers in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/manager" onClick={() => setRole("manager")} className={cx(buttonClass("primary"), "h-11 px-5 text-[14.5px]")}>
                Open manager workspace <Icon name="arrow" />
              </Link>
              <Link
                href="/manager/scenarios"
                onClick={() => setRole("manager")}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-white/20 px-5 text-[14.5px] font-medium text-white hover:bg-white/10"
              >
                <Icon name="target" /> Try the site planner
              </Link>
            </div>
            <div className={cx("mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2", tiles.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
              {tiles.map((t) => (
                <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--rail-muted)]">{t.label}</div>
                  <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">{t.value}</div>
                  <div className="mt-1 text-[12.5px] leading-snug text-[var(--rail-muted)]">{t.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main id="main" className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Workspaces</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          {doors.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              onClick={() => d.role && setRole(d.role)}
              className="group rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lg)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-accent">
                <Icon name={d.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-ink">{d.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{d.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {d.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent">
                Open <Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-[13.5px] leading-relaxed text-ink-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Icon name="info" className="h-4 w-4 text-accent" /> What the numbers are
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                County research (forecasts, need screen, LILA, distances) comes from the team&apos;s analysis, observed to{" "}
                {monthLabel(research.meta.observed_end)}.
              </li>
              <li>
                {feiReady
                  ? "The Food Access Equity Index is loaded from the FEI build: county and tract aggregates only."
                  : "The Food Access Equity Index is being built (task A4); until it lands, maps show the Q6 need screen, labelled as a placeholder."}
              </li>
              <li>
                Each &ldquo;County network&rdquo; is that county&apos;s reporting food shelves summed by month (HouseholdsReg,
                IndividualsReg, age split, PoundsReg) from the statewide extract. No individual shelf is shown; a county with one
                reporting site still reflects that site&apos;s totals.
              </li>
            </ul>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-[13.5px] leading-relaxed text-ink-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Icon name="user" className="h-4 w-4 text-accent" /> Live workspace
            </h2>
            <p className="mt-2">
              With Supabase configured, managers and shelf staff sign in, and reports, requests and alert follow-up are shared
              across devices. Row-level security limits each shelf to its own records.
            </p>
            {liveAvailable ? (
              <button onClick={() => setMode("live")} className="mt-3 inline-flex items-center gap-1 font-medium text-accent underline">
                Sign in <Icon name="arrow" className="h-4 w-4" />
              </button>
            ) : (
              <p className="mt-3 text-muted">Not configured on this deployment. The county networks work without it.</p>
            )}
          </div>
        </div>
        <p className="mt-8 text-[11.5px] text-muted">
          FoodBridge shows county and tract aggregates only. No site addresses, sponsor microdata or licensed Map the Meal Gap values are
          published. Built for The Food Group network, MinneMUDAC 2026.
        </p>
      </main>
    </div>
  );
}
