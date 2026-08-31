import { apiRoute, searchParams } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { searchProducts } from "@/server/products";
import { serializeProduct } from "@/server/serializers";

/**
 * GET /api/search?q=… — unified search across products and manufacturers.
 * Used by the Build Studio component picker and the global search field.
 */
export const GET = apiRoute(async (request) => {
  const params = searchParams(request);
  const q = (params.get("q") ?? "").trim();
  const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 50);
  const categorySlug = params.get("category") ?? undefined;

  if (!q && !categorySlug) {
    return ok({ query: q, products: [], manufacturers: [], total: 0 });
  }

  const [result, manufacturers] = await Promise.all([
    searchProducts({ q: q || undefined, categorySlug, pageSize: limit }),
    q
      ? prisma.manufacturer.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          take: 5,
          select: { id: true, slug: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return ok({
    query: q,
    total: result.total,
    products: result.products.map(serializeProduct),
    manufacturers,
    matching: { usedSubstringFallback: result.usedFallback },
  });
});
