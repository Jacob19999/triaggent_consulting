"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SEVERITY_LABEL } from "@/lib/alerts";
import { rollupCountyAlerts, type CountyAlertRollup } from "@/lib/countyAlertIndex";
import { research } from "@/lib/research";
import { useData } from "./DataProvider";
import { cx, Icon, SeverityBadge } from "./ui";

/** County picker for the briefing. Open alerts stay at the top of the list, with a severity label on each row. */
export function CountyAlertSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const { alerts, alertState } = useData();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const rollup = useMemo(
    () => rollupCountyAlerts(research.counties, alerts, (key) => alertState(key)?.status === "resolved"),
    [alerts, alertState],
  );
  const byName = useMemo(() => new Map(rollup.map((r) => [r.name, r])), [rollup]);
  const selected = byName.get(value);

  const term = q.trim().toLowerCase();
  const match = (name: string) => !term || name.toLowerCase().includes(term);
  const flagged = rollup.filter((r) => match(r.name));
  const quiet = research.counties.filter((c) => !byName.has(c.name) && match(c.name));
  const flat = [...flagged.map((r) => r.name), ...quiet.map((c) => c.name)];

  useEffect(() => {
    setActive(-1);
  }, [term]);

  const choose = (name: string) => {
    onChange(name);
    setQ("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && active >= 0 && flat[active]) {
      e.preventDefault();
      choose(flat[active]);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active, term]);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">County</span>
        <span className="text-[11.5px] text-muted">
          {rollup.length === 0 ? "No open alerts" : `${rollup.length} with open alerts`}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-ink">{value}</div>
            <div className="truncate text-[12px] text-muted">
              {selected ? shortTitle(value, selected.title) : "No open alert"}
            </div>
          </div>
          {selected && (
            <span className="flex shrink-0 items-center gap-1.5">
              <SeverityBadge severity={selected.severity} />
              <span className="tabular text-[12px] font-semibold text-ink">{selected.count}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 border-b border-line px-2.5">
          <Icon name="search" className="h-3.5 w-3.5 shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search counties"
            aria-label="Search counties"
            aria-controls="county-briefing-list"
            aria-activedescendant={flat[active] ? optId(flat[active]) : undefined}
            className="h-8 w-full bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <ul
          id="county-briefing-list"
          ref={listRef}
          role="listbox"
          aria-label="Counties"
          className="fb-scroll max-h-72 overflow-y-auto p-1"
        >
          {flat.length === 0 && <li className="px-2 py-4 text-center text-[12.5px] text-muted">No county matches.</li>}
          {flagged.length > 0 && <GroupLabel>Open alerts · {flagged.length}</GroupLabel>}
          {flagged.map((r) => (
            <CountyRow
              key={r.fips}
              name={r.name}
              rollup={r}
              selected={r.name === value}
              active={flat[active] === r.name}
              onHover={() => setActive(flat.indexOf(r.name))}
              onChoose={() => choose(r.name)}
            />
          ))}
          {quiet.length > 0 && <GroupLabel>No open alerts · {quiet.length}</GroupLabel>}
          {quiet.map((c) => (
            <CountyRow
              key={c.fips}
              name={c.name}
              selected={c.name === value}
              active={flat[active] === c.name}
              onHover={() => setActive(flat.indexOf(c.name))}
              onChoose={() => choose(c.name)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function shortTitle(name: string, title: string) {
  const prefix = `${name}: `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

function optId(name: string) {
  return `county-opt-${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`;
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <li className="sticky top-0 z-[1] bg-surface px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted">
      {children}
    </li>
  );
}

function CountyRow({
  name,
  rollup,
  selected,
  active,
  onHover,
  onChoose,
}: {
  name: string;
  rollup?: CountyAlertRollup;
  selected: boolean;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const label = rollup
    ? `${name}, ${SEVERITY_LABEL[rollup.severity]}, ${rollup.count} open ${rollup.count === 1 ? "alert" : "alerts"}. ${rollup.title}`
    : `${name}, no open alert`;
  return (
    <li role="presentation">
      <button
        id={optId(name)}
        type="button"
        role="option"
        aria-selected={selected}
        data-active={active || undefined}
        title={label}
        onMouseEnter={onHover}
        onClick={onChoose}
        className={cx(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
          selected && "bg-[var(--accent-soft)] shadow-[inset_2px_0_0_var(--accent)]",
          !selected && active && "bg-surface-2",
          !selected && !active && "hover:bg-surface-2",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
          {rollup && <span className="block truncate text-[11.5px] text-muted">{shortTitle(name, rollup.title)}</span>}
        </span>
        {rollup ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <SeverityBadge severity={rollup.severity} />
            <span className="tabular min-w-4 text-right text-[12px] font-semibold text-ink">{rollup.count}</span>
          </span>
        ) : (
          selected && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-accent" />
        )}
      </button>
    </li>
  );
}
