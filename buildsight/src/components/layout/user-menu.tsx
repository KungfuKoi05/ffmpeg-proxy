"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/misc";

export function UserMenu({
  email,
  name,
  plan,
}: {
  email: string;
  name: string | null;
  plan: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const initials = (name ?? email).slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded border border-line bg-elevated font-mono text-xs text-ink transition-colors hover:border-line-strong"
      >
        {initials}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-60 rounded-panel border border-line bg-surface p-2 shadow-xl"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-xs font-medium text-ink">{name ?? "Account"}</p>
            <p className="truncate font-mono text-[11px] text-ink-faint">{email}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-accent">
              {plan.replace("_", "+")} plan
            </p>
          </div>
          <Separator className="my-1.5" />
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/builds", label: "My builds" },
            { href: "/watchlist", label: "Watchlist" },
            { href: "/account", label: "Account & billing" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded px-2 py-1.5 text-xs text-ink-muted hover:bg-elevated hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <Separator className="my-1.5" />
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
