import type { Metadata } from "next";
import { SITE, canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${SITE.name} handles your data: it doesn't. Every tool runs in your browser and nothing you process is uploaded.`,
  alternates: { canonical: canonical("/privacy") },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-[28px] font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">
        The short version: what you put into a tool never reaches us.
      </p>

      <section className="mt-8 space-y-3 text-[15px] leading-relaxed">
        <h2 className="text-[17px] font-semibold">What happens to your content</h2>
        <p>
          Every tool on this site runs as JavaScript inside your browser. The text
          you paste and the files you open are read by your own device and never
          transmitted. There is no upload step, no temporary server copy, and no
          retention window — the data has nowhere to go.
        </p>
        <p className="text-[var(--ink-2)]">
          You can verify this: open a tool, disconnect from the internet, and it
          still works.
        </p>

        <h2 className="pt-4 text-[17px] font-semibold">What we do count</h2>
        <p>
          We record anonymous usage so we know which tools matter and what to build
          next. An event looks like <em>&quot;someone used the word counter&quot;</em> — the tool
          name, the page, the referring site, and a random identifier that lives only
          in that browser tab and is gone when you close it.
        </p>
        <p className="text-[var(--ink-2)]">
          We do not set cookies, we do not use a third-party analytics service, we
          do not build a profile of you, and there is a filter in the code that
          strips any field that could carry your content into an event.
        </p>

        <h2 className="pt-4 text-[17px] font-semibold">What we never do</h2>
        <ul className="list-disc space-y-1 pl-5 text-[var(--ink-2)]">
          <li>Store your documents, text or images.</li>
          <li>Sell or share anything you process.</li>
          <li>Track you across other websites.</li>
          <li>Require an account to use a tool.</li>
        </ul>

        <h2 className="pt-4 text-[17px] font-semibold">If that changes</h2>
        <p className="text-[var(--ink-2)]">
          Some future tools may genuinely need a server — very large files, or
          formats no browser can handle. If we build one, that tool will say so
          plainly on its own page, before you use it, rather than hiding it here.
        </p>
      </section>
    </div>
  );
}
