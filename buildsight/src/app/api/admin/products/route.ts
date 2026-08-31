import { apiRoute } from "@/lib/api/handler";
import { created, apiError } from "@/lib/api/response";
import { adminProductSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { refreshDerivedProductFields } from "@/server/admin";
import { writeAuditLog, requestIp } from "@/lib/audit";
import { classifyRequest } from "@/lib/policy/policy";
import { slugify } from "@/lib/utils";

/** POST /api/admin/products — create a catalog product. */
export const POST = apiRoute(async (request) => {
  const admin = await requireAdmin();
  const data = adminProductSchema.parse(await request.json());

  const policy = classifyRequest(`${data.productName} ${data.description ?? ""}`);
  if (!policy.allowed) {
    return apiError("POLICY_REJECTED", policy.message, 422, { category: policy.category });
  }
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
  const product = await prisma.product.create({
    data: {
      ...rest,
      slug: slugify(`${data.manufacturerPartNumber}-${data.productName}`),
      categoryId: category.id,
      lastVerified: lastVerified ? new Date(lastVerified) : null,
    },
  });

  await refreshDerivedProductFields(product.id);
  await writeAuditLog({
    actorId: admin.id,
    action: "admin.product.create.api",
    entityType: "Product",
    entityId: product.id,
    after: { productName: product.productName },
    ip: requestIp(request),
  });

  return created({ product: { id: product.id, slug: product.slug } });
});
