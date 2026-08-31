import { describe, expect, it } from "vitest";
import { assemblyBounds, placeAssembly } from "@/lib/assembly/geometry";
import { slotForCategory, slotsInAxialOrder, CORE_CATEGORIES } from "@/lib/assembly/slots";
import { component, product, sampleAssembly } from "./fixtures";

describe("assembly placement", () => {
  it("places axial parts end to end from published lengths", () => {
    const { upper, barrel } = sampleAssembly();
    const parts = placeAssembly([
      component("upper-receiver", upper),
      component("barrel", barrel),
    ]);

    const upperPart = parts.find((part) => part.slotKey === "upper-receiver")!;
    const barrelPart = parts.find((part) => part.slotKey === "barrel")!;

    expect(upperPart.position[0]).toBeCloseTo(195 / 2, 2);
    expect(barrelPart.position[0]).toBeCloseTo(195 + 406.4 / 2, 2);
    expect(barrelPart.lengthApproximate).toBe(false);
  });

  it("substitutes a placeholder envelope and flags it when length is unpublished", () => {
    const barrel = product({ id: "b", categorySlug: "barrel", lengthMm: null });
    const [part] = placeAssembly([component("barrel", barrel)]);

    expect(part.lengthMm).toBeGreaterThan(0);
    expect(part.defaultedDimensions).toContain("length");
    expect(part.lengthApproximate).toBe(true);
  });

  it("does not flag a part merely because width and height are unpublished", () => {
    const { upper } = sampleAssembly();
    const [part] = placeAssembly([component("upper-receiver", upper)]);
    expect(part.defaultedDimensions).toContain("width");
    expect(part.lengthApproximate).toBe(false);
  });

  it("chooses a tube for handguards so the bore stays visible", () => {
    const { handguard } = sampleAssembly();
    const [part] = placeAssembly([component("handguard", handguard)]);
    expect(part.shape).toBe("tube");
    expect(part.innerDiameterMm).toBe(38.1);
  });

  it("hangs non-axial parts off their parent slot", () => {
    const { upper } = sampleAssembly();
    const grip = product({ id: "grip", categorySlug: "grip", lengthMm: 120 });
    const lower = product({ id: "lower", categorySlug: "lower-receiver", lengthMm: 200 });

    const parts = placeAssembly([
      component("upper-receiver", upper),
      component("lower-receiver", lower),
      component("grip", grip),
    ]);

    const gripPart = parts.find((part) => part.slotKey === "grip")!;
    expect(gripPart.position[1]).toBeLessThan(0);
  });

  it("computes bounds that contain every placed part", () => {
    const { upper, barrel, handguard } = sampleAssembly();
    const parts = placeAssembly([
      component("upper-receiver", upper),
      component("barrel", barrel),
      component("handguard", handguard),
    ]);
    const bounds = assemblyBounds(parts);

    expect(bounds.size[0]).toBeGreaterThan(400);
    for (const part of parts) {
      expect(part.position[0] - part.lengthMm / 2).toBeGreaterThanOrEqual(bounds.min[0] - 0.001);
      expect(part.position[0] + part.lengthMm / 2).toBeLessThanOrEqual(bounds.max[0] + 0.001);
    }
  });

  it("returns a safe bounding box for an empty assembly", () => {
    const bounds = assemblyBounds([]);
    expect(bounds.size).toEqual([1, 1, 1]);
  });
});

describe("slot graph", () => {
  it("maps every core category to a slot", () => {
    for (const category of CORE_CATEGORIES) {
      expect(slotForCategory(category)).toBeDefined();
    }
  });

  it("orders slots from stock to muzzle for the technical view", () => {
    const order = slotsInAxialOrder().map((slot) => slot.key);
    expect(order.indexOf("stock")).toBeLessThan(order.indexOf("barrel"));
    expect(order.indexOf("barrel")).toBeLessThan(order.indexOf("muzzle-device"));
    expect(order.indexOf("muzzle-device")).toBeLessThan(order.indexOf("suppressor"));
  });
});
