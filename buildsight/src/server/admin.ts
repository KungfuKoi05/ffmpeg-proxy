import { prisma } from "@/lib/db";
import { evaluateDataQuality, type DataQualityIssue } from "@/lib/quality/data-quality";
import { buildSearchText } from "@/lib/catalog/search-text";
import { toNumber } from "@/lib/units";
import type { Prisma } from "@prisma/client";

export interface CatalogHealth {
  products: number;
  published: number;
  drafts: number;
  manufacturers: number;
  rules: number;
  retailers: number;
  unverified: number;
  missingDimensions: number;
  missingPrices: number;
  duplicateSkus: number;
  expiredPrices: number;
  averageQuality: number | null;
  pendingImportRecords: number;
}

/** Aggregate catalog health for the admin overview and the quality report. */
export async function catalogHealth(now = new Date()): Promise<CatalogHealth> {
  const staleBefore = new Date(now.getTime() - 30 * 86_400_000);

  const [
    products,
    published,
    drafts,
    manufacturers,
    rules,
    retailers,
    unverified,
    missingDimensions,
    withPrices,
    expiredPrices,
    qualityAggregate,
    pendingImportRecords,
    duplicates,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { publishState: "PUBLISHED" } }),
    prisma.product.count({ where: { publishState: { in: ["DRAFT", "PENDING_REVIEW"] } } }),
    prisma.manufacturer.count(),
    prisma.compatibilityRule.count({ where: { isActive: true } }),
    prisma.retailer.count(),
    prisma.product.count({ where: { verificationStatus: "UNVERIFIED" } }),
    prisma.product.count({ where: { lengthMm: null } }),
    prisma.product.count({ where: { OR: [{ msrpCents: { not: null } }, { prices: { some: {} } }] } }),
    prisma.price.count({ where: { isCurrent: true, checkedAt: { lt: staleBefore } } }),
    prisma.product.aggregate({ _avg: { dataQualityScore: true } }),
    prisma.importRecord.count({ where: { state: { in: ["PENDING", "NEEDS_REVIEW"] } } }),
    prisma.product.groupBy({
      by: ["manufacturerId", "manufacturerPartNumber"],
      _count: { _all: true },
      having: { manufacturerPartNumber: { _count: { gt: 1 } } },
    }),
  ]);

  return {
    products,
    published,
    drafts,
    manufacturers,
    rules,
    retailers,
    unverified,
    missingDimensions,
    missingPrices: products - withPrices,
    duplicateSkus: duplicates.length,
    expiredPrices,
    averageQuality:
      qualityAggregate._avg.dataQualityScore === null
        ? null
        : Math.round(qualityAggregate._avg.dataQualityScore),
    pendingImportRecords,
  };
}

export interface QualityRow {
  id: string;
  slug: string;
  productName: string;
  manufacturerName: string;
  score: number;
  issues: DataQualityIssue[];
}

/** Products ordered worst-first for the data quality report. */
export async function lowestQualityProducts(limit = 40): Promise<QualityRow[]> {
  const products = await prisma.product.findMany({
    orderBy: [{ dataQualityScore: "asc" }, { updatedAt: "desc" }],
    take: limit,
    include: { manufacturer: { select: { name: true } } },
  });

  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    productName: product.productName,
    manufacturerName: product.manufacturer.name,
    score: product.dataQualityScore ?? 0,
    issues: (product.dataQualityIssues as DataQualityIssue[] | null) ?? [],
  }));
}

/**
 * Recompute the denormalised search haystack and the data-quality score for a
 * product. Called after every admin write so the two never drift from the row.
 */
export async function refreshDerivedProductFields(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      manufacturer: { select: { name: true } },
      category: { select: { slug: true } },
      prices: { where: { isCurrent: true }, orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });
  if (!product) return;

  const duplicate = await prisma.product.count({
    where: {
      manufacturerId: product.manufacturerId,
      manufacturerPartNumber: product.manufacturerPartNumber,
      NOT: { id: product.id },
    },
  });

  const quality = evaluateDataQuality(
    {
      manufacturerName: product.manufacturer.name,
      manufacturerPartNumber: product.manufacturerPartNumber,
      productName: product.productName,
      categorySlug: product.category.slug,
      msrpCents: product.msrpCents,
      currentPriceCents: product.prices[0]?.amountCents ?? null,
      weightGrams: product.weightGrams,
      lengthMm: toNumber(product.lengthMm),
      widthMm: toNumber(product.widthMm),
      heightMm: toNumber(product.heightMm),
      diameterMm: toNumber(product.diameterMm),
      innerDiameterMm: toNumber(product.innerDiameterMm),
      verificationStatus: product.verificationStatus,
      sourceUrl: product.sourceUrl,
      productUrl: product.productUrl,
      manufacturerUrl: product.manufacturerUrl,
      imageUrl: product.imageUrl,
      lastVerified: product.lastVerified,
      priceCheckedAt: product.prices[0]?.checkedAt ?? null,
    },
    { duplicateSku: duplicate > 0 },
  );

  const searchText = buildSearchText({
    productName: product.productName,
    manufacturerName: product.manufacturer.name,
    manufacturerPartNumber: product.manufacturerPartNumber,
    categorySlug: product.category.slug,
    caliber: product.caliber,
    platform: product.platform,
    material: product.material,
    finish: product.finish,
    description: product.description,
    lengthMm: toNumber(product.lengthMm),
    diameterMm: toNumber(product.diameterMm),
    mountingInterface: product.mountingInterface,
    threadSpecification: product.threadSpecification,
    gasSystemCompatibility: product.gasSystemCompatibility,
    handguardInterface: product.handguardInterface,
    receiverInterface: product.receiverInterface,
    opticInterface: product.opticInterface,
    suppressorCompatibility: product.suppressorCompatibility,
    barrelCompatibility: product.barrelCompatibility,
  });

  await prisma.product.update({
    where: { id: product.id },
    data: {
      searchText,
      dataQualityScore: quality.score,
      dataQualityIssues: quality.issues as unknown as Prisma.InputJsonValue,
    },
  });
}
