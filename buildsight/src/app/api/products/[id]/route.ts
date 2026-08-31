import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { ok, NotFoundError } from "@/lib/api/response";
import { getProductById, getProductBySlug } from "@/server/products";
import { serializeProduct } from "@/server/serializers";

/** GET /api/products/:id — accepts either a product id or its slug. */
export const GET = apiRoute(async (_request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  const product = (await getProductById(id)) ?? (await getProductBySlug(id));
  if (!product) throw new NotFoundError("Product not found.");
  return ok({ product: serializeProduct(product) });
});
