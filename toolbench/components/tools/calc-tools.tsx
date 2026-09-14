"use client";

import { useMemo, useState } from "react";
import {
  percentOf, whatPercent, percentChange, applyDiscounts, margin, priceForMargin,
  loan, compoundInterest, fromHourly, fromAnnual, paint, concrete,
} from "@/lib/tools/calc";
import { NumberField, Select, Panel, Stat, ErrorNote, EmptyNote, Toggle, Label } from "@/components/ui";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const money0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const num = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n);

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[13.5px] text-[var(--ink-2)]">{label}</span>
      <span className={`tabular-nums ${strong ? "text-[17px] font-semibold text-[var(--accent-ink)]" : "text-[14px]"}`}>
        {value}
      </span>
    </div>
  );
}

export function PercentageCalculator() {
  const [mode, setMode] = useState<"of" | "isWhat" | "change">("of");
  const [a, setA] = useState(15);
  const [b, setB] = useState(200);

  const result = useMemo(() => {
    if (Number.isNaN(a) || Number.isNaN(b)) return { error: "Enter both numbers." };
    if (mode === "of") return { value: `${num(percentOf(a, b))}`, label: `${num(a)}% of ${num(b)}` };
    if (mode === "isWhat") {
      const r = whatPercent(a, b);
      return r.ok ? { value: `${num(r.value!)}%`, label: `${num(a)} is this much of ${num(b)}` } : { error: r.error };
    }
    const r = percentChange(a, b);
    return r.ok
      ? { value: `${r.value! > 0 ? "+" : ""}${num(r.value!)}%`, label: `${r.direction === "increase" ? "Increase" : r.direction === "decrease" ? "Decrease" : "No change"} from ${num(a)} to ${num(b)}` }
      : { error: r.error };
  }, [mode, a, b]);

  const labels = mode === "of"
    ? ["Percent", "Of number"]
    : mode === "isWhat" ? ["This number", "Is what percent of"] : ["From", "To"];

  return (
    <div className="space-y-3">
      <Select id="pc-mode" label="What do you need?" value={mode}
        onChange={(v) => setMode(v as typeof mode)}
        options={[
          { value: "of", label: "X% of a number" },
          { value: "isWhat", label: "X is what percent of Y" },
          { value: "change", label: "Percentage increase or decrease" },
        ]} />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField id="pc-a" label={labels[0]} value={a} onChange={setA} />
        <NumberField id="pc-b" label={labels[1]} value={b} onChange={setB} />
      </div>
      {"error" in result && result.error ? <ErrorNote>{result.error}</ErrorNote> : (
        <Panel className="p-5 text-center">
          <div className="text-[13px] text-[var(--ink-3)]">{(result as { label: string }).label}</div>
          <div className="mt-1 text-[34px] font-semibold tabular-nums text-[var(--accent-ink)]">
            {(result as { value: string }).value}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function DiscountCalculator() {
  const [price, setPrice] = useState(100);
  const [d1, setD1] = useState(20);
  const [d2, setD2] = useState(0);

  const result = useMemo(() => {
    if (Number.isNaN(price) || price < 0) return null;
    const list = [d1, d2].filter((d) => !Number.isNaN(d) && d > 0);
    return applyDiscounts(price, list);
  }, [price, d1, d2]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField id="dc-price" label="Original price" value={price} onChange={setPrice} min={0} prefix="$" />
        <NumberField id="dc-1" label="First discount" value={d1} onChange={setD1} min={0} max={100} suffix="%" />
        <NumberField id="dc-2" label="Second discount (optional)" value={d2} onChange={setD2} min={0} max={100} suffix="%" />
      </div>
      {result ? (
        <>
          <Panel className="divide-y divide-[var(--line-2)]">
            <Row label="You pay" value={money(result.finalPrice)} strong />
            <Row label="You save" value={money(result.saved)} />
            <Row label="Effective discount" value={`${num(result.effectiveRate)}%`} />
          </Panel>
          {d2 > 0 ? (
            <EmptyNote>
              Stacked discounts apply one after the other, so {num(d1)}% then {num(d2)}% is{" "}
              {num(result.effectiveRate)}% off — not {num(d1 + d2)}%.
            </EmptyNote>
          ) : null}
        </>
      ) : <ErrorNote>Enter a valid price.</ErrorNote>}
    </div>
  );
}

export function MarginCalculator() {
  const [mode, setMode] = useState<"fromRevenue" | "targetMargin">("fromRevenue");
  const [cost, setCost] = useState(60);
  const [revenue, setRevenue] = useState(100);
  const [target, setTarget] = useState(40);

  const forward = useMemo(() => margin(revenue, cost), [revenue, cost]);
  const reverse = useMemo(() => priceForMargin(cost, target), [cost, target]);

  return (
    <div className="space-y-3">
      <Select id="mc-mode" label="What do you need?" value={mode}
        onChange={(v) => setMode(v as typeof mode)}
        options={[
          { value: "fromRevenue", label: "Margin from cost and price" },
          { value: "targetMargin", label: "Price for a target margin" },
        ]} />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField id="mc-cost" label="Cost" value={cost} onChange={setCost} min={0} prefix="$" />
        {mode === "fromRevenue"
          ? <NumberField id="mc-rev" label="Selling price" value={revenue} onChange={setRevenue} min={0} prefix="$" />
          : <NumberField id="mc-target" label="Target margin" value={target} onChange={setTarget} min={0} max={99} suffix="%" />}
      </div>

      {mode === "fromRevenue" ? (
        forward.ok ? (
          <Panel className="divide-y divide-[var(--line-2)]">
            <Row label="Profit" value={money(forward.value!.profit)} strong />
            <Row label="Margin" value={`${num(forward.value!.marginPercent)}%`} />
            <Row label="Markup" value={Number.isFinite(forward.value!.markupPercent) ? `${num(forward.value!.markupPercent)}%` : "—"} />
          </Panel>
        ) : <ErrorNote>{forward.error}</ErrorNote>
      ) : (
        reverse.ok ? (
          <Panel className="divide-y divide-[var(--line-2)]">
            <Row label="Charge" value={money(reverse.value!)} strong />
            <Row label="Profit per unit" value={money(reverse.value! - cost)} />
          </Panel>
        ) : <ErrorNote>{reverse.error}</ErrorNote>
      )}

      <EmptyNote>
        Margin is profit over price; markup is profit over cost. A 50% markup is only a 33% margin.
      </EmptyNote>
    </div>
  );
}

export function LoanCalculator() {
  const [amount, setAmount] = useState(200000);
  const [rate, setRate] = useState(6);
  const [years, setYears] = useState(30);
  const [showSchedule, setShowSchedule] = useState(false);

  const result = useMemo(() => loan(amount, rate, years), [amount, rate, years]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField id="ln-amt" label="Loan amount" value={amount} onChange={setAmount} min={0} prefix="$" />
        <NumberField id="ln-rate" label="Interest rate" value={rate} onChange={setRate} min={0} step={0.01} suffix="% APR" />
        <NumberField id="ln-years" label="Term" value={years} onChange={setYears} min={1} suffix="years" />
      </div>

      {result.ok ? (
        <>
          <Panel className="divide-y divide-[var(--line-2)]">
            <Row label="Monthly payment" value={money(result.value!.monthlyPayment)} strong />
            <Row label="Total interest" value={money(result.value!.totalInterest)} />
            <Row label="Total paid" value={money(result.value!.totalPaid)} />
          </Panel>
          <Toggle label="Show amortisation schedule" checked={showSchedule} onChange={setShowSchedule} />
          {showSchedule ? (
            <Panel className="max-h-80 overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                  <tr>
                    <th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Principal</th>
                    <th className="px-3 py-2 text-right">Interest</th><th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-2)]">
                  {result.value!.schedule.map((r) => (
                    <tr key={r.month}>
                      <td className="px-3 py-1.5 tabular-nums text-[var(--ink-3)]">{r.month}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.principal)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.interest)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}
          <EmptyNote>Principal and interest only — taxes and insurance are not included.</EmptyNote>
        </>
      ) : <ErrorNote>{result.error}</ErrorNote>}
    </div>
  );
}

export function CompoundInterestCalculator() {
  const [principal, setPrincipal] = useState(5000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(20);
  const [monthly, setMonthly] = useState(200);
  const [freq, setFreq] = useState("12");

  const result = useMemo(
    () => compoundInterest({
      principal, annualRatePercent: rate, years,
      compoundsPerYear: Number(freq), monthlyContribution: monthly,
    }),
    [principal, rate, years, monthly, freq],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField id="ci-p" label="Starting amount" value={principal} onChange={setPrincipal} min={0} prefix="$" />
        <NumberField id="ci-r" label="Annual return" value={rate} onChange={setRate} step={0.1} suffix="%" />
        <NumberField id="ci-y" label="Years" value={years} onChange={setYears} min={1} />
        <NumberField id="ci-m" label="Monthly contribution" value={monthly} onChange={setMonthly} min={0} prefix="$" />
        <Select id="ci-f" label="Compounds" value={freq} onChange={setFreq}
          options={[
            { value: "12", label: "Monthly" }, { value: "4", label: "Quarterly" },
            { value: "1", label: "Annually" }, { value: "365", label: "Daily" },
          ]} />
      </div>

      {result.ok ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Final balance" value={money0(result.value!.finalBalance)} />
            <Stat label="You put in" value={money0(result.value!.totalContributions)} />
            <Stat label="Interest earned" value={money0(result.value!.totalInterest)} />
          </div>
          <Panel className="max-h-72 overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
                <tr><th className="px-3 py-2">Year</th><th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Contributed</th><th className="px-3 py-2 text-right">Interest</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-2)]">
                {result.value!.yearly.map((y) => (
                  <tr key={y.year}>
                    <td className="px-3 py-1.5 tabular-nums text-[var(--ink-3)]">{y.year}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money0(y.balance)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money0(y.contributed)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{money0(y.interest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <EmptyNote>Nominal figures before tax, fees and inflation, all of which reduce the real result.</EmptyNote>
        </>
      ) : <ErrorNote>{result.error}</ErrorNote>}
    </div>
  );
}

export function SalaryCalculator() {
  const [mode, setMode] = useState<"hourly" | "annual">("hourly");
  const [value, setValue] = useState(25);
  const [hours, setHours] = useState(40);
  const [weeks, setWeeks] = useState(52);

  const result = useMemo(
    () => (mode === "hourly" ? fromHourly(value, hours, weeks) : fromAnnual(value, hours, weeks)),
    [mode, value, hours, weeks],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select id="sal-mode" label="Start from" value={mode} onChange={(v) => setMode(v as typeof mode)}
          options={[{ value: "hourly", label: "Hourly rate" }, { value: "annual", label: "Annual salary" }]} />
        <NumberField id="sal-v" label={mode === "hourly" ? "Hourly rate" : "Annual salary"}
          value={value} onChange={setValue} min={0} prefix="$" />
        <NumberField id="sal-h" label="Hours per week" value={hours} onChange={setHours} min={1} max={168} />
        <NumberField id="sal-w" label="Weeks per year" value={weeks} onChange={setWeeks} min={1} max={52} />
      </div>
      {result.ok ? (
        <Panel className="divide-y divide-[var(--line-2)]">
          <Row label="Hourly" value={money(result.value!.hourly)} />
          <Row label="Daily" value={money(result.value!.daily)} />
          <Row label="Weekly" value={money(result.value!.weekly)} />
          <Row label="Every two weeks" value={money(result.value!.biweekly)} />
          <Row label="Monthly" value={money(result.value!.monthly)} />
          <Row label="Annual" value={money(result.value!.annual)} strong />
        </Panel>
      ) : <ErrorNote>{result.error}</ErrorNote>}
      <EmptyNote>Gross pay, before tax and deductions.</EmptyNote>
    </div>
  );
}

export function PaintCalculator() {
  const [length, setLength] = useState(12);
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(8);
  const [coats, setCoats] = useState(2);
  const [openings, setOpenings] = useState(40);

  const wallSqFt = 2 * (length + width) * height;
  const result = useMemo(
    () => paint({ wallSqFt, coats, doorsAndWindowsSqFt: openings }),
    [wallSqFt, coats, openings],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField id="pt-l" label="Room length" value={length} onChange={setLength} min={0} suffix="ft" />
        <NumberField id="pt-w" label="Room width" value={width} onChange={setWidth} min={0} suffix="ft" />
        <NumberField id="pt-h" label="Ceiling height" value={height} onChange={setHeight} min={0} suffix="ft" />
        <NumberField id="pt-c" label="Coats" value={coats} onChange={setCoats} min={1} max={5} />
        <NumberField id="pt-o" label="Doors and windows" value={openings} onChange={setOpenings} min={0} suffix="sq ft" />
      </div>
      {result.ok ? (
        <Panel className="divide-y divide-[var(--line-2)]">
          <Row label="Paintable wall area" value={`${num(result.value!.totalSqFt, 0)} sq ft`} />
          <Row label="Per coat" value={`${num(result.value!.gallonsPerCoat)} gal`} />
          <Row label={`Total for ${coats} coat${coats === 1 ? "" : "s"}`} value={`${num(result.value!.totalGallons)} gal`} strong />
          <Row label="Buy" value={`${Math.ceil(result.value!.totalGallons)} gallon${Math.ceil(result.value!.totalGallons) === 1 ? "" : "s"}`} />
        </Panel>
      ) : <ErrorNote>{result.error}</ErrorNote>}
      <EmptyNote>Assumes 350 sq ft per gallon per coat. Rough or unprimed walls need more — check the tin.</EmptyNote>
    </div>
  );
}

export function ConcreteCalculator() {
  const [length, setLength] = useState(10);
  const [width, setWidth] = useState(10);
  const [thickness, setThickness] = useState(4);
  const [waste, setWaste] = useState(10);

  const result = useMemo(
    () => concrete({ lengthFeet: length, widthFeet: width, thicknessInches: thickness, wastePercent: waste }),
    [length, width, thickness, waste],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField id="cn-l" label="Length" value={length} onChange={setLength} min={0} suffix="ft" />
        <NumberField id="cn-w" label="Width" value={width} onChange={setWidth} min={0} suffix="ft" />
        <NumberField id="cn-t" label="Thickness" value={thickness} onChange={setThickness} min={0} suffix="in" />
        <NumberField id="cn-waste" label="Waste allowance" value={waste} onChange={setWaste} min={0} max={50} suffix="%" />
      </div>
      {result.ok ? (
        <>
          <Panel className="divide-y divide-[var(--line-2)]">
            <Row label="Volume" value={`${num(result.value!.cubicYards)} cubic yards`} strong />
            <Row label="Cubic feet" value={num(result.value!.cubicFeet)} />
            <Row label="80 lb bags" value={String(result.value!.bags80lb)} />
            <Row label="60 lb bags" value={String(result.value!.bags60lb)} />
          </Panel>
          {result.value!.cubicYards > 1 ? (
            <EmptyNote>
              Past about a cubic yard, ready-mix is usually cheaper and far less work than {result.value!.bags80lb} bags.
            </EmptyNote>
          ) : null}
        </>
      ) : <ErrorNote>{result.error}</ErrorNote>}
    </div>
  );
}
