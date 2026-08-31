import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/manufacturers", label: "Manufacturers" },
  { href: "/admin/rules", label: "Compatibility rules" },
  { href: "/admin/imports", label: "Ingestion" },
  { href: "/admin/quality", label: "Data quality" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Admin is a separate role, checked again in every action and API route.
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-6 py-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside>
          <div className="flex items-center gap-2">
            <span className="label-micro">Admin</span>
            <Badge tone="accent">{user.email}</Badge>
          </div>
          <nav className="mt-3 space-y-1">
            {SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="block rounded px-2 py-1.5 text-xs text-ink-muted hover:bg-elevated hover:text-ink"
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
