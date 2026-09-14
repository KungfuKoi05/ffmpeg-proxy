import Link from "next/link";
import type { Metadata } from "next";
import { categoryList, toolsInCategory, LIVE_TOOLS } from "@/lib/tools/registry";
import { SITE, canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: canonical("/") },
};

export default function HomePage() {
  const categories = categoryList();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <section className="max-w-2xl">
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">
          Free tools for files, PDFs, images, text, business and more.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink-2)]">
          {LIVE_TOOLS.length} utilities that do one thing quickly. No signup, no
          upload, no watermark on the way out.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/tools"
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-[var(--accent-ink)]">
            Choose a tool
          </Link>
          <Link href="/word-counter"
            className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-[14px] font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)]">
            Try the word counter
          </Link>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold">Your files stay on your device</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--ink-2)]">
          Every tool here runs in your browser. Nothing you paste, open or convert is
          sent to a server — so there is no upload to wait for, no queue, and no copy
          of your document sitting on someone else&apos;s disk. Load a page once and it
          keeps working offline.
        </p>
      </section>

      {categories.map((c) => {
        const tools = toolsInCategory(c.id);
        return (
          <section key={c.id} className="mt-10">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[18px] font-semibold tracking-tight">{c.name}</h2>
              <Link href={`/tools/${c.slug}`} className="text-[13px] text-[var(--accent-ink)] hover:underline">
                All {tools.length}
              </Link>
            </div>
            <p className="mt-1 text-[14px] text-[var(--ink-2)]">{c.blurb}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((t) => (
                <Link key={t.slug} href={`/${t.slug}`}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--accent)]">
                  <div className="text-[14px] font-medium">{t.name}</div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-3)]">{t.tagline}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
