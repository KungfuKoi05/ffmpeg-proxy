import { describe, expect, it } from "vitest";
import { summarizeBuild } from "@/lib/build/summary";
import { scoreBuild } from "@/lib/build/score";
import { evaluateCompatibility } from "@/lib/compatibility/engine";
import { computeDimensions } from "@/lib/dimensions/engine";
import { component, product, rule, sampleAssembly } from "./fixtures";

const rules = [
  rule({
    id: "barrel-upper",
    subjectCategorySlug: "barrel",
    targetCategorySlug: "upper-receiver",
    subjectField: "barrelCompatibility",
    targetField: "barrelCompatibility",
  }),
];

describe("build cost and weight", () => {
  it("prefers the observed retail price over MSRP and reports the saving", () => {
    const { upper, barrel } = sampleAssembly();
    const summary = summarizeBuild(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("barrel", barrel)],
      },
      rules,
    );

    expect(summary.cost.totalCurrentCents).toBe(11900 + 22900);
    expect(summary.cost.totalMsrpCents).toBe(12900 + 24900);
    expect(summary.cost.savingsCents).toBe(1000 + 2000);
    expect(summary.cost.unpricedCount).toBe(0);
  });

  it("counts unpriced components rather than assuming a price", () => {
    const priced = product({ id: "a", categorySlug: "barrel", msrpCents: 10000 });
    const unpriced = product({ id: "b", categorySlug: "handguard" });

    const summary = summarizeBuild(
      { platform: "ar15", components: [component("barrel", priced), component("handguard", unpriced)] },
      [],
    );

    expect(summary.cost.totalCurrentCents).toBe(10000);
    expect(summary.cost.unpricedCount).toBe(1);
  });

  it("multiplies by quantity", () => {
    const accessory = product({ id: "acc", categorySlug: "accessory", msrpCents: 1900, weightGrams: 40 });
    const summary = summarizeBuild(
      { platform: "ar15", components: [component("accessory", accessory, 3)] },
      [],
    );
    expect(summary.cost.totalCurrentCents).toBe(5700);
    expect(summary.weight.totalGrams).toBe(120);
  });

  it("sums published weights and reports missing ones separately", () => {
    const weighed = product({ id: "a", categorySlug: "barrel", weightGrams: 850 });
    const unweighed = product({ id: "b", categorySlug: "handguard", weightGrams: null });

    const summary = summarizeBuild(
      { platform: "ar15", components: [component("barrel", weighed), component("handguard", unweighed)] },
      [],
    );

    expect(summary.weight.totalGrams).toBe(850);
    expect(summary.weight.missingCount).toBe(1);
    expect(summary.weight.heaviest?.productId).toBe("a");
  });

  it("returns null totals for an empty configuration", () => {
    const summary = summarizeBuild({ platform: "ar15", components: [] }, []);
    expect(summary.cost.totalCurrentCents).toBeNull();
    expect(summary.weight.totalGrams).toBeNull();
    expect(summary.score.overall).toBeNull();
  });

  it("lists regulated components so purchasing can be routed", () => {
    const suppressor = product({
      id: "supp",
      categorySlug: "suppressor",
      regulatoryClass: "NFA_ITEM",
    });
    const summary = summarizeBuild(
      { platform: "ar15", components: [component("suppressor", suppressor)] },
      [],
    );
    expect(summary.regulatedComponentIds).toEqual(["supp"]);
  });
});

describe("build confidence score", () => {
  it("scores a fully documented, compatible pair highly", () => {
    const { upper, barrel } = sampleAssembly();
    const components = [component("upper-receiver", upper), component("barrel", barrel)];
    const compatibility = evaluateCompatibility({ platform: "ar15", components }, rules);
    const dimensions = computeDimensions({ platform: "ar15", components });
    const score = scoreBuild(components, compatibility, dimensions);

    expect(score.overall).toBeGreaterThan(80);
    expect(score.dimensions.find((entry) => entry.key === "documentation")?.value).toBe(100);
  });

  it("marks a dimension as unavailable rather than guessing", () => {
    const score = scoreBuild(
      [],
      { overall: "UNKNOWN", findings: [], counts: { COMPATIBLE: 0, INCOMPATIBLE: 0, CONDITIONAL: 0, UNKNOWN: 0 }, missingCoreCategories: [] },
      { overallLengthMm: null, overallLengthConfidence: null, overallLengthNote: null, measurements: [], clearances: [], segments: [] },
    );

    expect(score.overall).toBeNull();
    expect(score.dimensions.every((entry) => entry.value === null)).toBe(true);
  });

  it("penalises a documented conflict", () => {
    const barrel = product({ id: "b", categorySlug: "barrel", barrelCompatibility: "ar10-barrel-extension", lengthMm: 400 });
    const { upper } = sampleAssembly();
    const components = [component("upper-receiver", upper), component("barrel", barrel)];
    const compatibility = evaluateCompatibility({ platform: "ar15", components }, rules);
    const dimensions = computeDimensions({ platform: "ar15", components });
    const score = scoreBuild(components, compatibility, dimensions);

    expect(compatibility.overall).toBe("INCOMPATIBLE");
    expect(score.dimensions.find((entry) => entry.key === "compatibility")?.value).toBe(0);
  });

  it("lowers documentation confidence for unverified records", () => {
    const unverified = product({
      id: "u",
      categorySlug: "barrel",
      verificationStatus: "UNVERIFIED",
      sourceUrl: null,
    });
    const components = [component("barrel", unverified)];
    const compatibility = evaluateCompatibility({ platform: "ar15", components }, []);
    const dimensions = computeDimensions({ platform: "ar15", components });
    const score = scoreBuild(components, compatibility, dimensions);

    expect(score.dimensions.find((entry) => entry.key === "documentation")?.value).toBe(0);
  });
});
