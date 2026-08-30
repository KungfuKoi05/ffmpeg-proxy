import Link from "next/link";
import { LIVE_TOOLS } from "@/lib/tools/registry";

export default function NotFound() {
  const suggestions = LIVE_TOOLS.slice(0, 6);
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight">That page doesn&apos;t exist</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">
        The tool may have been renamed, or the link may be wrong.
      </p>
      <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
        {suggestions.map((t) => (
          <Link key={t.slug} href={`/${t.slug}`}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]">
            <div className="text-[14px] font-medium">{t.name}</div>
            <div className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">{t.tagline}</div>
          </Link>
        ))}
      </div>
      <Link href="/tools" className="mt-6 inline-block text-[14px] text-[var(--accent-ink)] underline">
        Browse all tools
      </Link>
    </div>
  );
}
