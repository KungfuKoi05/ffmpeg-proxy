import type {
  AssemblyComponent,
  CompatibilityRuleInput,
  ProductFacts,
  VerificationStatus,
} from "@/lib/types";

/** Build a ProductFacts with sensible defaults so tests state only what matters. */
export function product(overrides: Partial<ProductFacts> & { id: string }): ProductFacts {
  return {
    slug: overrides.id,
    productName: `Product ${overrides.id}`,
    manufacturerName: "Test Manufacturer",
    manufacturerPartNumber: `PN-${overrides.id}`,
    categorySlug: "accessory",
    platform: "ar15",
    caliber: null,
    msrpCents: null,
    currentPriceCents: null,
    currency: "USD",
    weightGrams: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    diameterMm: null,
    innerDiameterMm: null,
    mountingInterface: null,
    threadSpecification: null,
    gasSystemCompatibility: null,
    handguardInterface: null,
    receiverInterface: null,
    opticInterface: null,
    suppressorCompatibility: null,
    barrelCompatibility: null,
    extraDimensionsMm: {},
    verificationStatus: "VERIFIED_MANUFACTURER" as VerificationStatus,
    availability: "IN_STOCK",
    regulatoryClass: "UNREGULATED_ACCESSORY",
    sourceUrl: "https://example.com/source",
    productUrl: "https://example.com/product",
    manufacturerUrl: "https://example.com",
    imageUrl: null,
    lastVerified: "2026-01-01T00:00:00.000Z",
    isDemo: true,
    ...overrides,
  };
}

export function component(
  slotKey: string,
  facts: ProductFacts,
  quantity = 1,
): AssemblyComponent {
  return { slotKey, quantity, product: facts };
}

export function rule(
  overrides: Partial<CompatibilityRuleInput> & { id: string },
): CompatibilityRuleInput {
  return {
    kind: "INTERFACE_MATCH",
    name: `Rule ${overrides.id}`,
    subjectCategorySlug: null,
    targetCategorySlug: null,
    subjectProductId: null,
    targetProductId: null,
    subjectField: null,
    targetField: null,
    parameters: null,
    result: "COMPATIBLE",
    explanation: "Compatible — documented interfaces match.",
    condition: null,
    sourceUrl: "https://example.com/rule",
    verificationStatus: "VERIFIED_MANUFACTURER",
    priority: 100,
    ...overrides,
  };
}

/** A minimal but complete AR-pattern assembly used across several suites. */
export function sampleAssembly() {
  const upper = product({
    id: "upper",
    categorySlug: "upper-receiver",
    receiverInterface: "ar15-upper",
    barrelCompatibility: "ar15-barrel-extension",
    mountingInterface: "picatinny-1913",
    opticInterface: "footprint-picatinny",
    lengthMm: 195,
    weightGrams: 255,
    msrpCents: 12900,
    currentPriceCents: 11900,
  });
  const lower = product({
    id: "lower",
    categorySlug: "lower-receiver",
    receiverInterface: "ar15-lower",
    lengthMm: 200,
    weightGrams: 240,
    msrpCents: 15900,
  });
  const barrel = product({
    id: "barrel",
    categorySlug: "barrel",
    barrelCompatibility: "ar15-barrel-extension",
    threadSpecification: "1-2x28",
    caliber: "5.56x45mm NATO",
    lengthMm: 406.4,
    diameterMm: 19.05,
    weightGrams: 850,
    msrpCents: 24900,
    currentPriceCents: 22900,
  });
  const handguard = product({
    id: "handguard",
    categorySlug: "handguard",
    mountingInterface: "m-lok",
    lengthMm: 330.2,
    diameterMm: 44.5,
    innerDiameterMm: 38.1,
    weightGrams: 310,
    msrpCents: 18900,
  });

  return { upper, lower, barrel, handguard };
}
