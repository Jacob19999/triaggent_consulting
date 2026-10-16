// Map color ramps. "risk" is the BEI dashboard's green → yellow → red semantic heat ramp
// (higher = more barriers); "riskSafe" swaps the green arm for blue so the two ends stay
// apart under red-green color-vision deficiency. Sequential and diverging ramps use the
// validated FoodBridge steps, stepped separately for each theme.

export type RampId = "risk" | "riskSafe" | "seq" | "div" | "gain";
export type ThemeName = "dark" | "light";

const RISK = ["#1a9850", "#66bd63", "#a6d96a", "#d9ef8b", "#fee08b", "#fdae61", "#f46d43", "#d73027", "#a50026"];
const RISK_SAFE = ["#313695", "#4575b4", "#74add1", "#abd9e9", "#fee090", "#fdae61", "#f46d43", "#d73027", "#a50026"];
const SEQ_LIGHT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const SEQ_DARK = ["#123a6b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];
const DIV_LIGHT = ["#1c5cab", "#6da7ec", "#f0efec", "#f19a99", "#c22e2e"];
const DIV_DARK = ["#3987e5", "#25558f", "#3a3d40", "#9c4444", "#e66767"];
// FEI improvement (change view): one hue, light → strong green.
const GAIN_LIGHT = ["#e3f4ea", "#a8dcbc", "#5fbf86", "#1f9a57", "#0b6b3a"];
const GAIN_DARK = ["#123526", "#17573a", "#1f8a55", "#3cc47f", "#9ff0c4"];

export function rampStops(ramp: RampId, theme: ThemeName, colorSafe = false): string[] {
  switch (ramp) {
    case "risk":
      return colorSafe ? RISK_SAFE : RISK;
    case "riskSafe":
      return RISK_SAFE;
    case "seq":
      return theme === "dark" ? SEQ_DARK : SEQ_LIGHT;
    case "div":
      return theme === "dark" ? DIV_DARK : DIV_LIGHT;
    case "gain":
      return theme === "dark" ? GAIN_DARK : GAIN_LIGHT;
  }
}

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function lerp(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[m(ar, br), m(ag, bg), m(ab, bb)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Continuous color for t in [0, 1] along the stops. */
export function colorAt(stops: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return lerp(stops[i], stops[i + 1], x - i);
}

export interface Scale {
  domain: [number, number];
  /** For diverging ramps the domain is symmetric around zero. */
  diverging: boolean;
  color: (v: number) => string;
  stops: string[];
  ticks: number[];
}

const quantile = (s: number[], q: number) => {
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
};

function nice(v: number, dir: "down" | "up"): number {
  if (v === 0 || !Number.isFinite(v)) return 0;
  const mag = 10 ** Math.floor(Math.log10(Math.abs(v)));
  const step = mag / 2;
  return dir === "down" ? Math.floor(v / step) * step : Math.ceil(v / step) * step;
}

/** A scale whose domain trims the 2% tails so a few extreme units do not wash out the map. */
export function makeScale(
  values: (number | null | undefined)[],
  ramp: RampId,
  theme: ThemeName,
  opts: { domain?: [number, number]; invert?: boolean; colorSafe?: boolean } = {},
): Scale {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  let stops = rampStops(ramp, theme, opts.colorSafe);
  if (opts.invert) stops = [...stops].reverse();
  const diverging = ramp === "div";
  let lo: number, hi: number;
  if (opts.domain) [lo, hi] = opts.domain;
  else if (!finite.length) [lo, hi] = [0, 1];
  else if (diverging) {
    const m = Math.max(Math.abs(quantile(finite, 0.02)), Math.abs(quantile(finite, 0.98))) || 1;
    [lo, hi] = [-nice(m, "up"), nice(m, "up")];
  } else {
    lo = quantile(finite, 0.02);
    hi = quantile(finite, 0.98);
    if (hi - lo < 1e-9) hi = lo + 1;
    const span = hi - lo;
    // Round outward to readable numbers when the span is not tiny.
    if (span > 4) {
      lo = nice(lo, "down");
      hi = nice(hi, "up");
    }
  }
  const color = (v: number) => colorAt(stops, (v - lo) / (hi - lo || 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));
  return { domain: [lo, hi], diverging, color, stops, ticks };
}

export function gradientCss(stops: string[]): string {
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** Readable text color on top of a fill. */
export function inkOn(fill: string): string {
  const [r, g, b] = hex(fill);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0f1b2a" : "#ffffff";
}
