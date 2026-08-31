import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { noContent } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/** DELETE /api/watchlist/:productId */
export const DELETE = apiRoute(
  async (_request, context: RouteContext<{ productId: string }>) => {
    const user = await requireUser();
    const { productId } = await context.params;
    await prisma.watchlistItem.deleteMany({ where: { ownerId: user.id, productId } });
    return noContent();
  },
);
