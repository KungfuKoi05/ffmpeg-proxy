import { requireBusiness } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SafetySwitches } from "@/components/safety-switches";
import type { BusinessFaq, BusinessService } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireBusiness();
  const supabase = await supabaseServer();

  const [{ data: services }, { data: faqs }, { data: phones }] = await Promise.all([
    supabase.from("business_services").select("*").eq("business_id", ctx.business.id),
    supabase.from("business_faqs").select("*").eq("business_id", ctx.business.id),
    supabase.from("phone_numbers").select("phone_number, status").eq("business_id", ctx.business.id),
  ]);

  return (
    <DashboardShell businessName={ctx.business.name} active="/settings">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={ctx.business.name} />
            <Row label="Phone" value={ctx.business.phone ?? "—"} />
            <Row label="Timezone" value={ctx.business.timezone} />
            <Row label="Industry" value={ctx.business.industry} />
            <Row
              label="Service area"
              value={
                [...ctx.business.service_area.cities, ...ctx.business.service_area.zip_codes].join(", ") ||
                "not set"
              }
            />
            <Row label="Emergency service" value={ctx.business.emergency_enabled ? "yes" : "no"} />
            <Row label="Your role" value={ctx.role} />
          </CardContent>
        </Card>

        <SafetySwitches
          business={{
            ai_enabled: ctx.business.ai_enabled,
            sms_enabled: ctx.business.sms_enabled,
            voice_enabled: ctx.business.voice_enabled,
            booking_enabled: ctx.business.booking_enabled,
            web_chat_enabled: ctx.business.web_chat_enabled,
          }}
          canEdit={ctx.role !== "staff"}
        />

        <Card>
          <CardHeader>
            <CardTitle>Services ({services?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 text-sm">
              {((services ?? []) as BusinessService[]).map((s) => (
                <li key={s.id} className="flex justify-between px-5 py-2">
                  <span>{s.name}</span>
                  <span className="tabular-nums text-slate-600">
                    ${Number(s.average_job_value).toLocaleString()}
                  </span>
                </li>
              ))}
              {!services?.length ? (
                <li className="px-5 py-6 text-center text-slate-500">No services configured.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge base ({faqs?.length ?? 0} FAQs)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {((faqs ?? []) as BusinessFaq[]).map((f) => (
              <div key={f.id}>
                <div className="font-medium">{f.question}</div>
                <div className="text-slate-600">{f.answer}</div>
              </div>
            ))}
            {!faqs?.length ? <p className="text-slate-500">No FAQs yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phone numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {phones?.length ? (
              phones.map((p) => (
                <div key={p.phone_number} className="flex justify-between">
                  <span>{p.phone_number}</span>
                  <span className="text-slate-500">{p.status}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">
                No number connected. Your receptionist cannot receive calls yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
