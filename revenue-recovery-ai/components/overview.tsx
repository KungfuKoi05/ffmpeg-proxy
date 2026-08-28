import Link from "next/link";
import { Stat } from "@/components/ui/stat";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/trend-chart";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils";
import type { OverviewData } from "@/lib/dashboard/queries";

/** Shared by /dashboard and /demo so the demo shows the real components. */
export function Overview({ data, demo }: { data: OverviewData; demo?: boolean }) {
  const m = data.metrics;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
          <span className="text-xs text-slate-500">Last 30 days</span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Revenue opportunity recovered"
            value={formatCurrency(m.estimatedRevenue)}
            hint="Estimated from booked leads — not money received"
            emphasis
          />
          <Stat
            label="Actual revenue recorded"
            value={formatCurrency(m.actualRevenue)}
            hint="Only values your team entered"
          />
          <Stat label="Missed calls" value={String(m.missedCalls)} />
          <Stat label="Leads recovered" value={String(m.leadsRecovered)} />
          <Stat label="Appointments" value={String(m.appointments)} />
          <Stat label="Conversion rate" value={formatPercent(m.conversionRate)} />
          <Stat label="AI conversations" value={String(m.aiConversations)} />
          <Stat label="Human escalations" value={String(m.humanEscalations)} />
          <Stat
            label="Average response"
            value={m.averageResponseSeconds === null ? "—" : `${Math.round(m.averageResponseSeconds)}s`}
            hint={m.averageResponseSeconds === null ? "Not enough data yet" : undefined}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads and appointments over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.series}
              series={[
                { key: "leads", label: "Leads", color: "#2563eb" },
                { key: "appointments", label: "Appointments", color: "#10b981" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estimated revenue over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.series}
              series={[{ key: "revenue", label: "Estimated", color: "#7c3aed" }]}
              currency
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentLeads.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No leads yet. They appear here the moment a call comes in.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone(lead.status)}>{lead.status}</Badge>
                        <span className="truncate text-sm font-medium text-slate-900">
                          {lead.name ?? lead.phone ?? "Unknown caller"}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {lead.service_requested ?? "Service not specified"} ·{" "}
                        {formatDateTime(lead.created_at)}
                      </div>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(lead.estimated_value))}
                      </div>
                      <div className="text-xs text-slate-500">estimated</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calls by outcome</CardTitle>
          </CardHeader>
          <CardContent>
            {data.callOutcomes.length === 0 ? (
              <p className="text-sm text-slate-500">No calls recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.callOutcomes.map((row) => (
                  <li key={row.outcome} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{row.outcome}</span>
                    <span className="font-semibold tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {!demo ? (
        <p className="text-xs text-slate-500">
          <Link href="/leads" className="text-brand-600 hover:underline">
            View all leads
          </Link>{" "}
          · Estimated figures are projections from your configured average job
          values. Actual revenue reflects only what your team has entered.
        </p>
      ) : null}
    </div>
  );
}
