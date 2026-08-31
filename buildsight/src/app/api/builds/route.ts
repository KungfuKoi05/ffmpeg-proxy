import { apiRoute } from "@/lib/api/handler";
import { ok, created, apiError } from "@/lib/api/response";
import { createBuildSchema } from "@/lib/api/schemas";
import { requireUser } from "@/lib/auth/session";
import { assertBuildQuota, createBuild, listBuilds, summarizeBuildRecord } from "@/server/builds";
import { PlanLimitError } from "@/lib/plans";
import { writeAuditLog, requestIp } from "@/lib/audit";

/** GET /api/builds — the signed-in user's configurations. */
export const GET = apiRoute(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const builds = await listBuilds(user.id, url.searchParams.get("archived") === "true");

  const summaries = await Promise.all(
    builds.map(async (build) => ({
      id: build.id,
      name: build.name,
      description: build.description,
      platform: build.platform,
      caliber: build.caliber,
      isArchived: build.isArchived,
      componentCount: build.components.length,
      updatedAt: build.updatedAt.toISOString(),
      createdAt: build.createdAt.toISOString(),
      summary: await summarizeBuildRecord(build),
    })),
  );

  return ok({ builds: summaries });
});

/** POST /api/builds — create a configuration. */
export const POST = apiRoute(async (request) => {
  const user = await requireUser();
  const body = createBuildSchema.parse(await request.json());

  try {
    await assertBuildQuota(user.id, user.plan);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return apiError("PLAN_LIMIT", error.message, error.status, { limit: error.limit });
    }
    throw error;
  }

  const build = await createBuild(user.id, body);
  await writeAuditLog({
    actorId: user.id,
    action: "build.create",
    entityType: "Build",
    entityId: build.id,
    after: { name: build.name, components: build.components.length },
    ip: requestIp(request),
  });

  return created({ build: { id: build.id, name: build.name } });
});
