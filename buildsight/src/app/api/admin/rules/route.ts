import { apiRoute } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { adminRuleSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog, requestIp } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

/** GET /api/admin/rules — every rule, including inactive ones. */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const rules = await prisma.compatibilityRule.findMany({
    orderBy: [{ isActive: "desc" }, { priority: "asc" }],
  });
  return ok({ rules });
});

/** POST /api/admin/rules — author a compatibility rule. */
export const POST = apiRoute(async (request) => {
  const admin = await requireAdmin();
  const data = adminRuleSchema.parse(await request.json());

  const rule = await prisma.compatibilityRule.create({
    data: {
      ...data,
      parameters: (data.parameters ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "admin.rule.create.api",
    entityType: "CompatibilityRule",
    entityId: rule.id,
    after: { name: rule.name, kind: rule.kind, result: rule.result },
    ip: requestIp(request),
  });

  return created({ rule: { id: rule.id } });
});
