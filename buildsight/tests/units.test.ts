import { describe, expect, it } from "vitest";
import {
  formatLength,
  formatMass,
  formatMoney,
  fromGrams,
  inchesToMm,
  mmToInches,
  NOT_PROVIDED,
  parseLengthToMm,
  parseMassToGrams,
  round,
  toGrams,
  toMm,
  toNumber,
} from "@/lib/units";

describe("unit conversion", () => {
  it("converts between millimetres and inches exactly", () => {
    expect(inchesToMm(11.5)).toBeCloseTo(292.1, 6);
    expect(mmToInches(406.4)).toBeCloseTo(16, 6);
  });

  it("converts declared units into canonical units", () => {
    expect(toMm(1, "in")).toBe(25.4);
    expect(toMm(1, "ft")).toBe(304.8);
    expect(toGrams(1, "lb")).toBeCloseTo(453.592, 3);
    expect(fromGrams(453.59237, "lb")).toBeCloseTo(1, 6);
  });

  it("rounds without float artefacts", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
  });
});

describe("parsing operator-entered measurements", () => {
  it.each([
    ["11.5 in", 292.1],
    ['16"', 406.4],
    ["300mm", 300],
    ["30 cm", 300],
    ["1 ft", 304.8],
    ["1 1/2 in", 38.1],
    ["7/8 in", 22.225],
  ])("parses %s", (input, expected) => {
    expect(parseLengthToMm(input)).toBeCloseTo(expected, 3);
  });

  it("refuses ambiguous input rather than guessing a unit", () => {
    expect(parseLengthToMm("11.5")).toBeNull();
    expect(parseLengthToMm("about a foot")).toBeNull();
    expect(parseMassToGrams("heavy")).toBeNull();
  });

  it("parses masses", () => {
    expect(parseMassToGrams("9.8 oz")).toBeCloseTo(277.825, 2);
    expect(parseMassToGrams("1.5kg")).toBe(1500);
  });
});

describe("formatting", () => {
  it("uses the approved phrasing for a missing value", () => {
    expect(formatLength(null)).toBe(NOT_PROVIDED);
    expect(formatMass(undefined)).toBe(NOT_PROVIDED);
    expect(formatMoney(null)).toBe(NOT_PROVIDED);
  });

  it("formats lengths in both systems", () => {
    expect(formatLength(292.1)).toBe("11.5 in");
    expect(formatLength(292.1, "metric")).toBe("292.1 mm");
  });

  it("formats masses with pounds and ounces", () => {
    expect(formatMass(453.59237)).toBe("1 lb");
    expect(formatMass(500)).toBe("1 lb 1.6 oz");
    expect(formatMass(110)).toBe("3.9 oz");
    expect(formatMass(1500, "metric")).toBe("1.5 kg");
  });

  it("formats money from minor units", () => {
    expect(formatMoney(129900)).toBe("$1,299.00");
    expect(formatMoney(129900, "USD", { showCents: false })).toBe("$1,299");
  });
});

describe("toNumber", () => {
  it("normalises Prisma decimals, strings and numbers", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber({ toString: () => "12.5" })).toBe(12.5);
    expect(toNumber(null)).toBeNull();
    expect(toNumber("not a number")).toBeNull();
  });
});
