"use client";

import { useMemo } from "react";
import { usePlatformOverview } from "@/hooks/use-platform";
import { KpiCard } from "@/components/ui/KpiCard";
import { getApiError } from "@/lib/api-error";
import type { PlatformOverview } from "@/lib/api";

const num = (n: number) => n.toLocaleString();

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);

/**
 * Platform Overview — the operator's "what's going on" snapshot across every
 * workspace: tenant counts, users, and outbound send volume / failure rate,
 * plus a 14-day send-vs-failure trend. Data from GET /platform/overview.
 */
export function OverviewClient() {
  const { data, isLoading, error } = usePlatformOverview();

  if (error) {
    return (
      <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
        <span className="op-label mb-1 block text-error">error</span>
        <p className="text-[0.8125rem] text-base-content">{getApiError(error)}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-box border border-base-300 bg-base-200" />
        ))}
      </div>
    );
  }

  const failurePct = (data.messages.failureRate7d * 100).toFixed(1);
  const rev = data.revenue;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="MRR" value={money(rev.mrrMinor, rev.currency)} hint="Plan-based · active tenants" />
          <KpiCard label="ARR" value={money(rev.arrMinor, rev.currency)} hint="MRR × 12" />
          <KpiCard label="ARPA" value={money(rev.arpaMinor, rev.currency)} hint="Per paying workspace" />
          <KpiCard
            label="Paying workspaces"
            value={num(rev.payingWorkspaces)}
            hint={
              rev.customPlanWorkspaces > 0
                ? `+${num(rev.customPlanWorkspaces)} on custom plans (not counted)`
                : "on a paid plan"
            }
          />
        </div>
        <PlanMix planMix={rev.planMix} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Workspaces"
          value={num(data.workspaces.total)}
          hint={
            <>
              {num(data.workspaces.active)} active · {num(data.workspaces.trial)} trial ·{" "}
              {num(data.workspaces.suspended)} suspended
            </>
          }
        />
        <KpiCard
          label="Users"
          value={num(data.users.total)}
          hint={
            <>
              {num(data.users.active)} active · +{num(data.users.newLast7d)} new (7d)
            </>
          }
        />
        <KpiCard
          label="Suspended workspaces"
          value={num(data.workspaces.suspended)}
          hint="Hard-locked tenants (outbound frozen)"
        />
        <KpiCard label="Messages sent today" value={num(data.messages.sentToday)} hint="Outbound, delivered or in-flight" />
        <KpiCard label="Messages sent (7d)" value={num(data.messages.sent7d)} hint="Outbound over the last 7 days" />
        <KpiCard
          label="Failed sends (7d)"
          value={num(data.messages.failed7d)}
          delta={`${failurePct}%`}
          deltaDirection="down"
          hint="Failure rate of attempted outbound sends"
        />
      </div>

      <TrendChart series={data.series} />
    </div>
  );
}

const PLAN_ORDER = ["free", "starter", "growth", "scale"] as const;
const PLAN_COLORS: Record<string, string> = {
  free: "bg-base-content/30",
  starter: "bg-info",
  growth: "bg-primary",
  scale: "bg-secondary",
};

function PlanMix({ planMix }: { planMix: PlatformOverview["revenue"]["planMix"] }) {
  const total = PLAN_ORDER.reduce((s, k) => s + (planMix[k] ?? 0), 0);
  return (
    <div className="op-grain rounded-box border border-base-300 bg-base-200 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="op-label">Plan mix — active workspaces</span>
        <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">{num(total)} active</span>
      </div>
      {total > 0 ? (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-base-300">
          {PLAN_ORDER.map((k) => {
            const c = planMix[k] ?? 0;
            if (!c) return null;
            return (
              <div
                key={k}
                className={PLAN_COLORS[k]}
                style={{ width: `${(c / total) * 100}%` }}
                title={`${k}: ${c}`}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-[0.8125rem] text-base-content/55">No active workspaces.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.6875rem] text-base-content/65">
        {PLAN_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${PLAN_COLORS[k]}`} />
            {k} · <span className="font-mono-op tabular-nums">{num(planMix[k] ?? 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ series }: { series: PlatformOverview["series"] }) {
  const chart = useMemo(() => {
    const W = 720;
    const H = 200;
    const pad = { top: 16, right: 12, bottom: 24, left: 36 };
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const n = series.length;
    const max = Math.max(1, ...series.map((d) => Math.max(d.sent, d.failed)));
    const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v: number) => pad.top + innerH - (v / max) * innerH;
    const path = (key: "sent" | "failed") =>
      series
        .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`)
        .join(" ");
    return { W, H, pad, innerH, max, x, y, sentPath: path("sent"), failedPath: path("failed") };
  }, [series]);

  if (!series.length) {
    return (
      <div className="rounded-box border border-base-300 bg-base-200 p-6 text-center text-[0.8125rem] text-base-content/55">
        No message activity in the last 14 days.
      </div>
    );
  }

  return (
    <div className="op-grain rounded-box border border-base-300 bg-base-200 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="op-label">Sends — last 14 days</span>
        <div className="flex items-center gap-3 text-[0.6875rem] text-base-content/60">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Sent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-error" /> Failed
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${chart.W} ${chart.H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Daily sent and failed messages over the last 14 days"
      >
        <line
          x1={chart.pad.left}
          y1={chart.pad.top + chart.innerH}
          x2={chart.W - chart.pad.right}
          y2={chart.pad.top + chart.innerH}
          className="stroke-base-300"
          strokeWidth={1}
        />
        <text x={4} y={chart.pad.top + 4} className="fill-base-content/45 text-[10px]">
          {chart.max.toLocaleString()}
        </text>
        <path d={chart.failedPath} fill="none" className="stroke-error" strokeWidth={1.5} />
        <path d={chart.sentPath} fill="none" className="stroke-primary" strokeWidth={2} />
        {series.map((d, i) => (
          <circle key={i} cx={chart.x(i)} cy={chart.y(d.sent)} r={2} className="fill-primary" />
        ))}
      </svg>
    </div>
  );
}
