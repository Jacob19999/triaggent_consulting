import type { Pillar } from "./types";

/** FEI pillars (each 0–1, 1 = worst). Weights per D-069: need side N 35 + V 15, access side S 15 + T 20 + M 15;
 * the two sides multiply (see `feiFromPillars`). Demographics stays 15 so race is 7.5% (D-068). */
export const PILLARS: { key: Pillar; label: string; weight: number; color: string; what: string }[] = [
  {
    key: "N",
    label: "Need",
    weight: 0.35,
    color: "var(--p-n)",
    what: "Economic need: county share below 200% of poverty, rent burden and unemployment, plus the tract SVI socioeconomic percentile.",
  },
  {
    key: "S",
    label: "Supply",
    weight: 0.15,
    color: "var(--p-s)",
    what: "Supply scarcity: 1 − normalized pounds per low-income resident per year within reach (enhanced two-step floating catchment, 2024 PoundsReg).",
  },
  {
    key: "T",
    label: "Travel",
    weight: 0.2,
    color: "var(--p-t)",
    what: "Travel burden: miles to the nearest reporting shelf, share of residents beyond 1 mile (urban) or 10 miles (rural), and the gap to a brick-and-mortar shelf.",
  },
  {
    key: "M",
    label: "Mobility",
    weight: 0.15,
    color: "var(--p-m)",
    what: "Mobility barrier: county no-vehicle households, SVI housing and transportation percentile, USDA vehicle-access LILA flag.",
  },
  {
    key: "V",
    label: "Demographics",
    weight: 0.15,
    color: "var(--p-v)",
    what: "Demographic vulnerability: SVI minority status (half the pillar), SVI household characteristics and the 2020 child share.",
  },
];

export type PillarValues = Partial<Record<Pillar, number | null | undefined>>;
export type PillarWeights = Record<Pillar, number>;

/** The two sides of FEI (mi.fei PARAMS["dimensions"]). */
export const DIMENSIONS: Record<"need" | "access", Pillar[]> = { need: ["N", "V"], access: ["S", "T", "M"] };

export const DEFAULT_FEI_WEIGHTS: PillarWeights = Object.fromEntries(PILLARS.map((p) => [p.key, p.weight])) as PillarWeights;

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Need and Access (0–1) with each side's share of the weights; null if any pillar is missing. */
export function dimensionScores(
  values: PillarValues,
  weights: PillarWeights = DEFAULT_FEI_WEIGHTS,
): Record<"need" | "access", { score: number | null; share: number }> | null {
  if (PILLARS.some((p) => !isNum(values[p.key]))) return null;
  const total = PILLARS.reduce((s, p) => s + weights[p.key], 0) || 1;
  const side = (keys: Pillar[]) => {
    const w = keys.reduce((s, k) => s + weights[k], 0);
    return { score: w > 0 ? keys.reduce((s, k) => s + weights[k] * (values[k] as number), 0) / w : null, share: w / total };
  };
  return { need: side(DIMENSIONS.need), access: side(DIMENSIONS.access) };
}

/** FEI = 100 × Need^a × Access^(1−a), a = need side's weight share (mi.fei.composite, D-069). */
export function feiFromPillars(values: PillarValues, weights: PillarWeights = DEFAULT_FEI_WEIGHTS): number | null {
  const dims = dimensionScores(values, weights);
  if (!dims) return null;
  let out = 1;
  for (const { score, share } of Object.values(dims)) if (share > 0) out *= Math.max(0, score ?? 0) ** share;
  return 100 * out;
}

/** Points per pillar that add up to FEI: FEI split between the sides by weight share, then
 * within a side by each pillar's weighted value. */
export function feiContributions(values: PillarValues, weights: PillarWeights = DEFAULT_FEI_WEIGHTS) {
  const fei = feiFromPillars(values, weights) ?? 0;
  const dims = dimensionScores(values, weights);
  return PILLARS.map((p) => {
    const side = DIMENSIONS.need.includes(p.key) ? "need" : "access";
    const keys = DIMENSIONS[side];
    const sum = keys.reduce((s, k) => s + weights[k] * (values[k] ?? 0), 0);
    const within = sum > 0 ? (weights[p.key] * (values[p.key] ?? 0)) / sum : 0;
    return { key: p.key, label: p.label, color: p.color, value: dims ? fei * dims[side].share * within : 0 };
  });
}

/** The formula with the current weights, for method text and the assistant. */
export function feiFormula(weights: PillarWeights = DEFAULT_FEI_WEIGHTS): string {
  const total = PILLARS.reduce((s, p) => s + weights[p.key], 0) || 1;
  const side = (keys: Pillar[]) => {
    const w = keys.reduce((s, k) => s + weights[k], 0);
    return { w: w / total, terms: keys.map((k) => `${(weights[k] / (w || 1)).toFixed(2)}·${k}`).join(" + ") };
  };
  const need = side(DIMENSIONS.need);
  const access = side(DIMENSIONS.access);
  return `FEI = 100 × Need^${need.w.toFixed(2)} × Access^${access.w.toFixed(2)}, Need = ${need.terms}, Access = ${access.terms}`;
}
