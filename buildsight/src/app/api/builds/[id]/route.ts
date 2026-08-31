import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { ok, noContent } from "@/lib/api/response";
import { updateBuildSchema } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getBuildForUser, getOwnedBuild, summarizeBuildRecord } from "@/server/builds";
import { writeAuditLog, requestIp } from "@/lib/audit";

type Context = RouteContext<{ id: string }>;

/** GET /api/builds/:id — configuration with its recomputed summary. */
export const GET = apiRoute(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const build = await getBuildForUser(id, user.id);
  return ok({
    build: {
      id: build.id,
      name: build.name,
      description: build.description,
      platform: build.platform,
      caliber: build.caliber,
      isArchived: build.isArchived,
      isPublic: build.isPublic,
      updatedAt: build.updatedAt.toISOString(),
      components: build.components.map((component) => ({
        id: component.id,
        slotKey: component.slotKey,
        quantity: component.quantity,
        productId: component.productId,
      })),
    },
    summary: await summarizeBuildRecord(build),
  });
});

/** PUT /api/builds/:id — rename, describe, archive or publish. */
export const PUT = apiRoute(async (request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const existing = await getOwnedBuild(id, user.id);
  const body = updateBuildSchema.parse(await request.json());

  const build = await prisma.build.update({ where: { id }, data: body });
  await writeAuditLog({
    actorId: user.id,
    action: "build.update",
    entityType: "Build",
    entityId: id,
    before: { name: existing.name, isArchived: existing.isArchived },
    after: body,
    ip: requestIp(request),
  });

  return ok({ build: { id: build.id, name: build.name, isArchived: build.isArchived } });
});

/** DELETE /api/builds/:id */
export const DELETE = apiRoute(async (request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  await getOwnedBuild(id, user.id);
  await prisma.build.delete({ where: { id } });
  await writeAuditLog({
    actorId: user.id,
    action: "build.delete",
    entityType: "Build",
    entityId: id,
    ip: requestIp(request),
  });
  return noContent();
});
