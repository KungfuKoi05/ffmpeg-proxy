import { supabaseServer } from "../supabase/server";
import { AppError } from "../errors";
import type { Business, MemberRole } from "../types";

export interface SessionUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

/**
 * Resolves the caller from the session cookie. Never accepts a user id from
 * the request body -- that is the whole point of this function existing.
 */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("is_super_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    isSuperAdmin: Boolean(profile?.is_super_admin),
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isSuperAdmin) throw new AppError("FORBIDDEN", { need: "super_admin" });
  return user;
}

export interface TenantContext {
  user: SessionUser;
  business: Business;
  role: MemberRole;
}

/**
 * The tenant guard every customer-facing route must call.
 *
 * `businessId` may be absent, in which case the caller's first membership is
 * used. When it IS supplied (e.g. from a URL), membership is verified here --
 * a client-supplied id is a request, never an authorization.
 */
export async function requireBusiness(businessId?: string): Promise<TenantContext> {
  const user = await requireUser();
  const supabase = await supabaseServer();

  let query = supabase
    .from("business_members")
    .select("role, business_id, businesses(*)")
    .eq("user_id", user.id);

  if (businessId) query = query.eq("business_id", businessId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new AppError("INTERNAL", { step: "load_membership" }, error);
  if (!data) throw new AppError(businessId ? "TENANT_MISMATCH" : "NOT_FOUND");

  const business = (data as unknown as { businesses: Business }).businesses;
  if (!business) throw new AppError("NOT_FOUND", { businessId });

  return { user, business, role: data.role as MemberRole };
}

const RANK: Record<MemberRole, number> = { staff: 1, admin: 2, owner: 3 };

export function assertRole(ctx: TenantContext, minimum: MemberRole): void {
  if (ctx.user.isSuperAdmin) return;
  if (RANK[ctx.role] < RANK[minimum]) {
    throw new AppError("FORBIDDEN", { need: minimum, have: ctx.role });
  }
}
