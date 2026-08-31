import type { ProductFacts } from "@/lib/types";

/** Base dimension keys that live in dedicated Product columns. */
export const BASE_DIMENSION_KEYS = [
  "length",
  "width",
  "height",
  "diameter",
  "innerDiameter",
] as const;

const BASE_FIELD_BY_KEY: Record<string, keyof ProductFacts> = {
  length: "lengthMm",
  width: "widthMm",
  height: "heightMm",
  diameter: "diameterMm",
  innerDiameter: "innerDiameterMm",
  outerDiameter: "diameterMm",
};

/**
 * Resolve a dimension by key, in millimetres.
 *
 * Looks in the dedicated columns first, then in the structured `Dimension`
 * rows. Returns null when the manufacturer has not published the value — the
 * callers must surface that as UNKNOWN rather than substituting a guess.
 */
export function getDimensionMm(product: ProductFacts, key: string): number | null {
  const baseField = BASE_FIELD_BY_KEY[key];
  if (baseField) {
    const value = product[baseField];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  const extra = product.extraDimensionsMm[key];
  if (typeof extra === "number" && Number.isFinite(extra)) return extra;
  return null;
}

export function hasDimension(product: ProductFacts, key: string): boolean {
  return getDimensionMm(product, key) !== null;
}
