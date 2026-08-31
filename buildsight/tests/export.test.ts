import { describe, expect, it } from "vitest";
import {
  buildConfigurationJson,
  buildPartsCsv,
  buildShoppingList,
  buildSheetPdf,
  type BuildExportInput,
} from "@/lib/export/build-sheet";
import { summarizeBuild } from "@/lib/build/summary";
import { component, product, rule, sampleAssembly } from "./fixtures";

function exportInput(): BuildExportInput {
  const { upper, barrel } = sampleAssembly();
  const suppressor = product({
    id: "supp",
    categorySlug: "suppressor",
    regulatoryClass: "NFA_ITEM",
    lengthMm: 152.4,
    weightGrams: 400,
    msrpCents: 89900,
  });
  const components = [
    component("upper-receiver", upper),
    component("barrel", barrel),
    component("suppressor", suppressor),
  ];
  const summary = summarizeBuild({ platform: "ar15", components }, [
    rule({
      id: "barrel-upper",
      subjectCategorySlug: "barrel",
      targetCategorySlug: "upper-receiver",
      subjectField: "barrelCompatibility",
      targetField: "barrelCompatibility",
    }),
  ]);

  return {
    build: {
      id: "build-1",
      name: "16 in Range Configuration",
      description: "A test configuration",
      platform: "ar15",
      caliber: "5.56x45mm NATO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      ownerName: "Tester",
    },
    components,
    summary,
    generatedAt: new Date("2026-03-01T12:00:00.000Z"),
  };
}

describe("CSV parts list", () => {
  it("emits a header and one row per component", () => {
    const csv = buildPartsCsv(exportInput());
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("slot,category,manufacturer,product,part_number");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("Upper receiver");
  });

  it("leaves unpublished values empty rather than writing a zero", () => {
    const input = exportInput();
    input.components[0].product.weightGrams = null;
    const csv = buildPartsCsv(input);
    const row = csv.split("\r\n")[1].split(",");
    expect(row).toContain("");
    expect(csv).not.toContain(",0,");
  });

  it("quotes values containing commas", () => {
    const input = exportInput();
    input.components[0].product.productName = 'Upper, "forged"';
    const csv = buildPartsCsv(input);
    expect(csv).toContain('"Upper, ""forged"""');
  });
});

describe("JSON configuration export", () => {
  it("is valid JSON with a version, components and disclaimers", () => {
    const parsed = JSON.parse(buildConfigurationJson(exportInput())) as Record<string, unknown>;
    expect(parsed.format).toBe("buildsight.configuration/v1");
    expect(Array.isArray(parsed.components)).toBe(true);
    expect((parsed.components as unknown[]).length).toBe(3);
    expect((parsed.disclaimers as string[]).join(" ")).toContain("not a claim of functional compatibility");
  });

  it("preserves nulls for unpublished values", () => {
    const input = exportInput();
    input.components[1].product.diameterMm = null;
    const parsed = JSON.parse(buildConfigurationJson(input)) as {
      components: Array<{ product: { diameterMm: number | null } }>;
    };
    expect(parsed.components[1].product.diameterMm).toBeNull();
  });
});

describe("shopping list", () => {
  it("marks regulated items and routes them to the manufacturer", () => {
    const items = buildShoppingList(exportInput());
    const regulated = items.find((item) => item.productId === "supp");
    expect(regulated?.regulated).toBe(true);
    expect(regulated?.purchaseNote).toContain("manufacturer's or retailer's own process");

    const unregulated = items.find((item) => item.productId === "barrel");
    expect(unregulated?.regulated).toBe(false);
    expect(unregulated?.purchaseNote).toBeNull();
  });
});

describe("PDF build sheet", () => {
  it("produces a structurally valid PDF", () => {
    const bytes = buildSheetPdf(exportInput());
    const text = new TextDecoder().decode(bytes);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Page");
    expect(text).toContain("xref");
    expect(text).toContain("startxref");
  });

  it("records byte offsets in the xref table that point at real objects", () => {
    const bytes = buildSheetPdf(exportInput());
    const text = new TextDecoder().decode(bytes);
    const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");

    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets.length).toBeGreaterThan(3);
    for (const [index, offset] of offsets.entries()) {
      expect(text.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    }
  });

  it("carries the build name, component names and the boundary statement", () => {
    const text = new TextDecoder().decode(buildSheetPdf(exportInput()));
    expect(text).toContain("16 in Range Configuration");
    expect(text).toContain("BUILDSIGHT BUILD SHEET");
    expect(text).toContain("does not provide manufacturing");
  });

  it("states withheld values instead of inventing them", () => {
    const input = exportInput();
    input.components[1].product.lengthMm = null;
    input.summary = summarizeBuild({ platform: "ar15", components: input.components }, []);
    const text = new TextDecoder().decode(buildSheetPdf(input));
    expect(text).toContain("Withheld");
  });
});
