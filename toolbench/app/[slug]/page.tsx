import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, LIVE_TOOLS, getTool, relatedTools } from "@/lib/tools/registry";
import { ToolPageClient } from "@/components/tool-page-client";
import { SITE, canonical } from "@/lib/site";

/** Every tool page is statically generated -- fast, and free to serve. */
export function generateStaticParams() {
  return LIVE_TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Not found" };

  const url = canonical(`/${tool.slug}`);
  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: tool.metaTitle,
      description: tool.metaDescription,
      url,
      type: "website",
    },
    twitter: { title: tool.metaTitle, description: tool.metaDescription },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const category = CATEGORIES[tool.category];
  const related = relatedTools(tool, 4);
  const url = canonical(`/${tool.slug}`);

  // Structured data. FAQPage is genuine -- the questions are answered on the
  // page itself, which is what the schema is for.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: tool.h1,
        url,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        description: tool.metaDescription,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: canonical("/") },
          { "@type": "ListItem", position: 2, name: category.name, item: canonical(`/tools/${category.slug}`) },
          { "@type": "ListItem", position: 3, name: tool.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-4xl px-5 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-[var(--ink-3)]">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/tools/${category.slug}`} className="hover:underline">{category.name}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-[var(--ink-2)]">{tool.name}</span>
        </nav>

        <h1 className="text-[28px] font-semibold tracking-tight">{tool.h1}</h1>
        <p className="mt-1.5 text-[15px] text-[var(--ink-2)]">{tool.tagline}</p>

        {/* The tool itself, immediately. Never buried under copy. */}
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <ToolPageClient slug={tool.slug} />
        </div>

        <p className="mt-3 text-[13px] text-[var(--ink-3)]">
          Runs entirely in your browser — nothing you type or open is uploaded, so there is
          nothing for us to store or leak.
        </p>

        {related.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-[15px] font-semibold">Related tools</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.slug} href={`/${r.slug}`}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]">
                  <div className="text-[14px] font-medium">{r.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">{r.tagline}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="mb-3 text-[15px] font-semibold">Questions</h2>
          <dl className="space-y-4">
            {tool.faq.map((f) => (
              <div key={f.q}>
                <dt className="text-[14px] font-medium">{f.q}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="text-[15px] font-semibold">How your data is handled</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
            This tool never sends your content anywhere. The processing happens in
            JavaScript on your own device, which means there is no upload, no
            server-side copy, and no retention policy to trust — the data simply
            never leaves. You can disconnect from the internet after the page
            loads and it still works.
          </p>
          <p className="mt-2 text-[13px] text-[var(--ink-3)]">
            We count anonymous page and tool usage to know which tools to build
            next. Those counts never include what you typed or opened.{" "}
            <Link href="/privacy" className="underline">Full privacy note</Link>.
          </p>
        </section>

        <p className="mt-10 text-[13px] text-[var(--ink-3)]">
          Part of {SITE.name} — <Link href="/tools" className="underline">browse all tools</Link>.
        </p>
      </div>
    </>
  );
}
