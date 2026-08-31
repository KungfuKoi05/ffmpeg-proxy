/**
 * Data quality engine.
 *
 * Runs over a product record (a stored row or an in-flight ingestion draft)
 * and reports concrete, actionable defects. It never repairs data: a missing
 * measurement stays missing and is surfaced as "Not provided by manufacturer."
 */

export type QualitySeverity = "ERROR" | "WARNING" | "INFO";

export interface DataQualityIssue {
  code: string;
  severity: QualitySeverity;
  field: string | null;
  message: string;
}

export interface QualityProduct {
  manufacturerName?: string | null;
  manufacturerPartNumber?: string | null;
  productName?: string | null;
  categorySlug?: string | null;
  msrpCents?: number | null;
  currentPriceCents?: number | null;
  weightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  diameterMm?: number | null;
  innerDiameterMm?: number | null;
  verificationStatus?: string | null;
  sourceUrl?: string | null;
  productUrl?: string | null;
  manufacturerUrl?: string | null;
  imageUrl?: string | null;
  lastVerified?: Date | string | null;
  priceCheckedAt?: Date | string | null;
}

export interface QualityContext {
  /** True when another product shares the manufacturer + part number. */
  duplicateSku?: boolean;
  /** URLs a link checker has confirmed unreachable. */
  brokenUrls?: string[];
  /** Days after which verification is treated as stale. */
  staleAfterDays?: number;
  /** Days after which an observed price is treated as expired. */
  priceStaleAfterDays?: number;
  now?: Date;
}

/** Plausibility envelope for a single component, in millimetres and grams. */
const MAX_COMPONENT_LENGTH_MM = 2000;
const MAX_COMPONENT_DIAMETER_MM = 300;
const MAX_COMPONENT_WEIGHT_G = 20000;

const SEVERITY_PENALTY: Record<QualitySeverity, number> = {
  ERROR: 22,
  WARNING: 8,
  INFO: 3,
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

export function evaluateDataQuality(
  product: QualityProduct,
  context: QualityContext = {},
): { score: number; issues: DataQualityIssue[] } {
  const issues: DataQualityIssue[] = [];
  const now = context.now ?? new Date();
  const staleAfterDays = context.staleAfterDays ?? 365;
  const priceStaleAfterDays = context.priceStaleAfterDays ?? 30;
  const brokenUrls = new Set(context.brokenUrls ?? []);

  const push = (
    code: string,
    severity: QualitySeverity,
    field: string | null,
    message: string,
  ) => issues.push({ code, severity, field, message });

  if (!product.manufacturerName?.trim()) {
    push("MISSING_MANUFACTURER", "ERROR", "manufacturer", "No manufacturer is linked to this product.");
  }
  if (!product.manufacturerPartNumber?.trim()) {
    push("MISSING_SKU", "ERROR", "manufacturerPartNumber", "No manufacturer part number recorded.");
  }
  if (!product.productName?.trim()) {
    push("MISSING_NAME", "ERROR", "productName", "No product name recorded.");
  }
  if (!product.categorySlug?.trim()) {
    push("MISSING_CATEGORY", "ERROR", "category", "No category assigned.");
  }
  if (context.duplicateSku) {
    push(
      "DUPLICATE_SKU",
      "ERROR",
      "manufacturerPartNumber",
      "Another product shares this manufacturer and part number.",
    );
  }

  if (!product.sourceUrl?.trim()) {
    push("MISSING_SOURCE", "WARNING", "sourceUrl", "No source URL recorded for the specifications.");
  }
  if (product.verificationStatus === "UNVERIFIED" || !product.verificationStatus) {
    push(
      "UNVERIFIED",
      "WARNING",
      "verificationStatus",
      "Specifications are unverified and must not be treated as authoritative.",
    );
  }

  const numericChecks: Array<[string, number | null | undefined, number, string]> = [
    ["lengthMm", product.lengthMm, MAX_COMPONENT_LENGTH_MM, "length"],
    ["widthMm", product.widthMm, MAX_COMPONENT_DIAMETER_MM, "width"],
    ["heightMm", product.heightMm, MAX_COMPONENT_DIAMETER_MM, "height"],
    ["diameterMm", product.diameterMm, MAX_COMPONENT_DIAMETER_MM, "diameter"],
    ["innerDiameterMm", product.innerDiameterMm, MAX_COMPONENT_DIAMETER_MM, "inner diameter"],
  ];
  for (const [field, value, max, label] of numericChecks) {
    if (value === null || value === undefined) continue;
    if (value <= 0) {
      push("IMPOSSIBLE_DIMENSION", "ERROR", field, `Recorded ${label} is ${value} mm, which is not a physical measurement.`);
    } else if (value > max) {
      push(
        "IMPLAUSIBLE_DIMENSION",
        "WARNING",
        field,
        `Recorded ${label} is ${value} mm, beyond the ${max} mm plausibility limit — check the source units.`,
      );
    }
  }

  if (
    product.diameterMm !== null &&
    product.diameterMm !== undefined &&
    product.innerDiameterMm !== null &&
    product.innerDiameterMm !== undefined &&
    product.innerDiameterMm >= product.diameterMm
  ) {
    push(
      "CONFLICTING_DIMENSIONS",
      "ERROR",
      "innerDiameterMm",
      `Inner diameter (${product.innerDiameterMm} mm) is not smaller than the outer diameter (${product.diameterMm} mm).`,
    );
  }

  if (product.weightGrams !== null && product.weightGrams !== undefined) {
    if (product.weightGrams <= 0) {
      push("IMPOSSIBLE_WEIGHT", "ERROR", "weightGrams", `Recorded weight is ${product.weightGrams} g.`);
    } else if (product.weightGrams > MAX_COMPONENT_WEIGHT_G) {
      push(
        "IMPLAUSIBLE_WEIGHT",
        "WARNING",
        "weightGrams",
        `Recorded weight is ${product.weightGrams} g, beyond the ${MAX_COMPONENT_WEIGHT_G} g plausibility limit — check the source units.`,
      );
    }
  } else {
    push("MISSING_WEIGHT", "INFO", "weightGrams", "No published weight; build totals will report a gap.");
  }

  if (product.lengthMm === null || product.lengthMm === undefined) {
    push("MISSING_LENGTH", "INFO", "lengthMm", "No published length; dimensional checks will report UNKNOWN.");
  }

  for (const [field, value] of [
    ["msrpCents", product.msrpCents],
    ["currentPriceCents", product.currentPriceCents],
  ] as const) {
    if (value === null || value === undefined) continue;
    if (value < 0) push("NEGATIVE_PRICE", "ERROR", field, `Recorded price is ${value} cents.`);
  }
  if (
    (product.msrpCents === null || product.msrpCents === undefined) &&
    (product.currentPriceCents === null || product.currentPriceCents === undefined)
  ) {
    push("MISSING_PRICE", "INFO", "msrpCents", "No MSRP or observed retail price recorded.");
  }

  for (const [field, url] of [
    ["productUrl", product.productUrl],
    ["manufacturerUrl", product.manufacturerUrl],
    ["sourceUrl", product.sourceUrl],
    ["imageUrl", product.imageUrl],
  ] as const) {
    if (!url) continue;
    if (brokenUrls.has(url)) {
      push("BROKEN_URL", "WARNING", field, `The recorded URL did not resolve: ${url}`);
    } else if (!/^https?:\/\//i.test(url)) {
      push("INVALID_URL", "WARNING", field, `The recorded URL is not an absolute http(s) URL: ${url}`);
    }
  }

  const lastVerified = asDate(product.lastVerified);
  if (!lastVerified) {
    push("NEVER_VERIFIED", "WARNING", "lastVerified", "This record has never been verified against a source.");
  } else if (daysBetween(now, lastVerified) > staleAfterDays) {
    push(
      "EXPIRED_VERIFICATION",
      "WARNING",
      "lastVerified",
      `Last verified ${Math.round(daysBetween(now, lastVerified))} days ago, beyond the ${staleAfterDays}-day window.`,
    );
  }

  const priceCheckedAt = asDate(product.priceCheckedAt);
  if (priceCheckedAt && daysBetween(now, priceCheckedAt) > priceStaleAfterDays) {
    push(
      "EXPIRED_PRICE",
      "WARNING",
      "priceCheckedAt",
      `Price last checked ${Math.round(daysBetween(now, priceCheckedAt))} days ago.`,
    );
  }

  const penalty = issues.reduce((sum, issue) => sum + SEVERITY_PENALTY[issue.severity], 0);
  return { score: Math.max(0, Math.min(100, 100 - penalty)), issues };
}

export function qualityBand(score: number): { label: string; state: "GREEN" | "YELLOW" | "RED" } {
  if (score >= 85) return { label: "Good", state: "GREEN" };
  if (score >= 60) return { label: "Needs attention", state: "YELLOW" };
  return { label: "Poor", state: "RED" };
}
