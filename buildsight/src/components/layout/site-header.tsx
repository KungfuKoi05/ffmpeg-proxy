import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/studio", label: "Build Studio" },
  { href: "/catalog", label: "Catalog" },
  { href: "/compare", label: "Compare" },
  { href: "/builds", label: "My Builds" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/docs", label: "Documentation" },
];

export async function SiteHeader({ className }: { className?: string }) {
  const user = await getCurrentUser();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line bg-base/95 backdrop-blur supports-[backdrop-filter]:bg-base/80",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <BuildSightMark />
          <span className="font-mono text-sm font-semibold tracking-[0.18em] uppercase">
            BuildSight
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user?.role === "ADMIN" ? (
            <Link href="/admin" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Admin
              </Button>
            </Link>
          ) : null}
          {user ? (
            <UserMenu email={user.email} name={user.name} plan={user.plan} />
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="primary" size="sm">
                  Create account
                </Button>
              </Link>
            </>
          )}
          <MobileNav isAdmin={user?.role === "ADMIN"} />
        </div>
      </div>
    </header>
  );
}

export function BuildSightMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-5 text-accent", className)}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
