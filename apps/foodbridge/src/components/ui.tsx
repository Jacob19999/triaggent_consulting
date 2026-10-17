import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import type { Severity } from "@/lib/alerts";
import { InfoTip, type Info } from "./InfoTip";

export type { Info };

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const PATHS: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  index: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14",
  scenario: "M12 2v4m0 12v4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.6-8.6 2.8-2.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5A2.5 2.5 0 0 1 4 18.5",
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5z",
  form: "M9 3h6v4H9zM6 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M8 12h8M8 16h5",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2m3.5-7h13L22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7l3.5-7z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  critical: "M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9L7.9 2zM12 8v4m0 4h.01",
  serious: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01",
  warning: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v5m0 3h.01",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 14v-4m0-4h.01",
  check: "M20 6 9 17l-5-5",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6 6-6-6 6-6",
  x: "M18 6 6 18M6 6l12 12",
  store: "M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  present: "M2 3h20v13H2zM8 21h8m-4-5v5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  user: "M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  layers: "m12 2 10 5-10 5L2 7l10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  pin: "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  scale: "M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7zm14 0-3 7a4 4 0 0 0 6 0l-3-7zM8 21h8",
  chevron: "m9 18 6-6-6-6",
  chevronDown: "m6 9 6 6 6-6",
  collapse: "M11 17l-5-5 5-5m7 10-5-5 5-5",
  expand: "m13 17 5-5-5-5M6 17l5-5-5-5",
  command: "M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6z",
  bolt: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  box: "M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7zM3.3 7 12 12l8.7-5M12 22V12",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h4m4 4v6a4 4 0 0 1-4 4h-4",
  reset: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8m0-5v5h5",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
  child: "M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 22v-7l-2-1 2-5h8l2 5-2 1v7",
};

export function Icon({ name, className = "h-4 w-4", title }: { name: string; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
  icon,
  info,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: string;
  /** Click-to-open explanation: what the panel shows, how it is calculated, source. */
  info?: Info;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow)]",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {(title || actions) && (
        <header className={cx("mb-3.5 flex flex-wrap items-start justify-between gap-2", !padded && "px-4 pt-4 sm:px-5")}>
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && (
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-accent">
                <Icon name={icon} className="h-[15px] w-[15px]" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="flex items-center gap-1.5 text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
                  {title}
                  {info && <InfoTip info={info} label={`About ${typeof title === "string" ? title : "this panel"}`} />}
                </h2>
              )}
              {subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
  accent,
  info,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "forecast";
  icon?: string;
  accent?: string;
  info?: Info;
  children?: ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent ?? "var(--accent)" }} aria-hidden />
      {/* Two label lines are reserved so values in one row line up when a neighbour's label wraps. */}
      <div className="flex min-h-[2lh] items-start justify-between gap-2 text-[11.5px] leading-tight">
        <span className="min-w-0 break-words font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {info && <InfoTip info={info} label={`About ${typeof label === "string" ? label : "this figure"}`} />}
          {icon && <Icon name={icon} className="h-4 w-4 text-muted" />}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</span>
        {tone === "forecast" && <ForecastBadge />}
      </div>
      {sub && <div className="mt-2 text-[12.5px] leading-snug text-ink-2">{sub}</div>}
      {children}
    </div>
  );
}

export function ForecastBadge() {
  return (
    <span className="rounded border border-dashed border-current px-1 py-px text-[10px] font-semibold tracking-wide text-muted normal-case">
      FORECAST
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "lime" | "demo" | "accent" | "critical";
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2 border-line",
    green: "bg-[var(--accent-soft)] text-accent border-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
    accent: "bg-accent text-[var(--accent-ink)] border-accent",
    lime: "bg-lime text-[#143f35] border-lime",
    demo: "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning-text)] border-[color-mix(in_srgb,var(--warning)_40%,transparent)]",
    critical:
      "bg-[color-mix(in_srgb,var(--critical)_14%,transparent)] text-[var(--critical-text)] border-[color-mix(in_srgb,var(--critical)_35%,transparent)]",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

const SEV_TEXT: Record<Severity, string> = {
  critical: "text-[var(--critical-text)]",
  serious: "text-[var(--serious-text)]",
  warning: "text-[var(--warning-text)]",
  info: "text-ink-2",
};
const SEV_DOT: Record<Severity, string> = {
  critical: "bg-[var(--critical)]",
  serious: "bg-[var(--serious)]",
  warning: "bg-[var(--warning)]",
  info: "bg-[var(--seq-3)]",
};

/** Status color always ships with an icon and a label (never color alone). */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const label = { critical: "Critical", serious: "Serious", warning: "Warning", info: "Info" }[severity];
  return (
    <span className={cx("inline-flex items-center gap-1 text-[12px] font-semibold", SEV_TEXT[severity])}>
      <span className={cx("inline-block h-2 w-2 rounded-full", SEV_DOT[severity])} aria-hidden />
      <Icon name={severity} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  const v = {
    primary: "bg-accent text-[var(--accent-ink)] border-accent hover:bg-[var(--accent-hover)] shadow-[var(--shadow)]",
    secondary: "bg-surface text-ink border-line-strong hover:bg-surface-2",
    ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink",
    danger: "bg-surface text-[var(--critical-text)] border-line hover:bg-surface-2",
  }[variant];
  const s = size === "sm" ? "h-8 px-2.5 text-[12.5px]" : size === "lg" ? "h-10 px-4 text-[14px]" : "h-9 px-3.5 text-[13.5px]";
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        v,
        s,
        className,
      )}
    />
  );
}

/** Link styled as a button (keeps one look for actions that navigate). */
export function buttonClass(variant: "primary" | "secondary" | "ghost" = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors",
    size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]",
    variant === "primary" && "bg-accent text-[var(--accent-ink)] border-accent hover:bg-[var(--accent-hover)] shadow-[var(--shadow)]",
    variant === "secondary" && "bg-surface text-ink border-line-strong hover:bg-surface-2",
    variant === "ghost" && "bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink",
  );
}

export function Field({ label, hint, children, error }: { label: ReactNode; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11.5px] leading-snug text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-[12px] text-[var(--critical-text)]">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13.5px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]",
        props.className,
      )}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-accent">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11.5px] leading-snug text-muted">{children}</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-6 text-center">
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function Meter({ value, color = "var(--seq-3)", label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
      role="meter"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

/** Segmented control (a small set of mutually exclusive views). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: string; disabled?: boolean; title?: string }[];
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-3 text-[12.5px]",
            value === o.value
              ? "bg-surface text-ink shadow-[var(--shadow)] ring-1 ring-[color-mix(in_srgb,var(--accent)_55%,transparent)] dark:bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface))]"
              : "text-muted hover:text-ink",
          )}
        >
          {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small uppercase label that heads a group of controls in a side panel. */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>
      {action}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  swatch,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  swatch?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md py-1 text-[13px] text-ink">
      <span className="relative mt-[1px] inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-[18px] w-8 rounded-full bg-surface-3 ring-1 ring-line-strong transition-colors peer-checked:bg-accent peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]" />
        <span className="absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {swatch}
          {label}
        </span>
        {hint && <span className="block text-[11.5px] leading-snug text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

/** Before → after with the change; `better` says which direction is good. */
export function Delta({
  before,
  after,
  digits = 1,
  better = "down",
  format,
}: {
  before?: number | null;
  after?: number | null;
  digits?: number;
  better?: "down" | "up";
  format?: (v: number) => string;
}) {
  if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after))
    return <span className="text-muted">—</span>;
  const f =
    format ??
    ((v: number) => v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  const d = after - before;
  const good = better === "down" ? d < 0 : d > 0;
  return (
    <span className="tabular inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-muted">{f(before)}</span>
      <span className="text-muted">→</span>
      <span className="font-semibold text-ink">{f(after)}</span>
      <span className={cx("text-[12px] font-semibold", Math.abs(d) < 1e-9 ? "text-muted" : good ? "text-[var(--good-text)]" : "text-[var(--critical-text)]")}>
        {d > 0 ? "▲" : d < 0 ? "▼" : "•"} {f(Math.abs(d))}
      </span>
    </span>
  );
}
