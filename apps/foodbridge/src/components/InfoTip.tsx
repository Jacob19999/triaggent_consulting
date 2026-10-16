"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** What a panel shows, how its numbers are made, and where they come from. */
export interface Info {
  what: ReactNode;
  how?: ReactNode;
  source?: ReactNode;
}

const WIDTH = 320;

/** Click-to-open explanation for a card or stat. Rendered in a portal with fixed
 * positioning so cards with overflow-hidden (stats, maps) cannot clip it. */
export function InfoTip({ info, label = "About this panel" }: { info: Info; label?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
    const up = r.bottom + 260 > window.innerHeight && r.top > 260;
    const top = up ? r.top - 6 : r.bottom + 6;
    setPos((p) => (p && p.top === top && p.left === left && p.up === up ? p : { top, left, up }));
  }, []);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setPos(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPos(null);
        button.current?.focus();
      }
    };
    // Follow the button while the page or a panel scrolls; close once it leaves the view.
    const follow = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) setPos(null);
      else place();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [pos, place]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={!!pos}
        aria-controls={pos ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) setPos(null);
          else place();
        }}
        className="inline-grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-line-strong text-[10.5px] font-semibold normal-case tracking-normal text-muted transition-colors hover:border-accent hover:text-accent aria-expanded:border-accent aria-expanded:text-accent"
      >
        i
      </button>
      {pos &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            style={{ top: pos.top, left: pos.left, width: WIDTH, transform: pos.up ? "translateY(-100%)" : undefined }}
            className="fixed z-[1100] rounded-xl border border-line bg-surface p-3.5 text-left text-[12.5px] normal-case leading-relaxed tracking-normal text-ink-2 shadow-[var(--shadow-lg)]"
          >
            <p className="text-ink">{info.what}</p>
            {info.how && (
              <>
                <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">How it is calculated</p>
                <div className="mt-0.5">{info.how}</div>
              </>
            )}
            {info.source && (
              <>
                <p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Source</p>
                <div className="mt-0.5 break-words font-mono text-[11px] text-muted">{info.source}</div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
