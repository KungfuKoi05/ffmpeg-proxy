"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { startSession, endSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/api/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().max(80).optional(),
});

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "local"
  );
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  if (!rateLimit(`sign-up:${ip}`, 10, 60 * 60 * 1000).ok) {
    return { error: "Too many sign-up attempts from this address. Try again later." };
  }

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const policy = checkPasswordPolicy(parsed.data.password);
  if (!policy.ok) return { fieldErrors: { password: policy.problems } };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: ["An account already exists for this email."] } };
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "user.sign_up",
    entityType: "User",
    entityId: user.id,
    ip,
  });
  await startSession(user.id);
  redirect("/dashboard");
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  if (!rateLimit(`sign-in:${ip}`, 20, 15 * 60 * 1000).ok) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same message and comparable timing whether the account exists or not.
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    return { error: "Email or password is incorrect." };
  }

  await writeAuditLog({
    actorId: user.id,
    action: "user.sign_in",
    entityType: "User",
    entityId: user.id,
    ip,
  });
  await startSession(user.id);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
