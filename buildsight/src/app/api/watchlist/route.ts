import { apiRoute } from "@/lib/api/handler";
import { ok, created, apiError } from "@/lib/api/response";
import { watchlistSchema } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { entitlements } from "@/lib/plans";
import { productInclude } from "@/server/products";
import { serializeProduct } from "@/server/serializers";

/** GET /api/watchlist */
export const GET = apiRoute(async () => {
  const user = await requireUser();
  const items = await prisma.watchlistItem.findMany({
    where: { ownerId: user.id },
    include: { product: { include: productInclude } },
    orderBy: { createdAt: "desc" },
  });

  return ok({
    items: items.map((item) => ({
      id: item.id,
      targetPriceCents: item.targetPriceCents,
      lastSeenPriceCents: item.lastSeenPriceCents,
      notifyByEmail: item.notifyByEmail,
      notifyInApp: item.notifyInApp,
      createdAt: item.createdAt.toISOString(),
      product: serializeProduct(item.product),
    })),
  });
});

/** POST /api/watchlist — watch a product for price movement. */
export const POST = apiRoute(async (request) => {
  const user = await requireUser();
  const body = watchlistSchema.parse(await request.json());

  const limit = entitlements(user.plan).maxWatchlistItems;
  if (limit !== null) {
    const count = await prisma.watchlistItem.count({ where: { ownerId: user.id } });
    const alreadyWatched = await prisma.watchlistItem.findUnique({
      where: { ownerId_productId: { ownerId: user.id, productId: body.productId } },
    });
    if (!alreadyWatched && count >= limit) {
      return apiError(
        "PLAN_LIMIT",
        `Your plan includes ${limit} watchlist items. Remove one or upgrade to watch more.`,
        402,
        { limit: "maxWatchlistItems" },
      );
    }
  }

  const currentPrice = await prisma.price.findFirst({
    where: { productId: body.productId, isCurrent: true },
    orderBy: { amountCents: "asc" },
  });

  const item = await prisma.watchlistItem.upsert({
    where: { ownerId_productId: { ownerId: user.id, productId: body.productId } },
    create: {
      ownerId: user.id,
      productId: body.productId,
      targetPriceCents: body.targetPriceCents ?? null,
      lastSeenPriceCents: currentPrice
        ? (currentPrice.salePriceCents ?? currentPrice.amountCents)
        : null,
      notifyByEmail: body.notifyByEmail ?? true,
      notifyInApp: body.notifyInApp ?? true,
    },
    update: {
      targetPriceCents: body.targetPriceCents ?? null,
      notifyByEmail: body.notifyByEmail ?? true,
      notifyInApp: body.notifyInApp ?? true,
    },
  });

  return created({ item: { id: item.id, productId: item.productId } });
});
