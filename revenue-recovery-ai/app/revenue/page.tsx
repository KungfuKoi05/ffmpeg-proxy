import { requireBusiness } from "@/lib/auth/session";
import { getOverview } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/trend-chart";
import { formatCurrency, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const ctx = await requireBusiness();
  const data = await getOverview(ctx.business.id);
  const m = data.metrics;

  return (
    <DashboardShell businessName={ctx.business.name} active="/revenue">
      <h1 className="text-lg font-semibold tracking-tight">Revenue</h1>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Estimated is not earned.</strong> Estimated revenue projects your
        configured average job values onto booked leads. Actual revenue counts
        only figures your team has entered on a lead.
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Estimated (booked leads)"
          value={formatCurrency(m.estimatedRevenue)}
          emphasis
        />
        <Stat label="Actual (entered by your team)" value={formatCurrency(m.actualRevenue)} />
        <Stat label="Conversion rate" value={formatPercent(m.conversionRate)} />
      </div>

      <Card className="mt-4">
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
    </DashboardShell>
  );
}
