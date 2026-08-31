/**
 * Build sheet, parts list and configuration exports.
 *
 * Every export carries the same provenance the UI shows: verification status,
 * source links and any compatibility or clearance warnings. Missing values are
 * exported as "Not provided by manufacturer." rather than blank cells, so a
 * gap is never mistaken for a zero.
 */

import { MARGIN, PdfDocument, PAGE_WIDTH } from "@/lib/export/pdf";
import { formatLength, formatMass, formatMoney, NOT_PROVIDED } from "@/lib/units";
import { VERIFICATION_LABELS, categoryName, platformName } from "@/lib/catalog/vocabulary";
import { slotLabel } from "@/lib/assembly/slots";
import type { BuildSummary } from "@/lib/build/summary";
import type { AssemblyComponent } from "@/lib/types";

export interface BuildExportInput {
  build: {
    id: string;
    name: string;
    description: string | null;
    platform: string | null;
    caliber: string | null;
    createdAt: string;
    updatedAt: string;
    ownerName: string | null;
  };
  components: AssemblyComponent[];
  summary: BuildSummary;
  generatedAt?: Date;
}

const INK: [number, number, number] = [0.1, 0.1, 0.12];
const MUTED: [number, number, number] = [0.42, 0.44, 0.5];

export function buildSheetPdf(input: BuildExportInput): Uint8Array {
  const { build, components, summary } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const doc = new PdfDocument(`${build.name} — BuildSight build sheet`);
  doc.addPage();

  doc.rect(0, 0, PAGE_WIDTH, 4, [0.96, 0.62, 0.14]);
  doc.y = MARGIN;
  doc.text(MARGIN, "BUILDSIGHT BUILD SHEET", { size: 8, font: "Courier", color: MUTED });
  doc.text(MARGIN, build.name, { size: 18, font: "Helvetica-Bold", color: INK });
  if (build.description) {
    doc.text(MARGIN, build.description, { size: 9, color: MUTED, maxWidth: doc.contentWidth });
  }

  doc.y += 4;
  doc.rule();

  // ---- Configuration overview ---------------------------------------------
  const overview: Array<[string, string]> = [
    ["Platform", platformName(build.platform)],
    ["Caliber", build.caliber ?? NOT_PROVIDED],
    ["Components", String(summary.componentCount)],
    [
      "Estimated cost",
      summary.cost.totalCurrentCents === null
        ? "No pricing observed"
        : formatMoney(summary.cost.totalCurrentCents, summary.currency),
    ],
    [
      "Estimated unloaded weight",
      summary.weight.totalGrams === null
        ? "Insufficient published weights"
        : `${formatMass(summary.weight.totalGrams)}${
            summary.weight.missingCount > 0
              ? ` (${summary.weight.missingCount} component(s) without a published weight)`
              : ""
          }`,
    ],
    [
      "Overall length",
      summary.dimensions.overallLengthMm === null
        ? "Withheld — a component on the axis has no published length"
        : `${formatLength(summary.dimensions.overallLengthMm)} (${formatLength(summary.dimensions.overallLengthMm, "metric")})`,
    ],
    ["Documented compatibility", summary.compatibility.overall],
    ["Build confidence", summary.score.overall === null ? "—" : `${summary.score.overall}/100`],
    ["Generated", generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
  ];

  for (const [label, value] of overview) {
    const top = doc.y;
    doc.textAt(MARGIN, top, label.toUpperCase(), { size: 7.5, font: "Courier", color: MUTED });
    doc.textAt(MARGIN + 150, top, value, { size: 9, color: INK });
    doc.y += 14;
  }

  doc.rule();

  // ---- Component list ------------------------------------------------------
  doc.text(MARGIN, "COMPONENTS", { size: 8, font: "Courier", color: MUTED });
  doc.y += 2;
  const columns = { slot: MARGIN, part: MARGIN + 74, sku: MARGIN + 250, spec: MARGIN + 330, price: MARGIN + 440 };
  doc.row(
    [
      { x: columns.slot, text: "SLOT", font: "Helvetica-Bold" },
      { x: columns.part, text: "MANUFACTURER / PRODUCT", font: "Helvetica-Bold" },
      { x: columns.sku, text: "PART NO.", font: "Helvetica-Bold" },
      { x: columns.spec, text: "LENGTH / WEIGHT", font: "Helvetica-Bold" },
      { x: columns.price, text: "PRICE", font: "Helvetica-Bold" },
    ],
    { size: 7.5 },
  );

  for (const component of components) {
    const product = component.product;
    const price = product.currentPriceCents ?? product.msrpCents;
    doc.row([
      { x: columns.slot, text: slotLabel(component.slotKey), width: 70, size: 8 },
      {
        x: columns.part,
        text: `${product.manufacturerName} ${product.productName}`,
        width: 172,
        size: 8,
      },
      { x: columns.sku, text: product.manufacturerPartNumber, width: 76, size: 8, font: "Courier" },
      {
        x: columns.spec,
        text: `${product.lengthMm === null ? "—" : formatLength(product.lengthMm)} / ${
          product.weightGrams === null ? "—" : formatMass(product.weightGrams)
        }`,
        width: 106,
        size: 8,
      },
      {
        x: columns.price,
        text: price === null ? "—" : formatMoney(price, product.currency),
        width: 70,
        size: 8,
      },
    ]);
    doc.row([
      {
        x: columns.part,
        text: `${VERIFICATION_LABELS[product.verificationStatus] ?? product.verificationStatus}${
          product.sourceUrl ? ` · ${product.sourceUrl}` : " · no source recorded"
        }`,
        width: 400,
        size: 6.8,
      },
    ], { lineHeight: 11 });
  }

  doc.rule();

  // ---- Confidence breakdown ------------------------------------------------
  doc.text(MARGIN, "BUILD CONFIDENCE", { size: 8, font: "Courier", color: MUTED });
  for (const dimension of summary.score.dimensions) {
    const top = doc.y;
    doc.textAt(MARGIN, top, dimension.label, { size: 8.5, color: INK });
    doc.textAt(MARGIN + 130, top, dimension.value === null ? "n/a" : `${dimension.value}%`, {
      size: 8.5,
      font: "Courier",
      color: INK,
    });
    doc.textAt(MARGIN + 180, top, dimension.note, { size: 7.5, color: MUTED });
    doc.y += 13;
  }

  // ---- Warnings ------------------------------------------------------------
  const warnings = summary.compatibility.findings.filter(
    (finding) => finding.state !== "COMPATIBLE",
  );
  const clearanceWarnings = summary.dimensions.clearances.filter(
    (clearance) => clearance.state !== "GREEN",
  );

  if (warnings.length || clearanceWarnings.length) {
    doc.rule();
    doc.text(MARGIN, "WARNINGS", { size: 8, font: "Courier", color: MUTED });
    for (const finding of warnings) {
      doc.text(MARGIN, `[${finding.state}] ${finding.subjectLabel} → ${finding.targetLabel}`, {
        size: 8.5,
        font: "Helvetica-Bold",
        maxWidth: doc.contentWidth,
      });
      doc.text(MARGIN + 10, finding.explanation, {
        size: 8,
        color: MUTED,
        maxWidth: doc.contentWidth - 10,
      });
      if (finding.condition) {
        doc.text(MARGIN + 10, `Condition: ${finding.condition}`, {
          size: 8,
          color: MUTED,
          maxWidth: doc.contentWidth - 10,
        });
      }
      doc.y += 3;
    }
    for (const clearance of clearanceWarnings) {
      doc.text(MARGIN, `[${clearance.state}] ${clearance.label}`, {
        size: 8.5,
        font: "Helvetica-Bold",
        maxWidth: doc.contentWidth,
      });
      doc.text(MARGIN + 10, clearance.explanation, {
        size: 8,
        color: MUTED,
        maxWidth: doc.contentWidth - 10,
      });
      doc.y += 3;
    }
  }

  doc.rule();
  doc.text(
    MARGIN,
    "Dimensional clearance is computed from published dimensions and is not a claim of functional compatibility. Visual geometry in the application is a visual approximation. BuildSight does not provide manufacturing, machining, conversion or ammunition-loading information.",
    { size: 7, color: MUTED, maxWidth: doc.contentWidth },
  );

  return doc.toBuffer();
}

export function buildPartsCsv(input: BuildExportInput): string {
  const header = [
    "slot",
    "category",
    "manufacturer",
    "product",
    "part_number",
    "quantity",
    "msrp_usd",
    "current_price_usd",
    "weight_g",
    "length_mm",
    "diameter_mm",
    "verification_status",
    "availability",
    "regulatory_class",
    "product_url",
    "source_url",
  ];

  const rows = input.components.map((component) => {
    const product = component.product;
    return [
      slotLabel(component.slotKey),
      categoryName(product.categorySlug),
      product.manufacturerName,
      product.productName,
      product.manufacturerPartNumber,
      String(component.quantity),
      product.msrpCents === null ? "" : (product.msrpCents / 100).toFixed(2),
      product.currentPriceCents === null ? "" : (product.currentPriceCents / 100).toFixed(2),
      product.weightGrams === null ? "" : String(product.weightGrams),
      product.lengthMm === null ? "" : product.lengthMm.toFixed(2),
      product.diameterMm === null ? "" : product.diameterMm.toFixed(2),
      product.verificationStatus,
      product.availability,
      product.regulatoryClass,
      product.productUrl ?? "",
      product.sourceUrl ?? "",
    ];
  });

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildConfigurationJson(input: BuildExportInput): string {
  return JSON.stringify(
    {
      format: "buildsight.configuration/v1",
      exportedAt: (input.generatedAt ?? new Date()).toISOString(),
      build: input.build,
      components: input.components.map((component) => ({
        slotKey: component.slotKey,
        quantity: component.quantity,
        product: {
          id: component.product.id,
          slug: component.product.slug,
          manufacturer: component.product.manufacturerName,
          productName: component.product.productName,
          manufacturerPartNumber: component.product.manufacturerPartNumber,
          categorySlug: component.product.categorySlug,
          msrpCents: component.product.msrpCents,
          currentPriceCents: component.product.currentPriceCents,
          weightGrams: component.product.weightGrams,
          lengthMm: component.product.lengthMm,
          diameterMm: component.product.diameterMm,
          verificationStatus: component.product.verificationStatus,
          sourceUrl: component.product.sourceUrl,
          productUrl: component.product.productUrl,
        },
      })),
      summary: {
        cost: input.summary.cost,
        weight: input.summary.weight,
        compatibility: input.summary.compatibility,
        dimensions: input.summary.dimensions,
        score: input.summary.score,
      },
      disclaimers: [
        "Dimensional clearance is derived from published dimensions and is not a claim of functional compatibility.",
        "Values marked null are not published by the manufacturer and were not estimated.",
      ],
    },
    null,
    2,
  );
}

/** Shopping list rows: one line per component with its purchase links. */
export function buildShoppingList(input: BuildExportInput) {
  return input.components.map((component) => {
    const product = component.product;
    const regulated =
      product.regulatoryClass === "NFA_ITEM" ||
      product.regulatoryClass === "SERIALIZED_COMPONENT" ||
      product.regulatoryClass === "RESTRICTED_OTHER";
    return {
      productId: product.id,
      slug: product.slug,
      slot: slotLabel(component.slotKey),
      manufacturer: product.manufacturerName,
      product: product.productName,
      partNumber: product.manufacturerPartNumber,
      quantity: component.quantity,
      priceCents: product.currentPriceCents ?? product.msrpCents,
      currency: product.currency,
      availability: product.availability,
      productUrl: product.productUrl,
      manufacturerUrl: product.manufacturerUrl,
      regulated,
      purchaseNote: regulated
        ? "Regulated item — complete the purchase through the manufacturer's or retailer's own process."
        : null,
    };
  });
}
