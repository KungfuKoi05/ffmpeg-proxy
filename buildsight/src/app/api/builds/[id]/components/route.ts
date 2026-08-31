import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { buildComponentSchema } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/session";
import { addComponent, summarizeBuildRecord } from "@/server/builds";

/** POST /api/builds/:id/components — add or replace a component in a slot. */
export const POST = apiRoute(async (request, context: RouteContext<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = buildComponentSchema.parse(await request.json());
  const build = await addComponent(id, user.id, body);
  return ok({
    components: build.components.map((component) => ({
      id: component.id,
      slotKey: component.slotKey,
      productId: component.productId,
      quantity: component.quantity,
    })),
    summary: await summarizeBuildRecord(build),
  });
});
