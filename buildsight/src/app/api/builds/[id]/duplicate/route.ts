import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { created, apiError } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/session";
import { assertBuildQuota, duplicateBuild } from "@/server/builds";
import { PlanLimitError } from "@/lib/plans";
import { writeAuditLog, requestIp } from "@/lib/audit";

/** POST /api/builds/:id/duplicate */
export const POST = apiRoute(async (request, context: RouteContext<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await context.params;
  try {
    await assertBuildQuota(user.id, user.plan);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return apiError("PLAN_LIMIT", error.message, error.status, { limit: error.limit });
    }
    throw error;
  }
  const build = await duplicateBuild(id, user.id);
  await writeAuditLog({
    actorId: user.id,
    action: "build.duplicate",
    entityType: "Build",
    entityId: build.id,
    after: { sourceBuildId: id },
    ip: requestIp(request),
  });
  return created({ build: { id: build.id, name: build.name } });
});
