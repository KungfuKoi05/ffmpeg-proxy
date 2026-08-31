import { apiRoute, searchParams } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { productSearchSchema } from "@/lib/api/schemas";
import { searchProducts } from "@/server/products";
import { serializeProduct } from "@/server/serializers";

/** GET /api/products — filtered, paginated catalog search. */
export const GET = apiRoute(async (request) => {
  const params = searchParams(request);
  const query = productSearchSchema.parse(Object.fromEntries(params.entries()));

  const result = await searchProducts({
    q: query.q,
    categorySlug: query.category,
    manufacturerSlug: query.manufacturer,
    platform: query.platform,
    caliber: query.caliber,
    verificationStatus: query.verification,
    availability: query.availability,
    interfaceSlug: query.interface,
    minPriceCents: query.minPrice,
    maxPriceCents: query.maxPrice,
    maxWeightGrams: query.maxWeight,
    minLengthMm: query.minLength,
    maxLengthMm: query.maxLength,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  });

  return ok({
    products: result.products.map(serializeProduct),
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
    matching: { usedSubstringFallback: result.usedFallback },
  });
});
