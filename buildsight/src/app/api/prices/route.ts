import { apiRoute, searchParams, numberParam } from "@/lib/api/handler";
import { ok, apiError } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { entitlements } from "@/lib/plans";
import { summarizePriceHistory } from "@/lib/pricing/history";

/**
 * GET /api/prices?productId=…&days=90 — observed price history.
 *
 * The visible window is capped by the caller's plan; the cap is applied here
 * rather than in the UI so the entitlement cannot be bypassed.
 */
export const GET = apiRoute(async (request) => {
  const params = searchParams(request);
  const productId = params.get("productId");
  if (!productId) return apiError("VALIDATION_FAILED", "productId is required.", 422);

  const user = await getCurrentUser();
  const maxDays = user ? entitlements(user.plan).priceHistoryDays : 30;
  const days = Math.min(numberParam(params, "days") ?? 90, maxDays);
  const since = new Date(Date.now() - days * 86_400_000);

  const [history, current] = await Promise.all([
    prisma.price.findMany({
      where: { productId, observedAt: { gte: since } },
      orderBy: { observedAt: "asc" },
      include: { retailer: { select: { name: true, slug: true } } },
    }),
    prisma.price.findMany({
      where: { productId, isCurrent: true },
      include: { retailer: { select: { name: true, slug: true } } },
      orderBy: { amountCents: "asc" },
    }),
  ]);

  const points = history.map((price) => ({
    observedAt: price.observedAt.toISOString(),
    amountCents: price.salePriceCents ?? price.amountCents,
    retailer: price.retailer?.name ?? null,
  }));

  return ok({
    productId,
    windowDays: days,
    windowCappedByPlan: days < 90 && (!user || entitlements(user.plan).priceHistoryDays < 90),
    history: points,
    current: current.map((price) => ({
      retailer: price.retailer?.name ?? null,
      retailerSlug: price.retailer?.slug ?? null,
      amountCents: price.amountCents,
      salePriceCents: price.salePriceCents,
      availability: price.availability,
      productUrl: price.productUrl,
      checkedAt: price.checkedAt.toISOString(),
    })),
    statistics: summarizePriceHistory(points),
  });
});
