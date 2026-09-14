import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, categoryList, toolsInCategory, type CategoryId } from "@/lib/tools/registry";
import { canonical } from "@/lib/site";

export function generateStaticParams() {
  return categoryList().map((c) => ({ category: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> },
): Promise<Metadata> {
  const { category } = await params;
  const c = CATEGORIES[category as CategoryId];
  if (!c) return { title: "Not found" };
  const count = toolsInCategory(c.id).length;
  return {
    title: c.name,
    description: `${count} free ${c.name.toLowerCase()} that run in your browser. ${c.blurb}`,
    alternates: { canonical: canonical(`/tools/${c.slug}`) },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = CATEGORIES[category as CategoryId];
  if (!c) notFound();
  const tools = toolsInCategory(c.id);
  if (!tools.length) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-[var(--ink-3)]">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/tools" className="hover:underline">Tools</Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--ink-2)]">{c.name}</span>
      </nav>

      <h1 className="text-[28px] font-semibold tracking-tight">{c.name}</h1>
      <p className="mt-1.5 text-[15px] text-[var(--ink-2)]">{c.blurb}</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.slug} href={`/${t.slug}`}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]">
            <div className="text-[14px] font-medium">{t.name}</div>
            <div className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">{t.tagline}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-[15px] font-semibold">Other categories</h2>
        <div className="flex flex-wrap gap-2">
          {categoryList().filter((x) => x.id !== c.id).map((x) => (
            <Link key={x.id} href={`/tools/${x.slug}`}
              className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--ink-2)] hover:border-[var(--accent)]">
              {x.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
