import Link from "next/link";
import { RoiCalculator } from "@/components/roi-calculator";
import { PLANS, PLAN_ORDER } from "@/lib/config/plans";
import { formatCurrency } from "@/lib/utils";
import { Stat } from "@/components/ui/stat";

export default function LandingPage() {
  return (
    <main>
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">Revenue Recovery AI</span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/demo" className="text-slate-600 hover:text-slate-900">
              See a demo
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Start recovering revenue
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Stop losing jobs when you miss the phone.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          Revenue Recovery AI answers, follows up, qualifies and books leads — even
          when your team can&apos;t.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Start Recovering Revenue
          </Link>
          <Link
            href="#how-it-works"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            See How It Works
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            A missed call is a missed job.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "They call while you're on a roof",
                body: "Your tech is under a house or on a ladder. The phone rings out. Nobody hears it.",
              },
              {
                title: "They don't leave a voicemail",
                body: "Most callers with an urgent problem hang up and dial the next company on the list.",
              },
              {
                title: "You never know it happened",
                body: "The job goes to a competitor and never shows up anywhere in your numbers.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {[
            "A customer calls",
            "The AI answers",
            "It qualifies the job",
            "It books the appointment",
            "You show up and get paid",
          ].map((step, i) => (
            <li key={step} className="rounded-xl border border-slate-200 p-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {i + 1}
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            What are missed calls costing you?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Move the sliders to match your business.
          </p>
          <div className="mt-8">
            <RoiCalculator />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">
          Everything lands in one dashboard
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The same components your dashboard is built from — with sample figures.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Revenue opportunity" value="$12,450" hint="Estimated, not booked" emphasis />
          <Stat label="Missed calls" value="47" />
          <Stat label="Leads recovered" value="31" />
          <Stat label="Appointments" value="18" />
        </div>
        <div className="mt-4">
          <Link href="/demo" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Open the live demo dashboard →
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              return (
                <div
                  key={id}
                  className={`rounded-xl border bg-white p-6 ${
                    id === "growth" ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-200"
                  }`}
                >
                  <h3 className="text-sm font-semibold text-slate-900">{plan.name}</h3>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">
                    {formatCurrency(plan.monthlyPrice)}
                    <span className="text-sm font-normal text-slate-500">/mo</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    {plan.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="mt-6 block rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Get started
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
        <dl className="mt-8 space-y-6">
          {[
            {
              q: "Does it sound like a robot?",
              a: "It speaks naturally and keeps replies short. It also says plainly that it's an assistant when asked — we don't pretend otherwise.",
            },
            {
              q: "What if it doesn't know the answer?",
              a: "It hands off to a human. It's built to escalate when uncertain rather than guess, and it will never quote a price or promise a time you haven't configured.",
            },
            {
              q: "Do I keep my phone number?",
              a: "Yes. You forward your existing number to the number we provision, so nothing on your trucks or website changes.",
            },
            {
              q: "What happens if a caller has an emergency?",
              a: "For gas smells, alarms, smoke or a medical emergency it tells the caller to hang up and call emergency services, then alerts you immediately.",
            },
          ].map((item) => (
            <div key={item.q}>
              <dt className="text-sm font-semibold text-slate-900">{item.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-slate-200 bg-slate-900 py-16 text-center">
        <h2 className="text-2xl font-semibold text-white">
          Recover the revenue you&apos;re already losing.
        </h2>
        <Link
          href="/signup"
          className="mt-6 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
        >
          Start Recovering Revenue
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        Revenue Recovery AI
      </footer>
    </main>
  );
}
