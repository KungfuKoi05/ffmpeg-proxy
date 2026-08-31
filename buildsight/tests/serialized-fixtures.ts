import { product } from "./fixtures";
import type { SerializedProduct } from "@/server/serializers";

/** A SerializedProduct for component tests. */
export function serializedProduct(
  overrides: Partial<SerializedProduct> = {},
): SerializedProduct {
  return {
    ...product({ id: "barrel", categorySlug: "barrel" }),
    categoryName: "Barrel",
    manufacturerSlug: "test-manufacturer",
    manufacturerId: "man-1",
    description: "A test product",
    material: "Steel",
    finish: "Nitride",
    publishState: "PUBLISHED",
    technicalDrawingUrl: null,
    manualUrl: null,
    dataQualityScore: 95,
    dataQualityIssues: [],
    specifications: [],
    dimensions: [],
    prices: [],
    images: [],
    attachmentPoints: [],
    hasApproximateGeometry: true,
    ...overrides,
  };
}
