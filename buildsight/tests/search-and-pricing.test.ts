import { describe, expect, it } from "vitest";
import { buildSearchText } from "@/lib/catalog/search-text";
import {
  describePriceVsAverage,
  summarizePriceHistory,
  daysAgo,
} from "@/lib/pricing/history";

describe("search haystack", () => {
  const text = buildSearchText({
    productName: "DEMO PRODUCT — 11.5 in Barrel",
    manufacturerName: "DEMO MANUFACTURER — Precision Works",
    manufacturerPartNumber: "DPW-BBL-115",
    categorySlug: "barrel",
    caliber: "5.56x45mm NATO",
    platform: "ar15",
    lengthMm: 292.1,
    threadSpecification: "1-2x28",
    mountingInterface: null,
  });

  it("includes the length in inches and millimetres so both queries hit", () => {
    expect(text).toContain("11.5 in");
    expect(text).toContain("292.1 mm");
  });

  it("includes the part number with and without separators", () => {
    expect(text).toContain("DPW-BBL-115");
    expect(text).toContain("DPWBBL115");
  });

  it("expands interface slugs into readable names", () => {
    expect(text).toContain("1-2x28");
    expect(text).toContain('1/2"-28');
  });

  it("includes the category in both slug and display form", () => {
    expect(text).toContain("Barrel");
    expect(text.toLowerCase()).toContain("ar-15 pattern");
  });
});

describe("price statistics", () => {
  const points = [
    { observedAt: "2026-01-01T00:00:00.000Z", amountCents: 20000 },
    { observedAt: "2026-01-02T00:00:00.000Z", amountCents: 22000 },
    { observedAt: "2026-01-03T00:00:00.000Z", amountCents: 18000 },
  ];

  it("summarises low, high, average and the current observation", () => {
    const statistics = summarizePriceHistory(points);
    expect(statistics.count).toBe(3);
    expect(statistics.lowestCents).toBe(18000);
    expect(statistics.highestCents).toBe(22000);
    expect(statistics.averageCents).toBe(20000);
    expect(statistics.currentCents).toBe(18000);
    expect(statistics.changeVsAveragePercent).toBe(-10);
    expect(statistics.trendPercent).toBe(-10);
  });

  it("handles an empty history without inventing numbers", () => {
    const statistics = summarizePriceHistory([]);
    expect(statistics.count).toBe(0);
    expect(statistics.averageCents).toBeNull();
    expect(describePriceVsAverage(statistics, 90)).toBeNull();
  });

  it("phrases the comparison against the window average", () => {
    const statistics = summarizePriceHistory(points);
    expect(describePriceVsAverage(statistics, 90)).toBe(
      "Current price is 10.0% below the 90-day average.",
    );
  });

  it("computes a window start date", () => {
    const since = daysAgo(30);
    expect(Date.now() - since.getTime()).toBeGreaterThan(29 * 86_400_000);
  });
});
