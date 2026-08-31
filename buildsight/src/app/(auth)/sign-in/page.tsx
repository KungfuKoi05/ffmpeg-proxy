import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <AuthForm mode="sign-in" action={signInAction} />
      <p className="mt-4 text-center text-[11px] text-ink-faint">
        Demo account: demo@buildsight.local / demo123456
      </p>
    </>
  );
}
