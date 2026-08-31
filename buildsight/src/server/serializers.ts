import { toNumber } from "@/lib/units";
import { toProductFacts, type ProductWithRelations } from "@/server/products";
import type { DataQualityIssue } from "@/lib/quality/data-quality";
import type { ProductFacts } from "@/lib/types";

/** The public JSON shape for a product, used by the API and the client UI. */
export interface SerializedProduct extends ProductFacts {
  categoryName: string;
  manufacturerSlug: string;
  manufacturerId: string;
  description: string | null;
  material: string | null;
  finish: string | null;
  publishState: string;
  technicalDrawingUrl: string | null;
  manualUrl: string | null;
  dataQualityScore: number | null;
  dataQualityIssues: DataQualityIssue[];
  specifications: Array<{
    key: string;
    label: string;
    value: string;
    unit: string | null;
    verificationStatus: string;
    sourceUrl: string | null;
  }>;
  dimensions: Array<{
    kind: string;
    label: string;
    valueMm: number | null;
    verificationStatus: string;
    sourceUrl: string | null;
  }>;
  prices: Array<{
    id: string;
    retailerName: string | null;
    retailerSlug: string | null;
    amountCents: number;
    salePriceCents: number | null;
    availability: string;
    productUrl: string | null;
    checkedAt: string;
  }>;
  images: Array<{ url: string; alt: string | null }>;
  attachmentPoints: Array<{
    slug: string;
    label: string;
    role: string;
    interface: string;
    offsetMm: [number, number, number];
  }>;
  hasApproximateGeometry: boolean;
}

export function serializeProduct(product: ProductWithRelations): SerializedProduct {
  return {
    ...toProductFacts(product),
    categoryName: product.category.name,
    manufacturerSlug: product.manufacturer.slug,
    manufacturerId: product.manufacturer.id,
    description: product.description,
    material: product.material,
    finish: product.finish,
    publishState: product.publishState,
    technicalDrawingUrl: product.technicalDrawingUrl,
    manualUrl: product.manualUrl,
    dataQualityScore: product.dataQualityScore,
    dataQualityIssues: (product.dataQualityIssues as DataQualityIssue[] | null) ?? [],
    specifications: (product.specifications ?? []).map((spec) => ({
      key: spec.key,
      label: spec.label,
      value: spec.value,
      unit: spec.unit,
      verificationStatus: spec.verificationStatus,
      sourceUrl: spec.sourceUrl,
    })),
    dimensions: (product.dimensions ?? []).map((dimension) => ({
      kind: dimension.kind,
      label: dimension.label,
      valueMm: toNumber(dimension.valueMm),
      verificationStatus: dimension.verificationStatus,
      sourceUrl: dimension.sourceUrl,
    })),
    prices: (product.prices ?? []).map((price) => ({
      id: price.id,
      retailerName: price.retailer?.name ?? null,
      retailerSlug: price.retailer?.slug ?? null,
      amountCents: price.amountCents,
      salePriceCents: price.salePriceCents,
      availability: price.availability,
      productUrl: price.productUrl,
      checkedAt: price.checkedAt.toISOString(),
    })),
    images: (product.images ?? []).map((image) => ({ url: image.url, alt: image.alt })),
    attachmentPoints: (product.attachmentPoints ?? []).map((point) => ({
      slug: point.slug,
      label: point.label,
      role: point.role,
      interface: point.interface,
      offsetMm: [
        toNumber(point.offsetXMm) ?? 0,
        toNumber(point.offsetYMm) ?? 0,
        toNumber(point.offsetZMm) ?? 0,
      ] as [number, number, number],
    })),
    hasApproximateGeometry: (product.assets ?? []).every((asset) => asset.isApproximate),
  };
}
