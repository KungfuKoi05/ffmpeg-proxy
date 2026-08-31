import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog/vocabulary";
import { SLOTS } from "@/lib/assembly/slots";

/** GET /api/categories — category tree plus the assembly slot it maps to. */
export const GET = apiRoute(async () => {
  const counts = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { publishState: "PUBLISHED" },
    _count: { _all: true },
  });
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));
  const slotByCategory = new Map(SLOTS.map((slot) => [slot.categorySlug, slot.key]));

  return ok({
    categories: categories.map((category) => {
      const definition = CATEGORIES.find((c) => c.slug === category.slug);
      return {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        parentId: category.parentId,
        sortOrder: category.sortOrder,
        productCount: countById.get(category.id) ?? 0,
        slotKey: slotByCategory.get(category.slug) ?? null,
        maxPerBuild: definition?.maxPerBuild ?? 1,
      };
    }),
  });
});
