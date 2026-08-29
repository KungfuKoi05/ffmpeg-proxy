import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE } from "@/lib/site";
import { categoryList, toolsInCategory } from "@/lib/tools/registry";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = categoryList();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to the tool
        </a>

        <header className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link href="/" className="text-[15px] font-semibold tracking-tight">
              {SITE.name}
            </Link>
            <nav aria-label="Categories" className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/tools/${c.slug}`}
                  className="text-[var(--ink-2)] hover:text-[var(--ink)]"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
            <Link
              href="/tools"
              className="ml-auto text-[13.5px] font-medium text-[var(--accent-ink)] hover:underline"
            >
              All tools
            </Link>
          </div>
        </header>

        <main id="main" className="flex-1">{children}</main>

        <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto max-w-5xl px-5 py-8 text-[13px] text-[var(--ink-2)]">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {categories.map((c) => (
                <div key={c.id}>
                  <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                    {c.name}
                  </h2>
                  <ul className="space-y-0.5">
                    {toolsInCategory(c.id).map((t) => (
                      <li key={t.slug}>
                        <Link href={`/${t.slug}`} className="hover:text-[var(--ink)] hover:underline">
                          {t.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-[var(--line-2)] pt-5">
              Every tool here runs in your browser. Files and text you use are never
              uploaded, so there is nothing for us to store, log or lose.
            </p>
            <p className="mt-2 text-[var(--ink-3)]">
              {SITE.name} · <Link href="/privacy" className="hover:underline">Privacy</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
