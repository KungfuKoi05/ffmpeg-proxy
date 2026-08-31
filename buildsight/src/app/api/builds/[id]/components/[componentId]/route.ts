import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/session";
import { removeComponent, summarizeBuildRecord } from "@/server/builds";

/** DELETE /api/builds/:id/components/:componentId */
export const DELETE = apiRoute(
  async (_request, context: RouteContext<{ id: string; componentId: string }>) => {
    const user = await requireUser();
    const { id, componentId } = await context.params;
    const build = await removeComponent(id, user.id, componentId);
    return ok({
      components: build.components.map((component) => ({
        id: component.id,
        slotKey: component.slotKey,
        productId: component.productId,
        quantity: component.quantity,
      })),
      summary: await summarizeBuildRecord(build),
    });
  },
);
