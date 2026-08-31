import { apiRoute } from "@/lib/api/handler";
import { created, apiError } from "@/lib/api/response";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { writeAuditLog, requestIp } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().trim().max(80).optional(),
});

/** POST /api/auth/sign-up */
export const POST = apiRoute(
  async (request) => {
    const body = schema.parse(await request.json());
    const policy = checkPasswordPolicy(body.password);
    if (!policy.ok) {
      return apiError("WEAK_PASSWORD", policy.problems.join(" "), 422);
    }
    const email = body.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      return apiError("EMAIL_TAKEN", "An account already exists for this email.", 409);
    }
    const user = await prisma.user.create({
      data: { email, name: body.name ?? null, passwordHash: await hashPassword(body.password) },
    });
    await startSession(user.id);
    await writeAuditLog({
      actorId: user.id,
      action: "user.sign_up.api",
      entityType: "User",
      entityId: user.id,
      ip: requestIp(request),
    });
    return created({ user: { id: user.id, email: user.email } });
  },
  { limit: { scope: "auth-sign-up", limit: 10, windowMs: 60 * 60_000 } },
);
