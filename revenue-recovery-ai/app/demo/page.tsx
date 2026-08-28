import Link from "next/link";
import { buildDemoOverview, DEMO_ACTIONS, DEMO_TRANSCRIPT } from "@/lib/demo/data";
import { Overview } from "@/components/overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Demo — Revenue Recovery AI" };

/** Public demo. Works with no API keys and no database (section 33). */
export default function DemoPage() {
  const data = buildDemoOverview();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-amber-100 px-6 py-2 text-center text-sm text-amber-900">
        <strong>Demo data.</strong> Every figure on this page is simulated for
        demonstration. No real customer data is shown.
      </div>

      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-sm font-semibold">Revenue Recovery AI — Demo</span>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Start recovering revenue
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <Overview data={data} demo />

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>A real conversation, after hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DEMO_TRANSCRIPT.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.speaker === "AI"
                      ? "ml-8 rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-800"
                      : "mr-8 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800"
                  }
                >
                  <div className="text-xs font-medium text-slate-500">{line.speaker}</div>
                  {line.text}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What the system did</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {DEMO_ACTIONS.map((action, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Badge tone="info">{action.agent}</Badge>
                    <div>
                      <div className="font-medium text-slate-900">{action.action}</div>
                      <div className="text-xs text-slate-500">{action.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Every action is logged and inspectable. The assistant quoted no
                price and offered only real, conflict-checked appointment slots.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
