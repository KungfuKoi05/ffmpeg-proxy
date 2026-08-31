import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink">BuildSight</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
            A configuration, visualization, compatibility and purchasing-planning platform for
            commercially available firearm components.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { href: "/studio", label: "Build Studio" },
            { href: "/catalog", label: "Catalog" },
            { href: "/compare", label: "Compare" },
            { href: "/pricing", label: "Pricing" },
          ]}
        />
        <FooterColumn
          title="Documentation"
          links={[
            { href: "/docs", label: "Overview" },
            { href: "/docs/methodology", label: "Methodology" },
            { href: "/docs/verification", label: "Verification levels" },
            { href: "/docs/policy", label: "Product boundary" },
          ]}
        />
        <div>
          <p className="label-micro">Data notice</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            The bundled catalog is synthetic demonstration data, labelled DEMO. BuildSight does not
            fabricate manufacturer specifications; missing values are shown as
            &ldquo;Not provided by manufacturer.&rdquo;
          </p>
        </div>
      </div>
      <div className="border-t border-line px-6 py-4">
        <p className="text-center text-[11px] text-ink-faint">
          BuildSight does not provide manufacturing, machining, conversion, safety-defeat or
          ammunition-loading information, and does not automate the purchase of regulated products.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="label-micro">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-xs text-ink-muted hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
