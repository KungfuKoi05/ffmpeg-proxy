import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db";

/** GET /api/manufacturers — catalog manufacturers with published counts. */
export const GET = apiRoute(async () => {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: { where: { publishState: "PUBLISHED" } } } },
    },
  });

  return ok({
    manufacturers: manufacturers.map((manufacturer) => ({
      id: manufacturer.id,
      slug: manufacturer.slug,
      name: manufacturer.name,
      website: manufacturer.website,
      logoUrl: manufacturer.logoUrl,
      description: manufacturer.description,
      country: manufacturer.country,
      supportUrl: manufacturer.supportUrl,
      isDemo: manufacturer.isDemo,
      productCount: manufacturer._count.products,
    })),
  });
});
