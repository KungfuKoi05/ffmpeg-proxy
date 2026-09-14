import { describe, expect, it } from "vitest";
import {
  percentOf, whatPercent, percentChange, applyDiscounts, margin, priceForMargin,
  loan, compoundInterest, fromHourly, fromAnnual, areaSqFt, paint, concrete,
} from "@/lib/tools/calc";

describe("percentages", () => {
  it("takes a percent of a number", () => {
    expect(percentOf(25, 200)).toBe(50);
  });

  it("works out what percent one number is of another", () => {
    expect(whatPercent(50, 200).value).toBe(25);
  });

  it("refuses to divide by a zero total", () => {
    const r = whatPercent(5, 0);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/can't be zero/);
  });

  it("computes increase and decrease with direction", () => {
    expect(percentChange(100, 150)).toMatchObject({ value: 50, direction: "increase" });
    expect(percentChange(100, 50)).toMatchObject({ value: -50, direction: "decrease" });
  });

  it("uses the absolute base so a negative start still reads correctly", () => {
    expect(percentChange(-100, -50).value).toBe(50);
  });

  it("rejects change from zero as undefined", () => {
    expect(percentChange(0, 10).ok).toBe(false);
  });
});

describe("discounts", () => {
  it("applies a single discount", () => {
    const r = applyDiscounts(100, [20]);
    expect(r.finalPrice).toBe(80);
    expect(r.saved).toBe(20);
  });

  it("stacks discounts sequentially, not additively", () => {
    // 30% then 20% is 44% off, not 50%.
    const r = applyDiscounts(100, [30, 20]);
    expect(r.finalPrice).toBeCloseTo(56, 10);
    expect(r.effectiveRate).toBeCloseTo(44, 10);
  });

  it("never returns a negative price", () => {
    expect(applyDiscounts(100, [150]).finalPrice).toBe(0);
  });

  it("handles a zero price without dividing by zero", () => {
    expect(applyDiscounts(0, [10]).effectiveRate).toBe(0);
  });
});

describe("margin and markup", () => {
  it("distinguishes margin from markup", () => {
    const r = margin(100, 60).value!;
    expect(r.profit).toBe(40);
    expect(r.marginPercent).toBeCloseTo(40, 10);
    expect(r.markupPercent).toBeCloseTo(66.667, 3);
  });

  it("rejects zero revenue", () => {
    expect(margin(0, 10).ok).toBe(false);
  });

  it("inverts to the price needed for a target margin", () => {
    expect(priceForMargin(60, 40).value).toBeCloseTo(100, 10);
  });

  it("refuses an impossible target margin", () => {
    expect(priceForMargin(60, 100).ok).toBe(false);
    expect(priceForMargin(60, 120).ok).toBe(false);
  });
});

describe("loan", () => {
  it("matches the standard amortisation formula", () => {
    // $200,000 at 6% over 30 years is ~$1,199.10/month.
    const r = loan(200_000, 6, 30).value!;
    expect(r.monthlyPayment).toBeCloseTo(1199.10, 1);
  });

  it("splits a 0% loan evenly instead of dividing by zero", () => {
    const r = loan(12_000, 0, 1).value!;
    expect(r.monthlyPayment).toBeCloseTo(1000, 10);
    expect(r.totalInterest).toBeCloseTo(0, 6);
  });

  it("amortises to a zero balance by the final month", () => {
    const r = loan(10_000, 5, 2).value!;
    expect(r.schedule).toHaveLength(24);
    expect(r.schedule[23].balance).toBeCloseTo(0, 4);
  });

  it("shifts from interest toward principal over time", () => {
    const r = loan(200_000, 6, 30).value!;
    expect(r.schedule[0].interest).toBeGreaterThan(r.schedule[0].principal);
    expect(r.schedule[359].principal).toBeGreaterThan(r.schedule[359].interest);
  });

  it("validates its inputs", () => {
    expect(loan(0, 5, 30).ok).toBe(false);
    expect(loan(1000, 5, 0).ok).toBe(false);
    expect(loan(1000, -1, 30).ok).toBe(false);
  });
});

describe("compound interest", () => {
  it("matches a hand-checked figure with no contributions", () => {
    // 1000 at 12% compounded monthly for 1 year = 1000 * (1.01)^12.
    const r = compoundInterest({ principal: 1000, annualRatePercent: 12, years: 1 }).value!;
    expect(r.finalBalance).toBeCloseTo(1000 * Math.pow(1.01, 12), 6);
  });

  it("adds monthly contributions", () => {
    const without = compoundInterest({ principal: 1000, annualRatePercent: 5, years: 10 }).value!;
    const withC = compoundInterest({
      principal: 1000, annualRatePercent: 5, years: 10, monthlyContribution: 100,
    }).value!;
    expect(withC.finalBalance).toBeGreaterThan(without.finalBalance);
    expect(withC.totalContributions).toBeCloseTo(1000 + 100 * 120, 6);
  });

  it("returns one row per year", () => {
    expect(compoundInterest({ principal: 100, annualRatePercent: 5, years: 3 }).value!.yearly)
      .toHaveLength(3);
  });

  it("keeps interest as balance minus what went in", () => {
    const r = compoundInterest({ principal: 500, annualRatePercent: 7, years: 5 }).value!;
    expect(r.totalInterest).toBeCloseTo(r.finalBalance - r.totalContributions, 6);
  });

  it("validates inputs", () => {
    expect(compoundInterest({ principal: 100, annualRatePercent: 5, years: 0 }).ok).toBe(false);
    expect(compoundInterest({ principal: -1, annualRatePercent: 5, years: 1 }).ok).toBe(false);
  });
});

describe("salary", () => {
  it("converts hourly to annual", () => {
    expect(fromHourly(25).value!.annual).toBe(52_000);
  });

  it("round-trips annual back to hourly", () => {
    expect(fromAnnual(52_000).value!.hourly).toBeCloseTo(25, 10);
  });

  it("respects non-standard hours and weeks", () => {
    expect(fromHourly(20, 30, 48).value!.annual).toBe(20 * 30 * 48);
  });

  it("rejects zero hours", () => {
    expect(fromHourly(20, 0).ok).toBe(false);
  });
});

describe("materials", () => {
  it("adds areas including inches", () => {
    expect(areaSqFt([{ feet: 10, widthFeet: 10 }])).toBe(100);
    expect(areaSqFt([{ feet: 10, inches: 6, widthFeet: 10 }])).toBeCloseTo(105, 10);
  });

  it("computes paint gallons and deducts openings", () => {
    const r = paint({ wallSqFt: 700, coats: 2 }).value!;
    expect(r.gallonsPerCoat).toBeCloseTo(2, 10);
    expect(r.totalGallons).toBeCloseTo(4, 10);
    expect(paint({ wallSqFt: 700, coats: 1, doorsAndWindowsSqFt: 350 }).value!.totalSqFt)
      .toBe(350);
  });

  it("never goes negative when openings exceed wall area", () => {
    expect(paint({ wallSqFt: 100, doorsAndWindowsSqFt: 500 }).value!.totalSqFt).toBe(0);
  });

  it("validates paint inputs", () => {
    expect(paint({ wallSqFt: 0 }).ok).toBe(false);
    expect(paint({ wallSqFt: 100, coats: 0 }).ok).toBe(false);
  });

  it("computes concrete volume with waste and rounds bags up", () => {
    // 10 x 10 x 4in = 33.33 cu ft, +10% waste = 36.67.
    const r = concrete({ lengthFeet: 10, widthFeet: 10, thicknessInches: 4 }).value!;
    expect(r.cubicFeet).toBeCloseTo(36.667, 2);
    expect(r.cubicYards).toBeCloseTo(1.358, 2);
    expect(Number.isInteger(r.bags80lb)).toBe(true);
    expect(r.bags80lb).toBe(Math.ceil(r.cubicFeet / 0.6));
  });

  it("validates concrete inputs", () => {
    expect(concrete({ lengthFeet: 0, widthFeet: 10, thicknessInches: 4 }).ok).toBe(false);
  });
});
