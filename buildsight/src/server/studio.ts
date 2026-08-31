import { prisma } from "@/lib/db";
import { searchProducts } from "@/server/products";
import { serializeProduct, type SerializedProduct } from "@/server/serializers";
import { loadActiveRules } from "@/server/rules";
import { SLOTS } from "@/lib/assembly/slots";
import type { LibraryCategory } from "@/components/studio/component-library";
import type { CompatibilityRuleInput } from "@/lib/types";

export interface StudioData {
  catalog: SerializedProduct[];
  categories: LibraryCategory[];
  rules: CompatibilityRuleInput[];
}

/**
 * Everything the studio needs to run its local recomputation loop: an initial
 * catalog page, the category list and the full active rule set. The rule set is
 * small by design (tens of rows), so shipping it to the client lets the studio
 * re-evaluate compatibility instantly on every swap.
 */
export async function loadStudioData(): Promise<StudioData> {
  const slotCategories = new Set(SLOTS.map((slot) => slot.categorySlug));

  const [catalog, categories, rules, counts] = await Promise.all([
    searchProducts({ pageSize: 60, sort: "name-asc" }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    loadActiveRules(),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { publishState: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));

  return {
    catalog: catalog.products.map(serializeProduct),
    categories: categories
      .filter((category) => slotCategories.has(category.slug))
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        productCount: countById.get(category.id) ?? 0,
      })),
    rules,
  };
}
