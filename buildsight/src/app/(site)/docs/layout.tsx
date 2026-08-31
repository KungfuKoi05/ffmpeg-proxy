import Link from "next/link";

const SECTIONS = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/methodology", label: "Methodology" },
  { href: "/docs/verification", label: "Verification levels" },
  { href: "/docs/policy", label: "Product boundary" },
  { href: "/docs/api", label: "API" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside>
        <p className="label-micro">Documentation</p>
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
      <article className="prose-invert max-w-none">{children}</article>
    </div>
  );
}
