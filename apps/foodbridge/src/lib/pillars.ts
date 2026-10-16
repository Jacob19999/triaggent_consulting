import type { Pillar } from "./types";

/** FEI pillars as specified for task A4 (FEI = 100 · Σ weight × pillar, each pillar 0–1, 1 = worst). */
export const PILLARS: { key: Pillar; label: string; weight: number; color: string; what: string }[] = [
  {
    key: "N",
    label: "Need",
    weight: 0.25,
    color: "var(--p-n)",
    what: "Economic need: county share below 200% of poverty, rent burden and unemployment, plus the tract SVI socioeconomic percentile.",
  },
  {
    key: "S",
    label: "Supply",
    weight: 0.25,
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
