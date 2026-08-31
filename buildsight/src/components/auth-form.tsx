"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthFormState } from "@/server/actions/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  action,
}: {
  mode: "sign-in" | "sign-up";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction] = useActionState(action, {} as AuthFormState);
  const isSignUp = mode === "sign-up";

  return (
    <Card>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-1 text-xs text-ink-muted">
          {isSignUp
            ? "Saved builds, watchlists and exports are tied to your account."
            : "Welcome back. Your configurations are where you left them."}
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          {isSignUp ? (
            <div>
              <Label htmlFor="name">Name (optional)</Label>
              <Input id="name" name="name" autoComplete="name" maxLength={80} />
            </div>
          ) : null}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            <FieldError messages={state.fieldErrors?.email} />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
            />
            <FieldError messages={state.fieldErrors?.password} />
            {isSignUp ? (
              <p className="mt-1.5 text-[11px] text-ink-faint">
                At least 10 characters, including a letter and a number.
              </p>
            ) : null}
          </div>

          {state.error ? (
            <p className="rounded border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-xs text-signal-red">
              {state.error}
            </p>
          ) : null}

          <SubmitButton label={isSignUp ? "Create account" : "Sign in"} />
        </form>

        <p className="mt-4 text-center text-xs text-ink-muted">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link href="/sign-in" className="text-accent hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{" "}
              <Link href="/sign-up" className="text-accent hover:underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {messages.map((message) => (
        <li key={message} className="text-[11px] text-signal-red">
          {message}
        </li>
      ))}
    </ul>
  );
}
