"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/units";
import { describePriceVsAverage, type PriceStatistics } from "@/lib/pricing/history";
import { DataRow } from "@/components/ui/misc";

interface PricesResponse {
  windowDays: number;
  windowCappedByPlan: boolean;
  history: Array<{ observedAt: string; amountCents: number; retailer: string | null }>;
  current: Array<{
    retailer: string | null;
    amountCents: number;
    salePriceCents: number | null;
    availability: string;
    productUrl: string | null;
    checkedAt: string;
  }>;
  statistics: PriceStatistics;
}

/** Observed pricing over time. All points are recorded observations. */
export function PriceHistory({ productId }: { productId: string }) {
  const [data, setData] = useState<PricesResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/prices?productId=${encodeURIComponent(productId)}&days=90`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((payload: PricesResponse) => {
        setData(payload);
        setState("ready");
      })
      .catch(() => setState("error"));
    return () => controller.abort();
  }, [productId]);

  if (state === "loading") {
    return <p className="text-xs text-ink-muted">Loading observed pricing…</p>;
  }
  if (state === "error" || !data) {
    return <p className="text-xs text-ink-muted">Price history is unavailable right now.</p>;
  }
  if (data.history.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        No pricing has been observed for this product yet.
      </p>
    );
  }

  const chartData = data.history.map((point) => ({
    date: point.observedAt.slice(5, 10),
    price: point.amountCents / 100,
  }));
  const note = describePriceVsAverage(data.statistics, data.windowDays);

  return (
    <div className="space-y-3">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(36 96% 56%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(36 96% 56%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(220 16% 18%)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(220 10% 45%)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "hsl(220 10% 45%)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(value) => `$${Number(value ?? 0).toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(222 22% 8%)",
                border: "1px solid hsl(220 16% 18%)",
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: "hsl(220 12% 62%)" }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Observed"]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="hsl(36 96% 56%)"
              strokeWidth={1.5}
              fill="url(#priceFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {note ? <p className="text-xs text-ink-muted">{note}</p> : null}

      <div className="rounded border border-line bg-elevated px-3 py-1.5">
        <DataRow label={`${data.windowDays}-day low`} value={formatMoney(data.statistics.lowestCents)} />
        <DataRow label={`${data.windowDays}-day high`} value={formatMoney(data.statistics.highestCents)} />
        <DataRow label="Average" value={formatMoney(data.statistics.averageCents)} />
        <DataRow label="Observations" value={String(data.statistics.count)} />
      </div>

      {data.windowCappedByPlan ? (
        <p className="text-[11px] text-ink-faint">
          Showing {data.windowDays} days. Pro plans include 90 days and Pro+ two years.
        </p>
      ) : null}

      <div>
        <p className="label-micro mb-1.5">Current retailer listings</p>
        <ul className="space-y-1.5">
          {data.current.map((listing, index) => (
            <li
              key={`${listing.retailer}-${index}`}
              className="flex items-center justify-between gap-3 rounded border border-line bg-elevated px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-ink">{listing.retailer ?? "Retailer"}</p>
                <p className="font-mono text-[10px] text-ink-faint">
                  checked {new Date(listing.checkedAt).toISOString().slice(0, 10)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-ink">
                  {formatMoney(listing.salePriceCents ?? listing.amountCents)}
                </p>
                {listing.productUrl ? (
                  <a
                    href={listing.productUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[10px] text-accent hover:underline"
                  >
                    View listing
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
