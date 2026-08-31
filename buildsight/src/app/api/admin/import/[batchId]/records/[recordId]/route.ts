import { z } from "zod";
import { apiRoute, type RouteContext } from "@/lib/api/handler";
import { ok, NotFoundError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog, requestIp } from "@/lib/audit";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/import/:batchId/records/:recordId — record a review decision.
 *
 * Approval marks the record for publication as a draft product; it never
 * publishes to the public catalog on its own.
 */
export const POST = apiRoute(
  async (request, context: RouteContext<{ batchId: string; recordId: string }>) => {
    const admin = await requireAdmin();
    const { batchId, recordId } = await context.params;
    const body = schema.parse(await request.json());

    const record = await prisma.importRecord.findFirst({
      where: { id: recordId, batchId },
    });
    if (!record) throw new NotFoundError("Import record not found.");

    const updated = await prisma.importRecord.update({
      where: { id: record.id },
      data: {
        state: body.decision === "approve" ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewNote: body.note ?? null,
      },
    });

    await writeAuditLog({
      actorId: admin.id,
      action: `admin.import.${body.decision}.api`,
      entityType: "ImportRecord",
      entityId: record.id,
      ip: requestIp(request),
    });

    return ok({ record: { id: updated.id, state: updated.state } });
  },
);
