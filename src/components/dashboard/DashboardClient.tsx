"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  analyticsApi,
  campaignsApi,
  conversationsApi,
  usageApi,
} from "@/lib/api";
import {
  campaignRunSummaryLine,
  campaignStatusTone,
  normalizeStatus,
  type CampaignRunSummary,
  type CampaignStatusTone,
} from "@/lib/campaignUi";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import { KpiCard } from "@/components/ui/KpiCard";
import { QuotaBar } from "@/components/ui/QuotaBar";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { PanelBody, PanelSection } from "@/components/right-panel/PanelBody";
import { StatusTag, type StatusTagTone } from "@/components/ui/StatusTag";

function toneToTagTone(tone: CampaignStatusTone): StatusTagTone {
  switch (tone) {
    case "success": return "success";
    case "running": return "running";
    case "warning": return "warning";
    case "danger":  return "danger";
    default:        return "neutral";
  }
}

type DeliveryStats = {
  total?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
  deliveryRate?: number;
  readRate?: number;
};

type TimeSeriesPoint = {
  date: string;
  sent?: number;
  inbound?: number;
};

type CampaignReport = {
  campaignId?: string;
  campaignName?: string;
  channel?: string;
  status?: string;
  totals?: {
    totalJobs?: number;
    completed?: number;
    failed?: number;
    successRate?: number;
  };
};

type AnalyticsSummary = {
  period?: { start?: string; end?: string };
  delivery?: DeliveryStats;
  timeSeries?: TimeSeriesPoint[];
  topCampaigns?: CampaignReport[];
};

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  channel?: string;
  updatedAt?: string;
  runs?: CampaignRunSummary[];
};

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatPct(rate: number | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  const p = rate <= 1 ? rate * 100 : rate;
  return `${p.toFixed(1)}%`;
}

function pickOpenCount(stats: Record<string, unknown> | null): number | undefined {
  if (!stats) return undefined;
  const keys = ["open", "openCount", "openConversations", "OPEN"] as const;
  for (const k of keys) {
    const v = stats[k];
    if (typeof v === "number") return v;
  }
  const byStatus = stats.byStatus;
  if (byStatus && typeof byStatus === "object" && !Array.isArray(byStatus)) {
    const b = byStatus as Record<string, unknown>;
    const o = b.OPEN ?? b.open;
    if (typeof o === "number") return o;
  }
  return undefined;
}

function usageRowsFromLimits(
  limits: Record<string, unknown> | null
): { title: string; current: number; max: number }[] {
  if (!limits) return [];
  const rows: { title: string; current: number; max: number }[] = [];
  for (const [key, val] of Object.entries(limits)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      const c = o.current ?? o.used ?? o.count;
      const m = o.limit ?? o.max ?? o.quota;
      if (typeof c === "number" && typeof m === "number" && m > 0) {
        rows.push({
          title: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
          current: c,
          max: m,
        });
      }
    }
  }
  return rows;
}

function isCampaignInFlight(status: string): boolean {
  const s = normalizeStatus(status);
  return (
    s === "RUNNING" ||
    s === "IN_PROGRESS" ||
    s === "PROCESSING" ||
    s === "ACTIVE" ||
    s === "PAUSED" ||
    s === "SCHEDULED" ||
    s === "PENDING" ||
    s === "QUEUED"
  );
}

function LineGraph({ points }: { points: TimeSeriesPoint[] }) {
  const n = points.length;

  const paths = useMemo(() => {
    if (n === 0) return null;
    const TOP = 8;
    const BOTTOM = 92;
    const sentVals = points.map((p) => p.sent ?? 0);
    const inboundVals = points.map((p) => p.inbound ?? 0);
    const m = Math.max(1, ...sentVals, ...inboundVals);
    const toX = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
    const toY = (v: number) => BOTTOM - (v / m) * (BOTTOM - TOP);
    const coords = (vals: number[]): [number, number][] =>
      vals.map((v, i) => [toX(i), toY(v)]);
    const line = (cs: [number, number][]) =>
      cs.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    const area = (cs: [number, number][]) =>
      cs.length < 2
        ? ""
        : `${line(cs)} L${cs[cs.length - 1][0].toFixed(2)},${BOTTOM} L${cs[0][0].toFixed(2)},${BOTTOM} Z`;
    const sc = coords(sentVals);
    const ic = coords(inboundVals);
    return {
      sentLine: n > 1 ? line(sc) : "",
      inboundLine: n > 1 ? line(ic) : "",
      sentArea: area(sc),
      inboundArea: area(ic),
      sentDots: sc,
      inboundDots: ic,
      sentVals,
      inboundVals,
    };
  }, [points, n]);

  if (n === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-box bg-base-200 text-sm text-base-content/60">
        No activity in this range
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-24 w-full overflow-visible"
        aria-label="Daily message volume"
      >
        {/* Gridlines */}
        {[8, 50, 92].map((y) => (
          <line
            key={y}
            x1="0" y1={y} x2="100" y2={y}
            stroke="currentColor"
            strokeOpacity="0.08"
            style={{ vectorEffect: "non-scaling-stroke" } as React.CSSProperties}
            strokeWidth="0.8"
          />
        ))}
        {/* Area fills */}
        {paths?.sentArea && (
          <path
            d={paths.sentArea}
            style={{ fill: "oklch(var(--p) / 0.12)" }}
          />
        )}
        {paths?.inboundArea && (
          <path
            d={paths.inboundArea}
            style={{ fill: "oklch(var(--s) / 0.12)" }}
          />
        )}
        {/* Lines */}
        {paths?.sentLine && (
          <path
            d={paths.sentLine}
            fill="none"
            style={{ stroke: "oklch(var(--p))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {paths?.inboundLine && (
          <path
            d={paths.inboundLine}
            fill="none"
            style={{ stroke: "oklch(var(--s))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {/* Dots */}
        {paths?.sentDots.map(([cx, cy], i) => (
          <circle
            key={`s${i}`}
            cx={cx} cy={cy} r="1.2"
            style={{ fill: "oklch(var(--p))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties}
          >
            <title>{points[i]?.date}: {paths.sentVals[i]} sent</title>
          </circle>
        ))}
        {paths?.inboundDots.map(([cx, cy], i) => (
          <circle
            key={`ib${i}`}
            cx={cx} cy={cy} r="1.2"
            style={{ fill: "oklch(var(--s))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties}
          >
            <title>{points[i]?.date}: {paths.inboundVals[i]} inbound</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-center gap-3 text-xs text-base-content/55">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-primary/80" />
          Sent
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-secondary/80" />
          Inbound
        </span>
      </div>
    </div>
  );
}


type PeriodKey = "7d" | "30d" | "90d" | "month" | "custom";

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom range" },
];

function rangeForPeriod(period: PeriodKey, customStart?: string, customEnd?: string) {
  const end = new Date();
  let start: Date;

  switch (period) {
    case "7d":
      start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start = new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
    case "custom":
      return {
        start: customStart || fmtDateInput(new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)),
        end: customEnd || fmtDateInput(end),
      };
  }
  return { start: fmtDateInput(start), end: fmtDateInput(end) };
}

export function DashboardClient({ meRole }: { meRole: string }) {
  const isViewer = !roleHasWorkspacePermission(meRole, "contacts.create");
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const range = useMemo(
    () => rangeForPeriod(period, customStart, customEnd),
    [period, customStart, customEnd]
  );
  const periodLabel =
    PERIOD_OPTIONS.find((opt) => opt.key === period)?.label ?? "Last 7 days";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [limits, setLimits] = useState<Record<string, unknown> | null>(null);
  const [convStats, setConvStats] = useState<Record<string, unknown> | null>(null);
  const [inFlightCampaigns, setInFlightCampaigns] = useState<CampaignRow[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignRow[]>([]);
  const [channelMix, setChannelMix] = useState<Array<{ channel: string; total: number }>>([]);
  const [campaignTab, setCampaignTab] = useState<"recent" | "top">("recent");
  const { setContent: setRightPanelContent, clearContent: clearRightPanelContent, close: closeRightPanel } = useRightPanel();

  // Ensure panel is closed on dashboard mount
  useEffect(() => {
    closeRightPanel();
  }, [closeRightPanel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sum, lim, cs, campRes, chMix] = await Promise.all([
        analyticsApi.summary({ start: range.start, end: range.end }).catch(() => null),
        isViewer ? Promise.resolve(null) : usageApi.limits().catch(() => null),
        isViewer ? Promise.resolve(null) : conversationsApi.stats().catch(() => null),
        isViewer ? Promise.resolve([]) : campaignsApi.list().catch(() => []),
        analyticsApi.channels({ start: range.start, end: range.end }).catch(() => null),
      ]);
      if (cancelled) return;

      setSummary((sum ?? null) as AnalyticsSummary | null);
      setLimits((lim ?? null) as Record<string, unknown> | null);

      // Parse channel mix
      try {
        const chArr = Array.isArray(chMix) ? chMix : [];
        const parsed = chArr.map((ch: Record<string, unknown>) => ({
          channel: String(ch.channel ?? "unknown"),
          total: ((ch.outbound as Record<string, unknown>)?.sent as number ?? 0) + (ch.inbound as number ?? 0),
        })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
        setChannelMix(parsed);
      } catch {
        setChannelMix([]);
      }
      setConvStats(
        cs && typeof cs === "object" && !Array.isArray(cs)
          ? (cs as Record<string, unknown>)
          : null
      );

      const raw = Array.isArray(campRes) ? campRes : [];
      const allRows: CampaignRow[] = raw
        .filter((c: unknown) => c && typeof c === "object" && (c as CampaignRow).id)
        .map((c: unknown) => {
          const r = c as CampaignRow;
          return { id: r.id, name: r.name, status: r.status, channel: r.channel, updatedAt: r.updatedAt, runs: r.runs };
        });

      const rows = allRows
        .filter((r) => isCampaignInFlight(r.status))
        .slice(0, 5);
      setInFlightCampaigns(rows);

      const recent = [...allRows]
        .sort((a, b) => {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 3);
      setRecentCampaigns(recent);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isViewer, range.start, range.end]);

  const delivery = summary?.delivery;
  const timeSeries = useMemo(() => summary?.timeSeries ?? [], [summary?.timeSeries]);
  const topCampaigns = (summary?.topCampaigns ?? []).slice(0, 4);
  const openCount = pickOpenCount(convStats);
  const usageRows = useMemo(() => usageRowsFromLimits(limits), [limits]);
  const totalInbound = useMemo(
    () => timeSeries.reduce((a, p) => a + (p.inbound ?? 0), 0),
    [timeSeries]
  );

  // Clear right panel on unmount
  useEffect(() => {
    return () => clearRightPanelContent("dashboard");
  }, [clearRightPanelContent]);

  const showCampaignInPanel = useCallback((c: CampaignRow) => {
    const rTone = campaignStatusTone(c.status);
    const latestRun = c.runs?.[0];
    const line = campaignRunSummaryLine(rTone, latestRun);
    setRightPanelContent({
      source: "dashboard",
      title: c.name,
      openAfter: true,
      content: (
        <PanelBody>
          <PanelSection label="Campaign">
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-[12.5px]">
              <div>
                <span className="op-label">ID</span>
                <p className="font-mono-op mt-1 text-[11px] tracking-wider text-base-content/60">{c.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div>
                <span className="op-label">Channel</span>
                <p className="mt-1 text-base-content">{(c.channel ?? "—").toLowerCase()}</p>
              </div>
              <div>
                <span className="op-label">Status</span>
                <p className="mt-1"><StatusTag tone={toneToTagTone(rTone)}>{normalizeStatus(c.status)}</StatusTag></p>
              </div>
              {c.updatedAt ? (
                <div>
                  <span className="op-label">Updated</span>
                  <p className="font-mono-op mt-1 tabular-nums text-base-content/70">{new Date(c.updatedAt).toLocaleString()}</p>
                </div>
              ) : null}
            </div>
          </PanelSection>
          {latestRun ? (
            <PanelSection label="Latest run">
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-[12.5px]">
                {latestRun.totalJobs != null ? (
                  <div>
                    <span className="op-label">Recipients</span>
                    <p className="font-mono-op mt-1 tabular-nums text-base-content">{latestRun.totalJobs.toLocaleString()}</p>
                  </div>
                ) : null}
                {latestRun.completedJobs != null ? (
                  <div>
                    <span className="op-label">Completed</span>
                    <p className="font-mono-op mt-1 tabular-nums text-base-content">{latestRun.completedJobs.toLocaleString()}</p>
                  </div>
                ) : null}
                {latestRun.failedJobs != null && latestRun.failedJobs > 0 ? (
                  <div>
                    <span className="op-label">Failed</span>
                    <p className="font-mono-op mt-1 tabular-nums text-error">{latestRun.failedJobs.toLocaleString()}</p>
                  </div>
                ) : null}
                {latestRun.successRate != null ? (
                  <div>
                    <span className="op-label">Success</span>
                    <p className="font-mono-op mt-1 tabular-nums text-primary">{Math.round(latestRun.successRate)}%</p>
                  </div>
                ) : null}
              </div>
              {line ? (
                <p className="font-mono-op mt-2 text-[11px] tracking-[0.04em] text-base-content/50">{line}</p>
              ) : null}
            </PanelSection>
          ) : null}
          <PanelSection noBorder>
            <Link
              href={`/campaigns?id=${c.id}`}
              className="btn btn-primary btn-sm"
            >
              Go to campaign →
            </Link>
          </PanelSection>
        </PanelBody>
      ),
    });
  }, [setRightPanelContent]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-28 rounded-box" />
          ))}
        </div>
        <div className="skeleton h-40 rounded-box" />
        <div className="skeleton h-32 rounded-box" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[22px] font-semibold tracking-[-0.025em]">{periodLabel}</h2>
          <p className="font-mono-op text-[11px] tracking-[0.04em] text-base-content/50">
            {range.start} → {range.end} · UTC
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select select-bordered select-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            aria-label="Select date range"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          {period === "custom" && (
            <>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Start date"
              />
              <span className="text-sm text-base-content/40">→</span>
              <input
                type="date"
                className="input input-bordered input-sm"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="End date"
              />
            </>
          )}
          {!isViewer ? (
            <Link href="/analytics" className="btn btn-primary btn-sm">
              Full analytics →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sent"
          value={delivery?.sent ?? "—"}
          hint="Outbound messages in range"
        />
        <KpiCard
          label="Inbound"
          value={timeSeries.length === 0 ? "—" : totalInbound}
          hint="Replies across the period"
        />
        <KpiCard
          label="Delivery rate"
          value={formatPct(delivery?.deliveryRate)}
          hint={
            <>
              {delivery?.delivered ?? 0} delivered / {delivery?.sent ?? 0} sent
              {delivery?.failed && delivery.failed > 0 ? (
                <span className="ml-1.5 text-error">{" · "}{delivery.failed.toLocaleString()} failed</span>
              ) : null}
            </>
          }
        />
        <KpiCard
          label="Read rate"
          value={formatPct(delivery?.readRate)}
          hint={`${delivery?.read ?? 0} read`}
        />
      </div>

      <div className="rounded-box border border-base-300 bg-base-200">
        <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
          <div className="flex items-baseline gap-3">
            <span className="text-[13px] font-semibold tracking-[-0.01em]">Activity</span>
            <span className="op-label">daily volume · sent vs inbound</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <LineGraph points={timeSeries} />
        </div>
      </div>

      {!isViewer ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-200">
              <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-[13px] font-semibold tracking-[-0.01em]">Operations</h3>
                  <span className="op-label">live status</span>
                </div>
              </div>
              <Link
                href="/inbox"
                className="flex items-center justify-between border-b border-base-300 px-4 py-3 transition hover:bg-base-300/40 sm:px-5"
              >
                <span className="text-[12.5px] text-base-content/70">Open conversations</span>
                <span className="font-mono-op text-[18px] font-semibold tabular-nums tracking-[-0.02em]">
                  {openCount != null ? openCount : "—"}
                </span>
              </Link>
              <Link
                href="/campaigns"
                className="flex items-center justify-between px-4 py-3 transition hover:bg-base-300/40 sm:px-5"
              >
                <span className="text-[12.5px] text-base-content/70">Active campaigns</span>
                <span className="font-mono-op text-[18px] font-semibold tabular-nums tracking-[-0.02em]">
                  {inFlightCampaigns.length}
                </span>
              </Link>
            </div>

            <div className="rounded-box border border-base-300 bg-base-200">
              <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-[13px] font-semibold tracking-[-0.01em]">Usage &amp; limits</h3>
                  <span className="op-label">current period</span>
                </div>
                <Link href="/usage" className="btn btn-ghost btn-sm">
                  Details →
                </Link>
              </div>
              {usageRows.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-base-content/55 sm:px-5">
                  Limits will appear here when your plan exposes quotas.
                </p>
              ) : (
                <div>
                  {usageRows.map((row) => (
                    <div
                      key={row.title}
                      className="border-b border-base-300 px-4 py-3 last:border-b-0 sm:px-5"
                    >
                      <QuotaBar
                        current={row.current}
                        max={row.max}
                        label={row.title}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(recentCampaigns.length > 0 || topCampaigns.length > 0 || channelMix.length > 0) ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {/* Campaigns — tabbed: Recent / Top */}
              {(recentCampaigns.length > 0 || topCampaigns.length > 0) ? (
                <div className="rounded-box border border-base-300 bg-base-200">
                  <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[13px] font-semibold tracking-[-0.01em]">Campaigns</h3>
                      <div className="flex">
                        {(["recent", "top"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            className={`relative px-2.5 py-1 font-mono-op text-[10px] tracking-[0.08em] uppercase transition-colors ${
                              campaignTab === t
                                ? "text-primary after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[2px] after:bg-primary"
                                : "text-base-content/45 hover:text-base-content"
                            }`}
                            onClick={() => setCampaignTab(t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Link href="/campaigns" className="btn btn-ghost btn-xs">All →</Link>
                  </div>

                  {campaignTab === "recent" ? (
                    <ul>
                      {recentCampaigns.map((c) => {
                        const rTone = campaignStatusTone(c.status);
                        const latestRun = c.runs?.[0];
                        const line = campaignRunSummaryLine(rTone, latestRun);
                        return (
                          <li key={c.id} className="border-b border-base-300 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => showCampaignInPanel(c)}
                              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-base-300/40"
                            >
                              <span className="font-mono-op w-[48px] shrink-0 text-[10px] tracking-wider text-base-content/40">
                                {c.id.slice(0, 6).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium transition-colors group-hover:text-primary">
                                  {c.name}
                                </span>
                                <span className="font-mono-op mt-0.5 block text-[10px] tracking-[0.04em] text-base-content/45">
                                  {(c.channel ?? "—").toLowerCase()}
                                  {line ? ` · ${line}` : ""}
                                </span>
                              </div>
                              <StatusTag tone={toneToTagTone(rTone)} className="shrink-0">
                                {normalizeStatus(c.status)}
                              </StatusTag>
                            </button>
                          </li>
                        );
                      })}
                      {recentCampaigns.length === 0 ? (
                        <p className="px-4 py-4 text-[13px] text-base-content/55">No recent campaigns.</p>
                      ) : null}
                    </ul>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="border-b border-base-300 bg-base-100">
                            <th className="op-label px-3 py-2.5 text-left font-medium">#</th>
                            <th className="op-label px-3 py-2.5 text-left font-medium">Campaign</th>
                            <th className="op-label px-3 py-2.5 text-left font-medium">Ch</th>
                            <th className="op-label px-3 py-2.5 text-right font-medium">Success</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topCampaigns.map((c, i) => {
                            const rate = c.totals?.successRate;
                            const pct = rate != null ? (rate <= 1 ? rate * 100 : rate) : null;
                            const rateColor =
                              pct == null ? "text-base-content/50" :
                              pct >= 95   ? "text-success" :
                              pct >= 85   ? "text-warning" :
                                            "text-error";
                            return (
                              <tr
                                key={c.campaignId ?? c.campaignName}
                                className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0"
                              >
                                <td className="font-mono-op px-3 py-3 text-[10px] tabular-nums text-base-content/40">
                                  {String(i + 1).padStart(2, "0")}
                                </td>
                                <td className="px-3 py-3 font-medium">
                                  {c.campaignName ?? c.campaignId ?? "—"}
                                </td>
                                <td className="font-mono-op px-3 py-3 text-[11px] text-base-content/55">
                                  {(c.channel ?? "—").toLowerCase()}
                                </td>
                                <td className={`font-mono-op px-3 py-3 text-right font-semibold tabular-nums ${rateColor}`}>
                                  {rate != null ? formatPct(rate) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                          {topCampaigns.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-[13px] text-base-content/55">
                                No campaign data for this period.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Channel mix */}
              {channelMix.length > 0 ? (
                <div className="rounded-box border border-base-300 bg-base-200">
                  <div className="border-b border-base-300 px-4 py-3">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[13px] font-semibold tracking-[-0.01em]">Channel mix</h3>
                      <span className="op-label">volume distribution</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 px-4 py-3">
                    {(() => {
                      const maxTotal = Math.max(...channelMix.map((c) => c.total), 1);
                      const grandTotal = channelMix.reduce((a, c) => a + c.total, 0);
                      return channelMix.map((ch) => {
                        const pct = grandTotal > 0 ? Math.round((ch.total / grandTotal) * 100) : 0;
                        const barWidth = Math.max(2, Math.round((ch.total / maxTotal) * 100));
                        return (
                          <div key={ch.channel}>
                            <div className="mb-1 flex items-baseline justify-between">
                              <span className="text-[12.5px] font-medium text-base-content">{ch.channel}</span>
                              <span className="font-mono-op text-[11px] tabular-nums text-base-content/55">
                                {ch.total.toLocaleString()} · {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-300">
                              <div
                                className="h-full bg-primary transition-[width] duration-300"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

        </>
      ) : null}
    </div>
  );
}
