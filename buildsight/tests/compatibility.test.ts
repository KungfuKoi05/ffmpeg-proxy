import { describe, expect, it } from "vitest";
import { evaluateCompatibility, worseState } from "@/lib/compatibility/engine";
import { component, product, rule, sampleAssembly } from "./fixtures";

const barrelToUpper = rule({
  id: "barrel-upper",
  subjectCategorySlug: "barrel",
  targetCategorySlug: "upper-receiver",
  subjectField: "barrelCompatibility",
  targetField: "barrelCompatibility",
  explanation: "Compatible — the barrel extension pattern matches.",
});

const receiverPair = rule({
  id: "receiver-pair",
  kind: "PLATFORM_MATCH",
  subjectCategorySlug: "upper-receiver",
  targetCategorySlug: "lower-receiver",
  subjectField: "platform",
  targetField: "platform",
  explanation: "Compatible — both receivers use the same platform pattern.",
});

describe("compatibility engine", () => {
  it("reports a documented match as compatible with its explanation", () => {
    const { upper, barrel } = sampleAssembly();
    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("barrel", barrel)],
      },
      [barrelToUpper],
    );

    const finding = report.findings.find((entry) => entry.ruleId === "barrel-upper");
    expect(finding?.state).toBe("COMPATIBLE");
    expect(finding?.explanation).toBe("Compatible — the barrel extension pattern matches.");
    expect(finding?.ruleName).toBe("Rule barrel-upper");
  });

  it("reports a documented mismatch as incompatible and names both values", () => {
    const { upper } = sampleAssembly();
    const wrongBarrel = product({
      id: "ar10-barrel",
      categorySlug: "barrel",
      barrelCompatibility: "ar10-barrel-extension",
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("barrel", wrongBarrel)],
      },
      [barrelToUpper],
    );

    const finding = report.findings.find((entry) => entry.ruleId === "barrel-upper");
    expect(finding?.state).toBe("INCOMPATIBLE");
    expect(finding?.explanation).toContain("ar15-barrel-extension");
    expect(finding?.explanation).toContain("ar10-barrel-extension");
    expect(report.overall).toBe("INCOMPATIBLE");
  });

  it("returns UNKNOWN when a product does not publish the compared field", () => {
    const { upper } = sampleAssembly();
    const silentBarrel = product({
      id: "silent-barrel",
      categorySlug: "barrel",
      barrelCompatibility: null,
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("barrel", silentBarrel)],
      },
      [barrelToUpper],
    );

    const finding = report.findings.find((entry) => entry.ruleId === "barrel-upper");
    expect(finding?.state).toBe("UNKNOWN");
    expect(finding?.explanation).toContain("does not publish");
  });

  it("returns UNKNOWN when no rule covers a connection", () => {
    const { upper, barrel } = sampleAssembly();
    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("barrel", barrel)],
      },
      [],
    );

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].state).toBe("UNKNOWN");
    expect(report.findings[0].explanation).toContain("no documented compatibility rule");
  });

  it("never lets UNKNOWN be reported as compatible overall", () => {
    const { upper, lower, barrel } = sampleAssembly();
    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [
          component("upper-receiver", upper),
          component("lower-receiver", lower),
          component("barrel", barrel),
        ],
      },
      [receiverPair], // covers the receivers, leaves the barrel uncovered
    );

    expect(report.counts.COMPATIBLE).toBeGreaterThan(0);
    expect(report.counts.UNKNOWN).toBeGreaterThan(0);
    expect(report.overall).not.toBe("COMPATIBLE");
    expect(report.overall).toBe("UNKNOWN");
  });

  it("surfaces conditional results with their condition text", () => {
    const { upper, handguard } = sampleAssembly();
    const conditional = rule({
      id: "handguard-upper",
      kind: "PLATFORM_MATCH",
      subjectCategorySlug: "handguard",
      targetCategorySlug: "upper-receiver",
      subjectField: "platform",
      targetField: "platform",
      result: "CONDITIONAL",
      condition: "Confirm the barrel nut torque specification.",
      explanation: "Conditional — the handguard installs with its own barrel nut.",
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("handguard", handguard)],
      },
      [conditional],
    );

    const finding = report.findings.find((entry) => entry.ruleId === "handguard-upper");
    expect(finding?.state).toBe("CONDITIONAL");
    expect(finding?.condition).toBe("Confirm the barrel nut torque specification.");
    expect(report.overall).toBe("CONDITIONAL");
  });

  it("applies dimensional constraints and reports the conflict", () => {
    const barrel = product({ id: "short-barrel", categorySlug: "barrel", lengthMm: 292.1 });
    const handguard = product({ id: "long-handguard", categorySlug: "handguard", lengthMm: 381 });
    const constraint = rule({
      id: "handguard-length",
      kind: "DIMENSIONAL_CONSTRAINT",
      subjectCategorySlug: "handguard",
      targetCategorySlug: "barrel",
      parameters: {
        subjectDimension: "length",
        targetDimension: "length",
        comparison: "lte",
        offsetMm: -10,
      },
      explanation: "Compatible — the handguard terminates behind the muzzle.",
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("barrel", barrel), component("handguard", handguard)],
      },
      [constraint],
    );

    const finding = report.findings.find((entry) => entry.ruleId === "handguard-length");
    expect(finding?.state).toBe("INCOMPATIBLE");
    expect(finding?.explanation).toContain("dimensional conflict");
  });

  it("passes a dimensional constraint that holds", () => {
    const barrel = product({ id: "long-barrel", categorySlug: "barrel", lengthMm: 406.4 });
    const handguard = product({ id: "ok-handguard", categorySlug: "handguard", lengthMm: 330.2 });
    const constraint = rule({
      id: "handguard-length",
      kind: "DIMENSIONAL_CONSTRAINT",
      subjectCategorySlug: "handguard",
      targetCategorySlug: "barrel",
      parameters: { subjectDimension: "length", targetDimension: "length", comparison: "lte", offsetMm: -10 },
      explanation: "Compatible — the handguard terminates behind the muzzle.",
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("barrel", barrel), component("handguard", handguard)],
      },
      [constraint],
    );
    expect(report.findings.find((entry) => entry.ruleId === "handguard-length")?.state).toBe(
      "COMPATIBLE",
    );
  });

  it("returns UNKNOWN for a dimensional constraint with a missing dimension", () => {
    const barrel = product({ id: "barrel-no-length", categorySlug: "barrel", lengthMm: null });
    const handguard = product({ id: "hg", categorySlug: "handguard", lengthMm: 330 });
    const constraint = rule({
      id: "dim",
      kind: "DIMENSIONAL_CONSTRAINT",
      subjectCategorySlug: "handguard",
      targetCategorySlug: "barrel",
      parameters: { subjectDimension: "length", targetDimension: "length", comparison: "lte" },
      explanation: "Compatible.",
    });

    const report = evaluateCompatibility(
      { platform: "ar15", components: [component("barrel", barrel), component("handguard", handguard)] },
      [constraint],
    );
    expect(report.findings.find((entry) => entry.ruleId === "dim")?.state).toBe("UNKNOWN");
  });

  it("flags a required component that is absent", () => {
    const optic = product({
      id: "optic",
      categorySlug: "optic",
      opticInterface: "footprint-micro-t",
    });
    const requires = rule({
      id: "optic-needs-mount",
      kind: "REQUIRES_COMPONENT",
      subjectCategorySlug: "optic",
      parameters: { requiredCategorySlug: "mount" },
      result: "CONDITIONAL",
      explanation: "Conditional — this footprint needs a mount.",
    });

    const report = evaluateCompatibility(
      { platform: "ar15", components: [component("optic", optic)] },
      [requires],
    );

    const finding = report.findings.find((entry) => entry.ruleId === "optic-needs-mount");
    expect(finding?.state).toBe("CONDITIONAL");
    expect(finding?.targetLabel).toContain("Missing");
  });

  it("honours skipIfCategoryPresent so fallback rules stand down", () => {
    const optic = product({ id: "optic", categorySlug: "optic", opticInterface: "footprint-micro-t" });
    const mount = product({ id: "mount", categorySlug: "mount", opticInterface: "footprint-micro-t" });
    const fallback = rule({
      id: "optic-to-receiver",
      subjectCategorySlug: "optic",
      targetCategorySlug: "upper-receiver",
      subjectField: "opticInterface",
      targetField: "opticInterface",
      parameters: { skipIfCategoryPresent: ["mount"] },
      explanation: "Compatible — the optic clamps to the rail.",
    });
    const opticToMount = rule({
      id: "optic-to-mount",
      subjectCategorySlug: "optic",
      targetCategorySlug: "mount",
      subjectField: "opticInterface",
      targetField: "opticInterface",
      explanation: "Compatible — the footprints match.",
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("optic", optic), component("mount", mount)],
      },
      [fallback, opticToMount],
    );

    expect(report.findings.some((entry) => entry.ruleId === "optic-to-receiver")).toBe(false);
    expect(report.findings.find((entry) => entry.ruleId === "optic-to-mount")?.state).toBe(
      "COMPATIBLE",
    );
  });

  it("lets an explicit product pair override category rules", () => {
    const suppressor = product({
      id: "supp",
      categorySlug: "suppressor",
      suppressorCompatibility: "suppressor-qd-taper",
    });
    const muzzle = product({
      id: "muzzle",
      categorySlug: "muzzle-device",
      suppressorCompatibility: "suppressor-direct-thread",
    });

    const categoryRule = rule({
      id: "category",
      subjectCategorySlug: "suppressor",
      targetCategorySlug: "muzzle-device",
      subjectField: "suppressorCompatibility",
      targetField: "suppressorCompatibility",
      explanation: "Compatible — mounting systems match.",
    });
    const explicit = rule({
      id: "explicit",
      kind: "EXPLICIT_PAIR",
      subjectProductId: "supp",
      targetProductId: "muzzle",
      result: "COMPATIBLE",
      explanation: "Compatible — documented by the manufacturer as a matched system.",
      priority: 10,
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("suppressor", suppressor), component("muzzle-device", muzzle)],
      },
      [categoryRule, explicit],
    );

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].ruleId).toBe("explicit");
    expect(report.findings[0].state).toBe("COMPATIBLE");
  });

  it("reports the weakest verification level as the finding's confidence", () => {
    const { upper } = sampleAssembly();
    const barrel = product({
      id: "barrel",
      categorySlug: "barrel",
      barrelCompatibility: "ar15-barrel-extension",
      verificationStatus: "USER_SUBMITTED",
    });

    const report = evaluateCompatibility(
      {
        platform: "ar15",
        components: [component("upper-receiver", upper), component("barrel", barrel)],
      },
      [barrelToUpper],
    );

    expect(report.findings[0].confidence).toBe("USER_SUBMITTED");
  });

  it("lists the core categories a configuration is still missing", () => {
    const { upper } = sampleAssembly();
    const report = evaluateCompatibility(
      { platform: "ar15", components: [component("upper-receiver", upper)] },
      [],
    );
    expect(report.missingCoreCategories).toEqual(
      expect.arrayContaining(["lower-receiver", "barrel", "bolt-carrier-group"]),
    );
  });

  it("orders severity so unknown outranks compatible", () => {
    expect(worseState("COMPATIBLE", "UNKNOWN")).toBe("UNKNOWN");
    expect(worseState("UNKNOWN", "CONDITIONAL")).toBe("CONDITIONAL");
    expect(worseState("CONDITIONAL", "INCOMPATIBLE")).toBe("INCOMPATIBLE");
  });
});
