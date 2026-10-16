export const fmt = {
  int(v: number | null | undefined): string {
    return v == null || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US");
  },
  num(v: number | null | undefined, digits = 1): string {
    return v == null || !Number.isFinite(v)
      ? "—"
      : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  },
  pct(v: number | null | undefined, digits = 0): string {
    return v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`;
  },
  signedPct(v: number | null | undefined, digits = 0): string {
    if (v == null || !Number.isFinite(v)) return "—";
    const s = (v * 100).toFixed(digits);
    return `${v > 0 ? "+" : ""}${s}%`;
  },
  usd(v: number | null | undefined, digits = 0): string {
    return v == null || !Number.isFinite(v)
      ? "—"
      : v.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  },
  compact(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v)) return "—";
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  },
  date(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  },
};

/** CSV cell that cannot be read as a spreadsheet formula. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
