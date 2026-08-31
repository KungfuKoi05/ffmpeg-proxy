import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/units";
import type { ProductFacts, VerificationStatus, Availability, RegulatoryClass } from "@/lib/types";

/** Everything the engines and product cards need, in one round trip. */
export const productInclude = {
  manufacturer: { select: { id: true, name: true, slug: true, website: true, logoUrl: true } },
  category: { select: { id: true, slug: true, name: true, parentId: true } },
  dimensions: true,
  images: { orderBy: { sortOrder: "asc" } },
  prices: {
    where: { isCurrent: true },
    orderBy: { amountCents: "asc" },
    include: { retailer: true },
  },
  assets: { orderBy: { lodLevel: "asc" } },
  attachmentPoints: true,
  dataSource: { select: { id: true, name: true, slug: true, kind: true, trustWeight: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Lowest currently observed price across tracked retailers, in cents. */
export function currentPriceCents(product: ProductWithRelations): number | null {
  const prices = product.prices ?? [];
  if (prices.length === 0) return null;
  const amounts = prices.map((price) => price.salePriceCents ?? price.amountCents);
  return Math.min(...amounts);
}

export function toProductFacts(product: ProductWithRelations): ProductFacts {
  const extraDimensionsMm: Record<string, number> = {};
  for (const dimension of product.dimensions ?? []) {
    const value = toNumber(dimension.valueMm);
    if (value !== null) extraDimensionsMm[dimension.kind] = value;
  }

  return {
    id: product.id,
    slug: product.slug,
    productName: product.productName,
    manufacturerName: product.manufacturer.name,
    manufacturerPartNumber: product.manufacturerPartNumber,
    categorySlug: product.category.slug,
    platform: product.platform,
    caliber: product.caliber,
    msrpCents: product.msrpCents,
    currentPriceCents: currentPriceCents(product),
    currency: product.currency,
    weightGrams: product.weightGrams,
    lengthMm: toNumber(product.lengthMm),
    widthMm: toNumber(product.widthMm),
    heightMm: toNumber(product.heightMm),
    diameterMm: toNumber(product.diameterMm),
    innerDiameterMm: toNumber(product.innerDiameterMm),
    mountingInterface: product.mountingInterface,
    threadSpecification: product.threadSpecification,
    gasSystemCompatibility: product.gasSystemCompatibility,
    handguardInterface: product.handguardInterface,
    receiverInterface: product.receiverInterface,
    opticInterface: product.opticInterface,
    suppressorCompatibility: product.suppressorCompatibility,
    barrelCompatibility: product.barrelCompatibility,
    extraDimensionsMm,
    verificationStatus: product.verificationStatus as VerificationStatus,
    availability: product.availability as Availability,
    regulatoryClass: product.regulatoryClass as RegulatoryClass,
    sourceUrl: product.sourceUrl,
    productUrl: product.productUrl,
    manufacturerUrl: product.manufacturerUrl ?? product.manufacturer.website,
    imageUrl: product.imageUrl ?? product.images?.[0]?.url ?? null,
    lastVerified: product.lastVerified ? product.lastVerified.toISOString() : null,
    isDemo: product.isDemo,
  };
}

export interface ProductSearchParams {
  q?: string;
  categorySlug?: string;
  manufacturerSlug?: string;
  platform?: string;
  caliber?: string;
  verificationStatus?: string;
  availability?: string;
  interfaceSlug?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  maxWeightGrams?: number;
  minLengthMm?: number;
  maxLengthMm?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "weight-asc" | "name-asc" | "newest";
  page?: number;
  pageSize?: number;
  includeUnpublished?: boolean;
}

export interface ProductSearchResult {
  products: ProductWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  /** True when full-text matching fell back to substring matching. */
  usedFallback: boolean;
}

/**
 * Full-text search over the denormalised haystack, with a substring fallback.
 *
 * The ranked id lookup runs as raw SQL (Prisma has no tsvector operator) and
 * the rows are then fetched through the query builder so filters, includes and
 * types stay in one place.
 */
async function fullTextProductIds(
  query: string,
  limit: number,
): Promise<{ ids: string[]; usedFallback: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { ids: [], usedFallback: false };

  const ranked = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Product"
    WHERE to_tsvector('english', "searchText") @@ websearch_to_tsquery('english', ${trimmed})
    ORDER BY ts_rank(to_tsvector('english', "searchText"), websearch_to_tsquery('english', ${trimmed})) DESC
    LIMIT ${limit}
  `;
  if (ranked.length > 0) return { ids: ranked.map((row) => row.id), usedFallback: false };

  // Fallback: every whitespace-separated token must appear somewhere in the
  // haystack. Catches partial part numbers and fragments like `11.5`.
  const tokens = trimmed.split(/\s+/).filter(Boolean).slice(0, 6);
  const conditions = tokens.map(
    (token) => Prisma.sql`"searchText" ILIKE ${"%" + token + "%"}`,
  );
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Product"
    WHERE ${Prisma.join(conditions, " AND ")}
    LIMIT ${limit}
  `;
  return { ids: rows.map((row) => row.id), usedFallback: true };
}

export async function searchProducts(
  params: ProductSearchParams,
): Promise<ProductSearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24));

  const where: Prisma.ProductWhereInput = {};
  if (!params.includeUnpublished) where.publishState = "PUBLISHED";
  if (params.categorySlug) where.category = { slug: params.categorySlug };
  if (params.manufacturerSlug) where.manufacturer = { slug: params.manufacturerSlug };
  if (params.platform) where.platform = params.platform;
  if (params.caliber) where.caliber = params.caliber;
  if (params.verificationStatus) {
    where.verificationStatus = params.verificationStatus as Prisma.EnumVerificationStatusFilter["equals"];
  }
  if (params.availability) {
    where.availability = params.availability as Prisma.EnumAvailabilityFilter["equals"];
  }
  if (params.interfaceSlug) {
    where.OR = [
      { mountingInterface: params.interfaceSlug },
      { threadSpecification: params.interfaceSlug },
      { gasSystemCompatibility: params.interfaceSlug },
      { handguardInterface: params.interfaceSlug },
      { receiverInterface: params.interfaceSlug },
      { opticInterface: params.interfaceSlug },
      { suppressorCompatibility: params.interfaceSlug },
      { barrelCompatibility: params.interfaceSlug },
    ];
  }
  if (params.minPriceCents !== undefined || params.maxPriceCents !== undefined) {
    where.msrpCents = {
      ...(params.minPriceCents !== undefined ? { gte: params.minPriceCents } : {}),
      ...(params.maxPriceCents !== undefined ? { lte: params.maxPriceCents } : {}),
    };
  }
  if (params.maxWeightGrams !== undefined) where.weightGrams = { lte: params.maxWeightGrams };
  if (params.minLengthMm !== undefined || params.maxLengthMm !== undefined) {
    where.lengthMm = {
      ...(params.minLengthMm !== undefined ? { gte: new Prisma.Decimal(params.minLengthMm) } : {}),
      ...(params.maxLengthMm !== undefined ? { lte: new Prisma.Decimal(params.maxLengthMm) } : {}),
    };
  }

  let usedFallback = false;
  let orderedIds: string[] | null = null;
  if (params.q?.trim()) {
    const result = await fullTextProductIds(params.q, 500);
    usedFallback = result.usedFallback;
    orderedIds = result.ids;
    if (orderedIds.length === 0) {
      return { products: [], total: 0, page, pageSize, usedFallback };
    }
    where.id = { in: orderedIds };
  }

  const orderBy = ((): Prisma.ProductOrderByWithRelationInput => {
    switch (params.sort) {
      case "price-asc":
        return { msrpCents: "asc" };
      case "price-desc":
        return { msrpCents: "desc" };
      case "weight-asc":
        return { weightGrams: "asc" };
      case "name-asc":
        return { productName: "asc" };
      case "newest":
        return { createdAt: "desc" };
      default:
        return { productName: "asc" };
    }
  })();

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Preserve relevance order when the query drove the result set.
  let products = rows;
  if (orderedIds && (params.sort ?? "relevance") === "relevance") {
    const rank = new Map(orderedIds.map((id, index) => [id, index]));
    products = [...rows].sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
    );
  }

  return { products, total, page, pageSize, usedFallback };
}

export async function getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  return prisma.product.findFirst({ where: { slug }, include: productInclude });
}

export async function getProductById(id: string): Promise<ProductWithRelations | null> {
  return prisma.product.findUnique({ where: { id }, include: productInclude });
}

export async function getProductsByIds(ids: string[]): Promise<ProductWithRelations[]> {
  if (ids.length === 0) return [];
  return prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
}
