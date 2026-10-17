"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import { firstEntry, handoffUrl, isLaptopLike, qrMatrix, qrPath, QR_QUIET_ZONE } from "@/lib/handoff";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Bottom-corner card with a QR code of the current page, shown on a laptop or desktop at the
 * first page of a session. Closing it hides it for the rest of the session. The encoder loads
 * only when the card is shown. */
export function QrHandoff() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<{ url: string; path: string; size: number } | null>(null);

  useEffect(() => {
    if (isLaptopLike(window) && firstEntry(sessionStore())) setOpen(true);
  }, []);

  // Follow the page the visitor is on while the card is open.
  useEffect(() => {
    if (!open) return;
    const url = handoffUrl(window.location);
    let live = true;
    import("qrcode-generator")
      .then(({ default: qrcode }) => {
        if (!live) return;
        const modules = qrMatrix(qrcode, url);
        setCode({ url, path: qrPath(modules), size: modules.length + 2 * QR_QUIET_ZONE });
      })
      .catch(() => live && setOpen(false));
    return () => {
      live = false;
    };
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  if (!open || !code) return null;
  return (
    <aside
      aria-label="Open this page on a phone or tablet"
      className="fb-fade-in fixed bottom-4 right-4 z-[1050] flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-lg)]"
    >
      {/* Dark on white in both themes: scanners need the contrast and the light border. */}
      <svg
        viewBox={`0 0 ${code.size} ${code.size}`}
        width={112}
        height={112}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${code.url}`}
        className="shrink-0 rounded-md"
      >
        <rect width={code.size} height={code.size} fill="#ffffff" />
        <path d={code.path} fill="#000000" />
      </svg>
      <div className="w-[168px] pt-0.5">
        <p className="text-[13.5px] font-semibold text-ink">Open on your phone or tablet</p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">Scan to view this page on your own device.</p>
        <p className="mt-2 truncate text-[11.5px] text-muted" title={code.url}>
          {code.url.replace(/^https?:\/\//, "")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close QR code"
        className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
    </aside>
  );
}
