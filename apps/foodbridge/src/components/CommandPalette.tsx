"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { equityValue, EQUITY_SHORT, research } from "@/lib/research";
import { NAV_ITEMS } from "./nav";
import { cx, Icon } from "./ui";

interface Item {
  id: string;
  kind: "page" | "county";
  label: string;
  hint: string;
  icon: string;
  run: () => void;
}

/** Fired when the palette jumps to a county, so a page that is already open can react. */
export const COUNTY_EVENT = "fb:county";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const pages: Item[] = NAV_ITEMS.map((n) => ({
      id: n.href,
      kind: "page",
      label: n.label,
      hint: n.areaLabel,
      icon: n.icon,
      run: () => router.push(n.href),
    }));
    const counties: Item[] = research.counties.map((c) => ({
      id: c.fips,
      kind: "county",
      label: `${c.name} County`,
      hint: `${EQUITY_SHORT} ${fmt.num(equityValue(c), 0)} · ${c.nonmetro ? "nonmetro" : "metro"}`,
      icon: "pin",
      run: () => {
        router.push(`/manager/map?county=${c.fips}`);
        window.dispatchEvent(new CustomEvent(COUNTY_EVENT, { detail: c.fips }));
      },
    }));
    const term = q.trim().toLowerCase();
    const all = [...pages, ...counties];
    if (!term) return pages;
    return all.filter((i) => i.label.toLowerCase().includes(term) || i.hint.toLowerCase().includes(term)).slice(0, 12);
  }, [q, router]);

  if (!open) return null;

  const choose = (i: Item | undefined) => {
    if (!i) return;
    i.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search FoodBridge"
        className="fb-fade-in w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" className="h-4 w-4 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter") choose(items[active]);
            }}
            placeholder="Search pages and counties…"
            className="h-12 flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-muted focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
        </div>
        <ul className="fb-scroll max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No match.</li>}
          {items.map((i, idx) => (
            <li key={`${i.kind}-${i.id}`} role="option" aria-selected={idx === active}>
              <button
                onMouseEnter={() => setActive(idx)}
                onClick={() => choose(i)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                  idx === active ? "bg-[var(--accent-soft)]" : "hover:bg-surface-2",
                )}
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-ink-2">
                  <Icon name={i.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{i.label}</span>
                  <span className="block truncate text-[11.5px] text-muted">{i.hint}</span>
                </span>
                <span className="text-[11px] uppercase tracking-wide text-muted">{i.kind === "page" ? "Page" : "County"}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span className="ml-auto">Counties open in the map explorer</span>
        </div>
      </div>
    </div>
  );
}
