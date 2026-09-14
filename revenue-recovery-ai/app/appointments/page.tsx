import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("start_time", { ascending: true })
    .limit(200);

  const appointments = (data ?? []) as Appointment[];
  const upcoming = appointments.filter((a) => new Date(a.start_time) >= new Date());
  const past = appointments.filter((a) => new Date(a.start_time) < new Date()).reverse();

  return (
    <DashboardShell businessName={ctx.business.name} active="/appointments">
      <h1 className="text-lg font-semibold tracking-tight">Appointments</h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Upcoming" rows={upcoming} tz={ctx.business.timezone} />
        <Section title="Past" rows={past} tz={ctx.business.timezone} />
      </div>
    </DashboardShell>
  );
}

function Section({
  title,
  rows,
  tz,
}: {
  title: string;
  rows: Appointment[];
  tz: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">{title}</h2>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">None.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{formatDateTime(a.start_time, tz)}</div>
                  <div className="text-xs text-slate-500">
                    to {formatDateTime(a.end_time, tz)} · via {a.source}
                  </div>
                </div>
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
