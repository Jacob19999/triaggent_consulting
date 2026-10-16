import { describe, expect, it } from "vitest";
import { deck } from "@/lib/deck";
import {
  MAIN_SLIDES,
  SLIDES,
  TALK_SECONDS,
  speakerSeconds,
  statewideRunRate,
} from "@/lib/presentation";
import { research } from "@/lib/research";

describe("judging talk run sheet", () => {
  it("fits a 5–7 minute spoken slot with room for interruptions", () => {
    expect(TALK_SECONDS).toBeGreaterThanOrEqual(5 * 60);
    expect(TALK_SECONDS).toBeLessThanOrEqual(6 * 60);
    expect(MAIN_SLIDES).toHaveLength(13);
  });

  it("gives every presenter a spoken beat", () => {
    const sec = speakerSeconds();
    for (const who of ["Jacob", "Daniela", "Biruk", "Roshit"] as const) {
      expect(sec[who], `${who} is silent`).toBeGreaterThan(0);
    }
  });

  it("follows the story: problem → need measure → Q1, Q6, Q8, Q4, Q5 → Q7 → tool → Monday", () => {
    expect(MAIN_SLIDES.map((s) => s.id)).toEqual([
      "title",
      "fei",
      "fei-map",
      "q6",
      "q1",
      "divergence",
      "q8",
      "q4",
      "q5",
      "q7-result",
      "q7-method",
      "demo",
      "close",
    ]);
    const lead = Object.fromEntries(MAIN_SLIDES.map((s) => [s.id, s.speakers]));
    expect(lead.title).toEqual(["Jacob"]);
    expect(lead.fei).toEqual(["Jacob"]);
    for (const id of ["fei-map", "q6", "q1", "divergence", "q8", "q4", "q5"]) expect(lead[id]).toEqual(["Daniela"]);
    expect(lead["q7-result"]).toEqual(["Biruk"]);
    expect(lead["q7-method"]).toEqual(["Biruk"]);
    expect(lead.demo).toEqual(["Roshit", "Jacob"]);
    expect(lead.close).toEqual(["Jacob"]);
  });

  it("ties each findings, forecast and demo slide to a scored question, a workspace page and a source file", () => {
    for (const s of MAIN_SLIDES.filter((x) => x.id !== "title" && x.id !== "close")) {
      expect(s.questions.length, s.id).toBeGreaterThan(0);
      expect(s.workspace?.href, s.id).toMatch(/^\//);
      expect(s.files.length, s.id).toBeGreaterThan(0);
    }
  });

  it("covers every scored graduate question in the main talk", () => {
    const seen = new Set(MAIN_SLIDES.flatMap((s) => s.questions));
    for (const q of ["Q1", "Q4", "Q5", "Q6", "Q7", "Q8"]) expect(seen.has(q as "Q1")).toBe(true);
  });

  it("puts each rubric sub-question on its own build step", () => {
    const steps = Object.fromEntries(MAIN_SLIDES.map((s) => [s.id, s.steps ?? []]));
    expect(steps.q1).toEqual(["Which measure tracks need?", "Per resident?", "Which counties break it?", "Why?"]);
    expect(steps.q4).toEqual(["Do prices lead activity?", "What cycles remain?"]);
    expect(steps.q5).toEqual(["Together or substitutes?", "When benefits change", "Does it differ by place?"]);
    expect(steps.q8).toHaveLength(3);
    expect(steps.q6).toHaveLength(2);
  });

  it("keeps appendix slides for judges who ask, without adding spoken time", () => {
    const extra = SLIDES.filter((s) => s.appendix);
    expect(extra.map((s) => s.id)).toEqual(["a-q6", "a-q7", "a-fei", "a-sources"]);
    expect(extra.every((s) => s.seconds === 0)).toBe(true);
  });
});

describe("deck facts (mi.foodbridge_bundle --deck)", () => {
  it("carries outlier county names without residuals (D-050)", () => {
    const o = deck.q1_outliers.HouseholdsTotal;
    expect(o.lower_activity.length).toBe(5);
    expect(o.higher_activity.length).toBe(5);
    const names = Object.values(deck.q1_outliers).flatMap((d) => [...d.lower_activity, ...d.higher_activity]);
    expect(names.every((n) => typeof n === "string")).toBe(true);
    expect(JSON.stringify(deck)).not.toMatch(/"fi_rate"|standardized_residual/);
  });

  it("never carries a price month at or after the forecast target (D-002)", () => {
    expect(deck.q4_prices.length).toBeGreaterThan(40);
    expect(deck.q4_prices.every((p) => p.month < research.meta.forecast_target)).toBe(true);
  });
});

describe("D-045 run rate on the statewide series", () => {
  it("reproduces the submitted visits total within rounding", () => {
    const rr = statewideRunRate("HouseholdsTotal");
    const submitted = research.findings.stats.q7_state.find((r) => r.signal === "HouseholdsTotal")?.yhat;
    expect(rr.targetDays).toBe(21);
    expect(rr.steps.map((s) => s.weight)).toEqual([1, 2, 3]);
    expect(submitted).toBeTruthy();
    // Statewide identity vs the sum of county forecasts: same rule, small aggregation gap.
    expect(Math.abs((rr.yhat ?? 0) - (submitted ?? 0)) / (submitted ?? 1)).toBeLessThan(0.02);
  });
});
