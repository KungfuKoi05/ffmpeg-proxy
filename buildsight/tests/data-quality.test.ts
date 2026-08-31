import { describe, expect, it } from "vitest";
import { evaluateDataQuality, qualityBand } from "@/lib/quality/data-quality";

const complete = {
  manufacturerName: "Test Manufacturer",
  manufacturerPartNumber: "TM-1",
  productName: "Test product",
  categorySlug: "barrel",
  msrpCents: 19900,
  weightGrams: 640,
  lengthMm: 292.1,
  diameterMm: 19.05,
  verificationStatus: "VERIFIED_MANUFACTURER",
  sourceUrl: "https://example.com/spec",
  productUrl: "https://example.com/product",
  lastVerified: new Date("2026-06-01"),
  priceCheckedAt: new Date("2026-08-25"),
};

const now = new Date("2026-09-01");

describe("data quality engine", () => {
  it("scores a complete, sourced record highly", () => {
    const { score, issues } = evaluateDataQuality(complete, { now });
    expect(score).toBeGreaterThanOrEqual(95);
    expect(issues).toHaveLength(0);
  });

  it("flags missing identity fields as errors", () => {
    const { issues } = evaluateDataQuality(
      { ...complete, manufacturerPartNumber: "", productName: "" },
      { now },
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["MISSING_SKU", "MISSING_NAME"]),
    );
    expect(issues.every((issue) => issue.severity !== "ERROR" || issue.field)).toBe(true);
  });

  it("rejects impossible dimensions", () => {
    const { issues } = evaluateDataQuality({ ...complete, lengthMm: -5 }, { now });
    expect(issues.find((issue) => issue.code === "IMPOSSIBLE_DIMENSION")).toBeDefined();
  });

  it("catches a unit mistake as an implausible dimension", () => {
    const { issues } = evaluateDataQuality({ ...complete, lengthMm: 2400 }, { now });
    const issue = issues.find((entry) => entry.code === "IMPLAUSIBLE_DIMENSION");
    expect(issue?.message).toContain("check the source units");
  });

  it("detects a bore larger than the outer diameter", () => {
    const { issues } = evaluateDataQuality(
      { ...complete, diameterMm: 20, innerDiameterMm: 25 },
      { now },
    );
    expect(issues.find((issue) => issue.code === "CONFLICTING_DIMENSIONS")).toBeDefined();
  });

  it("reports duplicates, negative prices and broken URLs", () => {
    const { issues } = evaluateDataQuality(
      { ...complete, msrpCents: -1 },
      { now, duplicateSku: true, brokenUrls: ["https://example.com/product"] },
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_SKU", "NEGATIVE_PRICE", "BROKEN_URL"]),
    );
  });

  it("treats stale verification and stale prices as findings", () => {
    const { issues } = evaluateDataQuality(
      {
        ...complete,
        lastVerified: new Date("2024-01-01"),
        priceCheckedAt: new Date("2026-01-01"),
      },
      { now },
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["EXPIRED_VERIFICATION", "EXPIRED_PRICE"]),
    );
  });

  it("treats missing measurements as information, not errors", () => {
    const { issues } = evaluateDataQuality(
      { ...complete, weightGrams: null, lengthMm: null },
      { now },
    );
    const missing = issues.filter((issue) =>
      ["MISSING_WEIGHT", "MISSING_LENGTH"].includes(issue.code),
    );
    expect(missing).toHaveLength(2);
    expect(missing.every((issue) => issue.severity === "INFO")).toBe(true);
  });

  it("bands scores for display", () => {
    expect(qualityBand(90).state).toBe("GREEN");
    expect(qualityBand(70).state).toBe("YELLOW");
    expect(qualityBand(30).state).toBe("RED");
  });
});
