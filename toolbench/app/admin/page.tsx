import type { Metadata } from "next";
import { snapshot } from "@/lib/storage";
import { LIVE_TOOLS, categoryList } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Operations dashboard.
 *
 * Protected by middleware.ts (HTTP Basic against ADMIN_PASSWORD), which fails
 * closed with a 503 when that variable is unset. Shows aggregate counts only --
 * never user content, which does not exist here in the first place.
 */
export default async function AdminPage() {
  const snap = await snapshot();
  const uptimeHours = (Date.now() - snap.since) / 3_600_000;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Operations</h1>
      <p className="mt-1 text-[14px] text-[var(--ink-2)]">
        Storage backend: <strong>{snap.backend}</strong>
        {snap.backend === "memory"
          ? " — counts reset when the server restarts. Set DATABASE_URL for persistence."
          : ""}
        {" · "}window {uptimeHours < 1 ? "under an hour" : `${uptimeHours.toFixed(1)}h`}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Events" value={snap.totalEvents.toLocaleString()} />
        <Card label="Page views" value={snap.pageViews.toLocaleString()} />
        <Card label="Sessions" value={snap.uniqueSessions.toLocaleString()} />
        <Card label="Tools live" value={String(LIVE_TOOLS.length)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-[16px] font-semibold">Tool performance</h2>
        {snap.tools.length === 0 ? (
          <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-[14px] text-[var(--ink-3)]">
            No usage recorded yet. Open a tool and the counts appear here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead className="border-b border-[var(--line-2)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                <tr>
                  <th className="px-4 py-2.5">Tool</th>
                  <th className="px-4 py-2.5 text-right">Views</th>
                  <th className="px-4 py-2.5 text-right">Uses</th>
                  <th className="px-4 py-2.5 text-right">Use rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-2)]">
                {snap.tools.map((t) => (
                  <tr key={t.tool}>
                    <td className="px-4 py-2">{t.tool}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.views}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.uses}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {t.views ? `${Math.round((t.uses / t.views) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <List title="Top pages" rows={snap.topPaths.map((p) => [p.path, p.count])} empty="No page views yet." />
        <List title="Top referrers" rows={snap.topReferrers.map((r) => [r.referrer, r.count])} empty="No referrers yet — all traffic is direct." />
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-[16px] font-semibold">Catalogue</h2>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13.5px] text-[var(--ink-2)]">
          {categoryList().map((c) => (
            <div key={c.id} className="flex justify-between border-b border-[var(--line-2)] py-1.5 last:border-0">
              <span>{c.name}</span>
              <span className="tabular-nums">
                {LIVE_TOOLS.filter((t) => t.category === c.id).length} tools
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function List({ title, rows, empty }: { title: string; rows: [string, number][]; empty: string }) {
  return (
    <section>
      <h2 className="mb-2 text-[16px] font-semibold">{title}</h2>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13.5px]">
        {rows.length === 0 ? <p className="text-[var(--ink-3)]">{empty}</p> : rows.map(([k, n]) => (
          <div key={k} className="flex justify-between border-b border-[var(--line-2)] py-1.5 last:border-0">
            <span className="truncate pr-3 text-[var(--ink-2)]">{k}</span>
            <span className="tabular-nums">{n}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
