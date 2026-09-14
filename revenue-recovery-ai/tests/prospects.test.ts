import { describe, expect, it } from "vitest";
import { normaliseProspectRows, parseCsv, scoreProspect } from "@/lib/prospects/scoring";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const rows = parseCsv("company,phone\nAcme HVAC,555-0100\nBeta Air,555-0200");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ company: "Acme HVAC", phone: "555-0100" });
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('company,notes\n"Acme, Inc.","Big, established shop"');
    expect(rows[0].company).toBe("Acme, Inc.");
    expect(rows[0].notes).toBe("Big, established shop");
  });

  it("handles escaped quotes", () => {
    const rows = parseCsv('company\n"The ""Best"" HVAC"');
    expect(rows[0].company).toBe('The "Best" HVAC');
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });
});

describe("normaliseProspectRows", () => {
  it("rejects rows with no company and reports the row number", () => {
    const result = normaliseProspectRows([{ company: "", phone: "555" }]);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected[0]).toEqual({ row: 2, reason: "missing company" });
  });

  it("deduplicates on company plus phone", () => {
    const result = normaliseProspectRows([
      { company: "Acme", phone: "555-0100" },
      { company: "acme", phone: "5550100" },
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected[0].reason).toBe("duplicate of an earlier row");
  });

  it("normalises phone numbers", () => {
    const result = normaliseProspectRows([{ company: "Acme", phone: "(555) 010-0100" }]);
    expect(result.valid[0].phone).toBe("5550100100");
  });
});

describe("scoreProspect", () => {
  it("is deterministic", () => {
    const p = { review_count: 120, emergency_service: true, website: "https://x.com" };
    expect(scoreProspect(p).score).toBe(scoreProspect(p).score);
  });

  it("scores a strong prospect higher than a weak one", () => {
    const strong = scoreProspect({
      review_count: 150,
      rating: 4.7,
      emergency_service: true,
      services: ["AC Replacement"],
      website_quality: "poor",
      city: "Austin",
      state: "TX",
    });
    const weak = scoreProspect({ review_count: 2, website: "https://good.com" });
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("clamps to 0-100", () => {
    const maxed = scoreProspect({
      review_count: 9999,
      rating: 5,
      emergency_service: true,
      services: ["replacement", "installation", "commercial"],
      city: "Austin",
      state: "TX",
    });
    expect(maxed.score).toBeLessThanOrEqual(100);
    expect(maxed.score).toBeGreaterThanOrEqual(0);
  });

  it("explains every point it awards", () => {
    const result = scoreProspect({ review_count: 150, emergency_service: true });
    expect(result.factors.length).toBeGreaterThan(0);
    for (const factor of result.factors) {
      expect(factor.reason).toBeTruthy();
      expect(factor.points).toBeGreaterThan(0);
    }
    const summed = result.factors.reduce((s, f) => s + f.points, 0);
    expect(result.score).toBe(Math.min(100, summed));
  });
});
