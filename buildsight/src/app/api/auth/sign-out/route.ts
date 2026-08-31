import { apiRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { endSession } from "@/lib/auth/session";

export const POST = apiRoute(async () => {
  await endSession();
  return ok({ signedOut: true });
});
