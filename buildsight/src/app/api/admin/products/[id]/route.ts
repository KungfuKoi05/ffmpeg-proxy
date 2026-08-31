import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { ok, apiError, NotFoundError } from "@/lib/api/response";
import { adminProductSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { refreshDerivedProductFields } from "@/server/admin";
import { writeAuditLog, requestIp } from "@/lib/audit";

/** PUT /api/admin/products/:id — update a catalog product. */
export const PUT = apiRoute(async (request, context: RouteContext<{ id: string }>) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Product not found.");

  const data = adminProductSchema.parse(await request.json());
  if (data.publishState === "PUBLISHED" && !data.sourceUrl) {
    return apiError(
      "SOURCE_REQUIRED",
      "A source URL is required before a record can be published.",
      422,
    );
  }

  const category = await prisma.category.findUnique({ where: { slug: data.categorySlug } });
  if (!category) return apiError("UNKNOWN_CATEGORY", "Unknown category slug.", 422);

  const { categorySlug: _categorySlug, lastVerified, ...rest } = data;
  await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      categoryId: category.id,
      lastVerified: lastVerified ? new Date(lastVerified) : null,
    },
  });

  await refreshDerivedProductFields(id);
  await writeAuditLog({
    actorId: admin.id,
    action: "admin.product.update.api",
    entityType: "Product",
    entityId: id,
    before: { productName: before.productName, publishState: before.publishState },
    after: { productName: data.productName, publishState: data.publishState },
    ip: requestIp(request),
  });

  return ok({ product: { id } });
});
