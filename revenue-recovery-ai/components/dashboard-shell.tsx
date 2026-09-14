import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/conversations", label: "Conversations" },
  { href: "/calls", label: "Calls" },
  { href: "/appointments", label: "Appointments" },
  { href: "/revenue", label: "Revenue" },
  { href: "/prospects", label: "Prospects" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
];

export function DashboardShell({
  businessName,
  active,
  banner,
  children,
}: {
  businessName: string;
  active: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight">Revenue Recovery AI</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-600">{businessName}</span>
          </div>
          <Link href="/api/auth/signout" className="text-sm text-slate-500 hover:text-slate-900">
            Sign out
          </Link>
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-6">
          <ul className="flex gap-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block whitespace-nowrap border-b-2 px-3 py-2",
                    active === item.href
                      ? "border-brand-600 font-medium text-brand-700"
                      : "border-transparent text-slate-600 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {banner}
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
