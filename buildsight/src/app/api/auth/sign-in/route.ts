import { apiRoute } from "@/lib/api/handler";
import { ok, apiError } from "@/lib/api/response";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { writeAuditLog, requestIp } from "@/lib/audit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

/** POST /api/auth/sign-in — programmatic sign-in for tooling and tests. */
export const POST = apiRoute(
  async (request) => {
    const body = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      return apiError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }
    await startSession(user.id);
    await writeAuditLog({
      actorId: user.id,
      action: "user.sign_in.api",
      entityType: "User",
      entityId: user.id,
      ip: requestIp(request),
    });
    return ok({ user: { id: user.id, email: user.email, role: user.role, plan: user.plan } });
  },
  { limit: { scope: "auth-sign-in", limit: 20, windowMs: 15 * 60_000 } },
);
