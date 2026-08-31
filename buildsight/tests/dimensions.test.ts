import { describe, expect, it } from "vitest";
import { computeDimensions, layoutAssembly, worstSignal } from "@/lib/dimensions/engine";
import { component, product, sampleAssembly } from "./fixtures";

describe("dimensional clearance engine", () => {
  it("sums published lengths along the assembly axis", () => {
    const { upper, barrel } = sampleAssembly();
    const muzzle = product({
      id: "muzzle",
      categorySlug: "muzzle-device",
      lengthMm: 55.9,
      diameterMm: 22.2,
    });

    const report = computeDimensions({
      platform: "ar15",
      components: [
        component("upper-receiver", upper),
        component("barrel", barrel),
        component("muzzle-device", muzzle),
      ],
    });

    expect(report.overallLengthMm).toBeCloseTo(195 + 406.4 + 55.9, 2);
    expect(report.overallLengthNote).toContain("upper bound");
  });

  it("withholds overall length when a component on the axis has no length", () => {
    const { upper } = sampleAssembly();
    const barrel = product({ id: "barrel", categorySlug: "barrel", lengthMm: null });

    const report = computeDimensions({
      platform: "ar15",
      components: [component("upper-receiver", upper), component("barrel", barrel)],
    });

    expect(report.overallLengthMm).toBeNull();
    expect(report.overallLengthNote).toContain("no published length");
  });

  it("computes radial clearance between a handguard bore and a barrel", () => {
    const { barrel, handguard } = sampleAssembly();
    const report = computeDimensions({
      platform: "ar15",
      components: [component("barrel", barrel), component("handguard", handguard)],
    });

    const radial = report.clearances.find((entry) => entry.id === "radial:handguard:barrel");
    expect(radial?.state).toBe("GREEN");
    expect(radial?.valueMm).toBeCloseTo((38.1 - 19.05) / 2, 2);
  });

  it("reports interference when the guest is larger than the host bore", () => {
    const barrel = product({
      id: "fat-barrel",
      categorySlug: "barrel",
      lengthMm: 406.4,
      diameterMm: 42,
    });
    const handguard = product({
      id: "handguard",
      categorySlug: "handguard",
      lengthMm: 330,
      innerDiameterMm: 38.1,
    });

    const report = computeDimensions({
      platform: "ar15",
      components: [component("barrel", barrel), component("handguard", handguard)],
    });

    const radial = report.clearances.find((entry) => entry.id === "radial:handguard:barrel");
    expect(radial?.state).toBe("RED");
    expect(radial?.explanation).toContain("Documented dimensional conflict");
  });

  it("flags a tight but positive clearance as yellow", () => {
    const barrel = product({ id: "b", categorySlug: "barrel", lengthMm: 400, diameterMm: 36 });
    const handguard = product({
      id: "h",
      categorySlug: "handguard",
      lengthMm: 300,
      innerDiameterMm: 38.1,
    });

    const report = computeDimensions({
      platform: "ar15",
      components: [component("barrel", barrel), component("handguard", handguard)],
    });

    expect(report.clearances.find((entry) => entry.id === "radial:handguard:barrel")?.state).toBe(
      "YELLOW",
    );
  });

  it("returns GRAY when a dimension needed for a check is unpublished", () => {
    const barrel = product({ id: "b", categorySlug: "barrel", lengthMm: 400, diameterMm: 19 });
    const handguard = product({
      id: "h",
      categorySlug: "handguard",
      lengthMm: 300,
      innerDiameterMm: null,
    });

    const report = computeDimensions({
      platform: "ar15",
      components: [component("barrel", barrel), component("handguard", handguard)],
    });

    const radial = report.clearances.find((entry) => entry.id === "radial:handguard:barrel");
    expect(radial?.state).toBe("GRAY");
    expect(radial?.valueMm).toBeNull();
    expect(radial?.explanation).toContain("does not publish");
  });

  it("detects a handguard that extends past the muzzle", () => {
    const barrel = product({ id: "b", categorySlug: "barrel", lengthMm: 292.1, diameterMm: 19 });
    const handguard = product({
      id: "h",
      categorySlug: "handguard",
      lengthMm: 381,
      innerDiameterMm: 38.1,
    });

    const report = computeDimensions({
      platform: "ar15",
      components: [component("barrel", barrel), component("handguard", handguard)],
    });

    const axial = report.clearances.find((entry) => entry.id === "axial:handguard-barrel");
    expect(axial?.state).toBe("RED");
    expect(axial?.valueMm).toBeCloseTo(292.1 - 381, 2);
  });

  it("reports measurements including the gaps", () => {
    const barrel = product({ id: "b", categorySlug: "barrel", lengthMm: null });
    const report = computeDimensions({
      platform: "ar15",
      components: [component("barrel", barrel)],
    });

    const measurement = report.measurements.find((entry) => entry.key === "barrel:length");
    expect(measurement?.valueMm).toBeNull();
    expect(measurement?.note).toBe("Not provided by manufacturer.");
  });

  it("lays out segments in axial order for the technical view", () => {
    const { upper, barrel } = sampleAssembly();
    const { segments } = layoutAssembly([
      component("barrel", barrel),
      component("upper-receiver", upper),
    ]);

    const upperSegment = segments.find((segment) => segment.slotKey === "upper-receiver");
    const barrelSegment = segments.find((segment) => segment.slotKey === "barrel");
    expect(upperSegment?.startMm).toBe(0);
    expect(barrelSegment?.startMm).toBe(upperSegment?.endMm);
  });

  it("summarises the worst signal in a set", () => {
    expect(
      worstSignal([
        { id: "a", label: "", state: "GREEN", explanation: "", subjectProductId: "", targetProductId: "", valueMm: 1, measuredFrom: [] },
        { id: "b", label: "", state: "YELLOW", explanation: "", subjectProductId: "", targetProductId: "", valueMm: 1, measuredFrom: [] },
      ]),
    ).toBe("YELLOW");
  });
});
