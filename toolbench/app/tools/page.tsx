import Link from "next/link";
import type { Metadata } from "next";
import { categoryList, toolsInCategory, LIVE_TOOLS } from "@/lib/tools/registry";
import { SITE, canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "All tools",
  description: `Browse every free utility on ${SITE.name} — text, developer and calculator tools that run entirely in your browser.`,
  alternates: { canonical: canonical("/tools") },
};

export default function ToolsDirectory() {
  const categories = categoryList();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-[28px] font-semibold tracking-tight">All tools</h1>
      <p className="mt-1.5 text-[15px] text-[var(--ink-2)]">
        {LIVE_TOOLS.length} tools across {categories.length} categories. All free, all
        in-browser.
      </p>

      {categories.map((c) => (
        <section key={c.id} className="mt-8">
          <h2 className="text-[17px] font-semibold tracking-tight">
            <Link href={`/tools/${c.slug}`} className="hover:underline">{c.name}</Link>
          </h2>
          <p className="mt-1 text-[13.5px] text-[var(--ink-2)]">{c.blurb}</p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {toolsInCategory(c.id).map((t) => (
              <li key={t.slug}>
                <Link href={`/${t.slug}`}
                  className="block rounded-lg px-3 py-2 hover:bg-[var(--surface-2)]">
                  <span className="text-[14px] font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-[12.5px] text-[var(--ink-3)]">{t.tagline}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
