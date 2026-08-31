import { describe, expect, it } from "vitest";
import {
  detectBudgetCents,
  detectCaliber,
  detectCategory,
  detectLengthMm,
  detectPlatform,
  parseIntent,
  searchTermsFrom,
} from "@/lib/scope/intent";
import { inchesToMm } from "@/lib/units";

describe("natural language intent parsing", () => {
  it("detects categories from common phrasings", () => {
    expect(detectCategory("show me handguards")).toBe("handguard");
    expect(detectCategory("I need a red dot")).toBe("optic");
    expect(detectCategory("looking for a BCG")).toBe("bolt-carrier-group");
    expect(detectCategory("something entirely unrelated")).toBeUndefined();
  });

  it("detects platform and caliber", () => {
    expect(detectPlatform("for an AR-15")).toBe("ar15");
    expect(detectPlatform("large frame build")).toBe("ar10");
    expect(detectCaliber("chambered in 300 blackout")).toBe("300 BLK");
    expect(detectCaliber("6.5 creedmoor please")).toBe("6.5 Creedmoor");
  });

  it("parses budgets in several forms", () => {
    expect(detectBudgetCents("under $200")).toBe(20000);
    expect(detectBudgetCents("budget of 1,500")).toBe(150000);
    expect(detectBudgetCents("around $2k")).toBe(200000);
    expect(detectBudgetCents("no numbers here")).toBeUndefined();
  });

  it("reads a length even without a unit when a component follows", () => {
    const range = detectLengthMm("11.5 barrel");
    expect(range).toBeDefined();
    expect((range!.minMm + range!.maxMm) / 2).toBeCloseTo(inchesToMm(11.5), 3);

    const quoted = detectLengthMm('15" handguard');
    expect((quoted!.minMm + quoted!.maxMm) / 2).toBeCloseTo(inchesToMm(15), 3);
  });

  it("classifies intent and asks for the missing context", () => {
    const query = parseIntent("recommend a lightweight setup");
    expect(query.intent).toBe("recommend");
    expect(query.sort).toBe("weight-asc");
    expect(query.clarifications).toEqual(
      expect.arrayContaining([
        "Which platform are you configuring?",
        "What is your approximate budget?",
        "Which components do you already own?",
      ]),
    );
  });

  it("captures owned components so they are not recommended again", () => {
    const query = parseIntent("I already have a lower receiver and a trigger, what else do I need");
    expect(query.ownedCategorySlugs).toEqual(
      expect.arrayContaining(["lower-receiver", "trigger"]),
    );
  });

  it("requires manufacturer verification when asked", () => {
    expect(parseIntent("manufacturer-verified handguards only").verificationStatus).toBe(
      "VERIFIED_MANUFACTURER",
    );
    expect(parseIntent("any handguard").verificationStatus).toBeUndefined();
  });

  it("builds a full structured query from one sentence", () => {
    const query = parseIntent("I want a lightweight 15 inch m-lok handguard for an AR-15 under $250");
    expect(query.categorySlug).toBe("handguard");
    expect(query.platform).toBe("ar15");
    expect(query.maxPriceCents).toBe(25000);
    expect(query.sort).toBe("weight-asc");
    expect(query.minLengthMm).toBeLessThan(inchesToMm(15));
    expect(query.maxLengthMm).toBeGreaterThan(inchesToMm(15));
  });

  it("strips filler words from the free-text search term", () => {
    const query = parseIntent("show me a lightweight handguard under $200");
    const terms = searchTermsFrom(query);
    expect(terms).toContain("handguard");
    expect(terms).not.toContain("$200");
    expect(terms).not.toContain("show me");
  });
});
