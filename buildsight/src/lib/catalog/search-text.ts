import { interfaceName, categoryName, platformName } from "@/lib/catalog/vocabulary";
import { mmToInches, round, trimTrailingZeros } from "@/lib/units";

export interface SearchTextInput {
  productName: string;
  manufacturerName: string;
  manufacturerPartNumber: string;
  categorySlug: string;
  caliber?: string | null;
  platform?: string | null;
  material?: string | null;
  finish?: string | null;
  description?: string | null;
  lengthMm?: number | null;
  diameterMm?: number | null;
  mountingInterface?: string | null;
  threadSpecification?: string | null;
  gasSystemCompatibility?: string | null;
  handguardInterface?: string | null;
  receiverInterface?: string | null;
  opticInterface?: string | null;
  suppressorCompatibility?: string | null;
  barrelCompatibility?: string | null;
}

/**
 * Build the denormalised haystack indexed by Postgres full-text search.
 *
 * Lengths are emitted in both systems and in bare-number form so that queries
 * like "11.5 barrel" or "15 inch handguard" hit the right rows.
 */
export function buildSearchText(input: SearchTextInput): string {
  const parts: string[] = [
    input.productName,
    input.manufacturerName,
    input.manufacturerPartNumber,
    input.manufacturerPartNumber.replace(/[^a-z0-9]/gi, ""),
    categoryName(input.categorySlug),
    input.categorySlug.replace(/-/g, " "),
    input.caliber ?? "",
    input.platform ? platformName(input.platform) : "",
    input.platform ?? "",
    input.material ?? "",
    input.finish ?? "",
    input.description ?? "",
  ];

  const interfaces = [
    input.mountingInterface,
    input.threadSpecification,
    input.gasSystemCompatibility,
    input.handguardInterface,
    input.receiverInterface,
    input.opticInterface,
    input.suppressorCompatibility,
    input.barrelCompatibility,
  ];
  for (const slug of interfaces) {
    if (!slug) continue;
    parts.push(slug, slug.replace(/-/g, " "), interfaceName(slug));
  }

  if (typeof input.lengthMm === "number") {
    const inches = trimTrailingZeros(round(mmToInches(input.lengthMm), 2).toFixed(2));
    parts.push(
      `${inches} in`,
      `${inches} inch`,
      `${inches}"`,
      inches,
      `${trimTrailingZeros(round(input.lengthMm, 1).toFixed(1))} mm`,
    );
  }
  if (typeof input.diameterMm === "number") {
    parts.push(`${trimTrailingZeros(round(input.diameterMm, 1).toFixed(1))} mm diameter`);
  }

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
