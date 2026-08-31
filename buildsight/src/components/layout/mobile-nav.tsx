"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ITEMS = [
  { href: "/studio", label: "Build Studio" },
  { href: "/catalog", label: "Catalog" },
  { href: "/compare", label: "Compare" },
  { href: "/builds", label: "My Builds" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/docs", label: "Documentation" },
  { href: "/pricing", label: "Pricing" },
];

export function MobileNav({ isAdmin }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X /> : <Menu />}
      </Button>
      {open ? (
        <div className="fixed inset-x-0 top-14 z-50 border-b border-line bg-surface p-3 shadow-xl">
          <nav className="grid gap-1">
            {[...ITEMS, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 font-mono text-xs uppercase tracking-wider text-ink-muted hover:bg-elevated hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
