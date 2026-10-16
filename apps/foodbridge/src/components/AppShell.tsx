"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { monthLabel } from "@/lib/calendar";
import { liveAvailable } from "@/lib/config";
import { feiReady, research } from "@/lib/research";
import { CommandPalette } from "./CommandPalette";
import { useData } from "./DataProvider";
import { AREAS, FULL_BLEED, NAV, NAV_ITEMS, type Area } from "./nav";
import { readThemePref, setThemePref, useTheme } from "./theme";
import { Badge, cx, Icon, Select } from "./ui";

const COLLAPSE_KEY = "foodbridge.rail.collapsed";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-[10px] bg-lime text-[#143f35] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", className)}>
      <svg viewBox="0 0 40 40" className="h-[62%] w-[62%]" fill="none" stroke="currentColor" strokeWidth={3.4} aria-hidden>
        <path d="M5 27Q20 0 35 27M5 32h30M13 17v15m14-15v15" />
      </svg>
    </span>
  );
}

function ThemeToggle() {
  const theme = useTheme();
  return (
    <button
      type="button"
      onClick={() => setThemePref(theme === "dark" ? "light" : "dark")}
      className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" />
    </button>
  );
}

export function AppShell({ area, children }: { area: Area; children: ReactNode }) {
  const pathname = usePathname();
  const { session, data, setShelf, setRole, setMode, signOut, alerts, asOf } = useData();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const live = session.mode === "live";
  const openAlerts = alerts.filter((a) => a.severity !== "info").length;
  const shelfOptions = data.shelves.filter((s) => s.active);
  const fullBleed = FULL_BLEED.includes(pathname);
  // Map workspaces need the width: below 1536px the rail starts collapsed there.
  const [wideScreen, setWideScreen] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1536px)");
    const on = () => setWideScreen(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [railOverride, setRailOverride] = useState<boolean | null>(null);
  useEffect(() => setRailOverride(null), [pathname]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // default expanded
    }
    // Make sure a stored "system" preference follows the OS during this visit.
    if (readThemePref() === "system") setThemePref("system");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const autoCollapse = fullBleed && !wideScreen;
  const railCollapsed = railOverride ?? (collapsed || autoCollapse);
  const toggleCollapsed = () => {
    if (autoCollapse) {
      setRailOverride(!railCollapsed);
      return;
    }
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // not persisted
      }
      return !c;
    });
  };

  const current =
    NAV_ITEMS.filter((i) => i.area === area && (i.href === pathname || (i.href !== `/${area}` && pathname.startsWith(i.href))))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null;
  const areaLabel = AREAS.find((a) => a.id === area)?.label ?? "";

  // Live accounts: pending users wait for approval; shelf users stay in their portal.
  // Row-level security is the real boundary; this keeps the screens honest.
  const gate =
    live && area !== "findings" && session.liveRole === "pending" ? (
      <div className="mx-auto mt-10 max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
        <h1 className="text-[18px] font-semibold text-ink">Your account is waiting for approval</h1>
        <p className="mt-2 text-[14px] text-ink-2">
          {session.email ?? "This account"} is signed in, but a network manager has not given it a role yet. You can browse
          the findings meanwhile.
        </p>
        <Link href="/findings" className="mt-4 inline-block text-[14px] font-medium text-accent underline">
          Open findings
        </Link>
      </div>
    ) : live && area === "manager" && session.liveRole === "shelf" ? (
      <div className="mx-auto mt-10 max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center">
        <h1 className="text-[18px] font-semibold text-ink">The manager workspace is for network managers</h1>
        <p className="mt-2 text-[14px] text-ink-2">Your account is linked to a food shelf.</p>
        <Link href="/shelf" className="mt-4 inline-block text-[14px] font-medium text-accent underline">
          Go to your shelf
        </Link>
      </div>
    ) : null;

  const narrow = railCollapsed && !open;

  const rail = (
    <div className="flex h-full flex-col">
      <div className={cx("flex h-14 shrink-0 items-center border-b border-[var(--rail-line)]", narrow ? "justify-center px-2" : "gap-2.5 px-4")}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="FoodBridge home">
          <BrandMark />
          {!narrow && (
            <span className="min-w-0 leading-tight">
              <span className="block text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--rail-ink)]">FoodBridge</span>
              <span className="block text-[10px] font-medium tracking-[0.14em] text-[var(--rail-muted)]">NETWORK INTELLIGENCE</span>
            </span>
          )}
        </Link>
      </div>

      <div className={cx("pt-3", narrow ? "px-2" : "px-3")}>
        <div className={cx("grid gap-1 rounded-lg bg-[var(--rail-2)] p-1", narrow ? "grid-cols-1" : "grid-cols-3")} role="tablist" aria-label="Workspace">
          {AREAS.filter((a) => !(live && session.liveRole === "shelf" && a.id === "manager")).map((a) => (
            <Link
              key={a.id}
              href={a.href}
              role="tab"
              aria-selected={a.id === area}
              title={a.label}
              onClick={() => {
                setOpen(false);
                if (!live && a.id !== "findings") setRole(a.id === "shelf" ? "shelf" : "manager");
              }}
              className={cx(
                "flex items-center justify-center gap-1 rounded-md py-1.5 text-[11.5px] font-semibold transition-colors",
                a.id === area ? "bg-lime text-[#143f35]" : "text-[var(--rail-muted)] hover:text-[var(--rail-ink)]",
              )}
            >
              {narrow ? <Icon name={a.icon} className="h-4 w-4" /> : a.label}
            </Link>
          ))}
        </div>
      </div>

      <nav aria-label={`${areaLabel} navigation`} className={cx("fb-scroll mt-2 flex-1 overflow-y-auto pb-3", narrow ? "px-2" : "px-3")}>
        {NAV[area].map((group) => (
          <div key={group.label} className="mt-3">
            {!narrow && (
              <div className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--rail-muted)] opacity-80">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = current?.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      title={narrow ? item.label : undefined}
                      className={cx(
                        "relative flex items-center gap-2.5 rounded-lg py-2 text-[13.5px] transition-colors",
                        narrow ? "justify-center px-0" : "px-2.5",
                        active
                          ? "bg-[var(--rail-2)] font-medium text-[var(--rail-ink)]"
                          : "text-[var(--rail-muted)] hover:bg-[var(--rail-2)] hover:text-[var(--rail-ink)]",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-lime" aria-hidden />}
                      <Icon name={item.icon} className={cx("h-[17px] w-[17px] shrink-0", active && "text-lime")} />
                      {!narrow && <span className="flex-1 truncate">{item.label}</span>}
                      {item.href === "/manager/alerts" && openAlerts > 0 && (
                        <span
                          className={cx(
                            "rounded-full bg-[var(--critical)] px-1.5 text-[10.5px] font-semibold text-white",
                            narrow && "absolute right-1 top-1",
                          )}
                        >
                          {openAlerts}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cx("shrink-0 border-t border-[var(--rail-line)]", narrow ? "p-2" : "p-3")}>
        {!narrow ? (
          <div className="rounded-lg bg-[var(--rail-2)] p-3 text-[11.5px] text-[var(--rail-muted)]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--rail-ink)]">
              <span className={cx("h-2 w-2 rounded-full", live ? "bg-[#3ccf9f]" : "bg-[var(--warning)]")} />
              {live ? "Live workspace" : "Demo workspace"}
            </div>
            <p className="mt-1 leading-snug">
              {live
                ? `Signed in${session.email ? ` as ${session.email}` : ""} · ${session.liveRole}`
                : "Synthetic demo shelves in this browser."}
            </p>
            <p className="mt-1.5 leading-snug">
              Research to {monthLabel(research.meta.observed_end)} · FEI {feiReady ? "loaded" : "pending"}. Aug 2026 values are
              forecasts.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[var(--rail-ink)]">
              {live ? (
                <button className="underline" onClick={() => void signOut()}>
                  Sign out
                </button>
              ) : liveAvailable ? (
                <button className="underline" onClick={() => setMode("live")}>
                  Sign in to live workspace
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid place-items-center py-1" title={live ? "Live workspace" : "Demo workspace"}>
            <span className={cx("h-2.5 w-2.5 rounded-full", live ? "bg-[#3ccf9f]" : "bg-[var(--warning)]")} />
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="mt-2 hidden w-full items-center justify-center gap-2 rounded-lg py-1.5 text-[12px] text-[var(--rail-muted)] hover:bg-[var(--rail-2)] hover:text-[var(--rail-ink)] lg:flex"
          aria-label={railCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <Icon name={railCollapsed ? "expand" : "collapse"} className="h-4 w-4" />
          {!narrow && "Collapse"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-[900] w-[252px] -translate-x-full bg-[var(--rail)] transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open && "translate-x-0",
          railCollapsed && "lg:w-[64px]",
        )}
      >
        {rail}
      </aside>
      {open && <button aria-label="Close menu" className="fixed inset-0 z-[850] bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[800] flex h-14 shrink-0 items-center gap-3 border-b border-line bg-[var(--glass)] px-3 backdrop-blur-md sm:px-5">
          <button className="rounded-md p-1.5 text-ink lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Icon name="list" className="h-5 w-5" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <Link href={`/${area}`} className="hidden text-muted hover:text-ink sm:inline">
              {areaLabel}
            </Link>
            {current && (
              <>
                <Icon name="chevron" className="hidden h-3.5 w-3.5 text-muted sm:inline" />
                <span className="truncate font-semibold text-ink">{current.label}</span>
              </>
            )}
          </nav>
          <div className="flex-1" />
          <button
            onClick={() => setPalette(true)}
            className="hidden h-8 min-w-[240px] items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 text-[12.5px] text-muted hover:border-line-strong md:flex"
            aria-label="Search pages and counties"
          >
            <Icon name="search" className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Search counties, pages…</span>
            <kbd className="rounded border border-line bg-surface px-1 text-[10.5px]">Ctrl K</kbd>
          </button>
          <button className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 md:hidden" aria-label="Search" onClick={() => setPalette(true)}>
            <Icon name="search" className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-1.5 xl:flex">
            {!live && <Badge tone="demo">Demo data</Badge>}
            <Badge>
              <Icon name="history" className="h-3 w-3" /> As of {monthLabel(asOf)}
            </Badge>
          </div>
          {area === "shelf" && shelfOptions.length > 0 && !(live && session.liveRole === "shelf") && (
            <div className="w-[210px]">
              <label className="sr-only" htmlFor="shelf-pick">
                Shelf
              </label>
              <Select id="shelf-pick" value={session.shelfId ?? ""} onChange={(e) => setShelf(e.target.value)} className="h-8 text-[12.5px]">
                {shelfOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <ThemeToggle />
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-[11.5px] font-semibold text-ink-2 ring-1 ring-line"
            title={live ? (session.email ?? "Signed in") : "Demo user"}
          >
            {live && session.email ? session.email.slice(0, 2).toUpperCase() : <Icon name="user" className="h-4 w-4" />}
          </span>
        </header>

        {fullBleed && !gate ? (
          <main id="main" className="min-h-0 flex-1">
            {children}
          </main>
        ) : (
          <>
            <main id="main" className="mx-auto w-full max-w-[1840px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
              {gate ?? children}
            </main>
            <footer className="mx-auto w-full max-w-[1840px] px-4 pb-6 text-[11px] text-muted sm:px-6 lg:px-8">
              FoodBridge shows county and tract aggregates only. No site addresses, sponsor microdata or licensed Map the Meal Gap
              values are published. Built for The Food Group network, MinneMUDAC 2026.
            </footer>
          </>
        )}
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
