"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { canAccessAnalyticsNav } from "@/lib/workspace-access";
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

// ===== Types =====

type DeliveryStats = {
  total?: number;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
  pending?: number;
  deliveryRate?: number;
  readRate?: number;
  failureRate?: number;
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

// Reports-only types (ported from AnalyticsClient)
type ConversationsBreakdown = {
  total: number;
  open: number;
  closed: number;
  archived: number;
  avgResponseTimeMinutes: number | null;
};

type ContactGrowth = {
  newContacts: number;
  totalContacts: number;
  optedOut: number;
  blocked: number;
  activeContacts: number;
};

type AgentPerformance = {
  userId: string;
  email: string;
  messagesSent: number;
  conversationsAssigned: number;
  firstResponseMinutesAvg: number | null;
};

type TemplateRow = {
  templateId: string;
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

type TopCampaignReport = {
  campaignId: string;
  campaignName: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

type AgentActivityEntry = {
  action: string;
  conversationId?: string;
  contactId?: string;
  timestamp: string;
  details?: string;
};

type PeriodSummary = {
  period?: { start?: string; end?: string };
  delivery?: DeliveryStats;
};

// ===== Helpers =====

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatPct(rate: number | undefined | null): string {
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

function LineGraph({
  points,
  heightClass = "h-24",
}: {
  points: TimeSeriesPoint[];
  heightClass?: string;
}) {
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
      <div className={`flex ${heightClass} items-center justify-center rounded-box bg-base-200 text-sm text-base-content/60`}>
        No activity in this range
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`${heightClass} w-full overflow-visible`}
        aria-label="Daily message volume"
      >
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

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200 px-3 py-3 text-center">
      <div className="font-mono-op text-[1.25rem] font-semibold leading-none tabular-nums">{value}</div>
      <div className="op-label mt-1.5">{label}</div>
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

type TabKey = "now" | "overview" | "reports";

export function DashboardClient({ meRole }: { meRole: string }) {
  const isViewer = !roleHasWorkspacePermission(meRole, "contacts.create");
  const canAnalytics = canAccessAnalyticsNav(meRole);

  const [activeTab, setActiveTab] = useState<TabKey>("now");

  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const range = useMemo(
    () => rangeForPeriod(period, customStart, customEnd),
    [period, customStart, customEnd]
  );
  const periodLabel =
    PERIOD_OPTIONS.find((opt) => opt.key === period)?.label ?? "Last 7 days";

  // Now + Overview state (eager)
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [todayStats, setTodayStats] = useState<DeliveryStats | null>(null);
  const [limits, setLimits] = useState<Record<string, unknown> | null>(null);
  const [convStats, setConvStats] = useState<Record<string, unknown> | null>(null);
  const [inFlightCampaigns, setInFlightCampaigns] = useState<CampaignRow[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignRow[]>([]);
  const [channelMix, setChannelMix] = useState<Array<{ channel: string; total: number }>>([]);
  const [campaignTab, setCampaignTab] = useState<"recent" | "top">("recent");

  // Reports state (lazy)
  const [reportsLoadedFor, setReportsLoadedFor] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [conversationsBreakdown, setConversationsBreakdown] = useState<ConversationsBreakdown | null>(null);
  const [contactGrowth, setContactGrowth] = useState<ContactGrowth | null>(null);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [topCampaignsDetailed, setTopCampaignsDetailed] = useState<TopCampaignReport[]>([]);
  const [agentActivityId, setAgentActivityId] = useState<string | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivityEntry[] | null>(null);
  const [agentActivityLoading, setAgentActivityLoading] = useState(false);
  const [summaryDaily, setSummaryDaily] = useState<PeriodSummary | null>(null);
  const [summaryWeekly, setSummaryWeekly] = useState<PeriodSummary | null>(null);
  const [summaryMonthly, setSummaryMonthly] = useState<PeriodSummary | null>(null);
  const [summaryPeriodTab, setSummaryPeriodTab] = useState<"daily" | "weekly" | "monthly">("daily");

  const { setContent: setRightPanelContent, clearContent: clearRightPanelContent, close: closeRightPanel } = useRightPanel();

  // Ensure panel is closed on dashboard mount
  useEffect(() => {
    closeRightPanel();
  }, [closeRightPanel]);

  // Fetch today's stats once (period-independent — drives the Now tab)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = fmtDateInput(new Date());
      const sum = await analyticsApi
        .summary({ start: today, end: today })
        .catch(() => null);
      if (cancelled) return;
      setTodayStats((sum as AnalyticsSummary | null)?.delivery ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Eager: Now + Overview data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOverviewLoading(true);
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

      setInFlightCampaigns(
        allRows.filter((r) => isCampaignInFlight(r.status))
      );

      const recent = [...allRows]
        .sort((a, b) => {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 3);
      setRecentCampaigns(recent);
      if (!cancelled) setOverviewLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isViewer, range.start, range.end]);

  // Lazy: Reports data — loads when tab is activated, refetches on range change
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const baseParams = { start: range.start, end: range.end };
      const [conv, cont, ag, tpl, topCamp, sumDaily, sumWeekly, sumMonthly] =
        await Promise.all([
          analyticsApi.conversations(baseParams).catch(() => null),
          analyticsApi.contacts(baseParams).catch(() => null),
          analyticsApi.agents(baseParams).catch(() => []),
          analyticsApi.templates(baseParams).catch(() => []),
          analyticsApi.campaigns({ ...baseParams, limit: 10 }).catch(() => []),
          analyticsApi.summaryByPeriod("daily").catch(() => null),
          analyticsApi.summaryByPeriod("weekly").catch(() => null),
          analyticsApi.summaryByPeriod("monthly").catch(() => null),
        ]);
      setConversationsBreakdown((conv ?? null) as ConversationsBreakdown | null);
      setContactGrowth((cont ?? null) as ContactGrowth | null);
      setAgents((ag ?? []) as AgentPerformance[]);
      setTemplates((tpl ?? []) as TemplateRow[]);
      setTopCampaignsDetailed((topCamp ?? []) as TopCampaignReport[]);
      setSummaryDaily((sumDaily ?? null) as PeriodSummary | null);
      setSummaryWeekly((sumWeekly ?? null) as PeriodSummary | null);
      setSummaryMonthly((sumMonthly ?? null) as PeriodSummary | null);
      setAgentActivityId(null);
      setAgentActivity(null);
      setReportsLoadedFor(`${range.start}|${range.end}`);
    } finally {
      setReportsLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    if (activeTab !== "reports" || !canAnalytics) return;
    const key = `${range.start}|${range.end}`;
    if (reportsLoadedFor === key) return;
    void loadReports();
  }, [activeTab, canAnalytics, range.start, range.end, reportsLoadedFor, loadReports]);

  const loadAgentActivity = useCallback(async (userId: string) => {
    setAgentActivityId(userId);
    setAgentActivityLoading(true);
    setAgentActivity(null);
    try {
      const data = await analyticsApi.agentActivity(userId, { start: range.start, end: range.end });
      setAgentActivity((data ?? []) as AgentActivityEntry[]);
    } catch {
      setAgentActivity([]);
    } finally {
      setAgentActivityLoading(false);
    }
  }, [range.start, range.end]);

  // Derived
  const delivery = summary?.delivery;
  const timeSeries = useMemo(() => summary?.timeSeries ?? [], [summary?.timeSeries]);
  const topCampaigns = (summary?.topCampaigns ?? []).slice(0, 4);
  const openCount = pickOpenCount(convStats);
  const usageRows = useMemo(() => usageRowsFromLimits(limits), [limits]);
  const totalInbound = useMemo(
    () => timeSeries.reduce((a, p) => a + (p.inbound ?? 0), 0),
    [timeSeries]
  );

  const activeSummary =
    summaryPeriodTab === "daily" ? summaryDaily : summaryPeriodTab === "weekly" ? summaryWeekly : summaryMonthly;

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
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-[0.78125rem]">
              <div>
                <span className="op-label">ID</span>
                <p className="font-mono-op mt-1 text-[0.6875rem] tracking-wider text-base-content/60">{c.id.slice(0, 8).toUpperCase()}</p>
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
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-[0.78125rem]">
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
                <p className="font-mono-op mt-2 text-[0.6875rem] tracking-[0.04em] text-base-content/50">{line}</p>
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

  const exportSummaryCsv = useCallback(() => {
    void analyticsApi
      .exportCsv({ type: "summary", start: range.start, end: range.end })
      .catch(() => undefined);
  }, [range.start, range.end]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "now", label: "Now" },
    { key: "overview", label: "Overview" },
    ...(canAnalytics ? [{ key: "reports" as const, label: "Reports" }] : []),
  ];

  // ===== Reusable card fragments =====

  const channelMixCard = channelMix.length > 0 ? (
    <div className="rounded-box border border-base-300 bg-base-200">
      <div className="border-b border-base-300 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Channel mix</h3>
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
                  <span className="text-[0.78125rem] font-medium text-base-content">{ch.channel}</span>
                  <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
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
  ) : null;

  return (
    <div className="space-y-4">
      {/* ===== Sticky tab bar ===== */}
      <div className="sticky top-0 z-10 -mx-1 bg-base-100 pb-1">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-base-300 px-1">
          <div className="flex" role="tablist" aria-label="Dashboard sections">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative px-3 py-2.5 text-[0.8125rem] font-medium tracking-tight transition-colors ${
                  activeTab === t.key
                    ? "text-primary after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[2px] after:bg-primary"
                    : "text-base-content/55 hover:text-base-content"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {activeTab !== "now" ? (
            <div className="flex items-center gap-2 shrink-0 pb-2">
              <select
                className="select select-bordered select-sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                aria-label="Select date range"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              {activeTab === "reports" && canAnalytics ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline whitespace-nowrap"
                  onClick={exportSummaryCsv}
                  disabled={reportsLoading}
                >
                  Export CSV
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {activeTab !== "now" && period === "custom" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
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
          </div>
        ) : null}
      </div>

      {/* ===== NOW TAB ===== */}
      {activeTab === "now" ? (
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Live now</h2>
            <span className="op-label">workspace state · today</span>
          </div>
          <div className={`grid gap-3 sm:grid-cols-2 ${isViewer ? "" : "xl:grid-cols-4"}`}>
            {!isViewer ? (
              <>
                <Link href="/inbox" className="group block">
                  <KpiCard
                    label="Open conversations"
                    value={openCount ?? "—"}
                    hint={<span className="transition-colors group-hover:text-primary">Open inbox →</span>}
                    className="transition-colors group-hover:border-primary/40"
                  />
                </Link>
                <Link href="/campaigns" className="group block">
                  <KpiCard
                    label="Active campaigns"
                    value={inFlightCampaigns.length}
                    hint={<span className="transition-colors group-hover:text-primary">View campaigns →</span>}
                    className="transition-colors group-hover:border-primary/40"
                  />
                </Link>
              </>
            ) : null}
            <KpiCard
              label="Sent today"
              value={todayStats?.sent ?? "—"}
              hint="Outbound messages since 00:00 UTC"
            />
            <KpiCard
              label="Failed today"
              value={todayStats?.failed ?? "—"}
              hint={
                todayStats?.failed && todayStats.failed > 0 ? (
                  <span className="text-error">Needs review</span>
                ) : (
                  "No delivery failures"
                )
              }
            />
          </div>
        </section>
      ) : null}

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === "overview" ? (
        <section className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="op-label">in range</span>
            <span className="text-[0.8125rem] font-semibold tracking-[-0.01em]">{periodLabel}</span>
            <span className="font-mono-op text-[0.6875rem] tracking-[0.04em] text-base-content/50">
              · {range.start} → {range.end} · UTC
            </span>
          </div>

          {overviewLoading ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-28 rounded-box" />
                ))}
              </div>
              <div className="skeleton h-40 rounded-box" />
              <div className="skeleton h-32 rounded-box" />
            </div>
          ) : (
            <>
              {/* KPIs (2x2) + Activity chart side-by-side at xl */}
              <div className="grid gap-3 xl:grid-cols-5">
                <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                  <KpiCard
                    label="Sent"
                    value={delivery?.sent ?? "—"}
                    hint="Outbound"
                  />
                  <KpiCard
                    label="Inbound"
                    value={timeSeries.length === 0 ? "—" : totalInbound}
                    hint="Replies"
                  />
                  <KpiCard
                    label="Delivery rate"
                    value={formatPct(delivery?.deliveryRate)}
                    hint={
                      <>
                        {delivery?.delivered ?? 0} / {delivery?.sent ?? 0}
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
                <div className="flex flex-col rounded-box border border-base-300 bg-base-200 xl:col-span-3">
                  <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Activity</span>
                      <span className="op-label">daily volume · sent vs inbound</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                    <LineGraph points={timeSeries} heightClass="h-40 xl:h-56" />
                  </div>
                </div>
              </div>

              {/* Bottom grid: Campaigns / Channel mix / Usage */}
              {!isViewer ? (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {(recentCampaigns.length > 0 || topCampaigns.length > 0) ? (
                    <div className="rounded-box border border-base-300 bg-base-200">
                      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Campaigns</h3>
                          <div className="flex">
                            {(["recent", "top"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                className={`relative px-2.5 py-1 font-mono-op text-[0.625rem] tracking-[0.08em] uppercase transition-colors ${
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
                                  <span className="font-mono-op w-[48px] shrink-0 text-[0.625rem] tracking-wider text-base-content/40">
                                    {c.id.slice(0, 6).toUpperCase()}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-[0.8125rem] font-medium transition-colors group-hover:text-primary">
                                      {c.name}
                                    </span>
                                    <span className="font-mono-op mt-0.5 block text-[0.625rem] tracking-[0.04em] text-base-content/45">
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
                            <p className="px-4 py-4 text-[0.8125rem] text-base-content/55">No recent campaigns.</p>
                          ) : null}
                        </ul>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[0.78125rem]">
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
                                    <td className="font-mono-op px-3 py-3 text-[0.625rem] tabular-nums text-base-content/40">
                                      {String(i + 1).padStart(2, "0")}
                                    </td>
                                    <td className="px-3 py-3 font-medium">
                                      {c.campaignName ?? c.campaignId ?? "—"}
                                    </td>
                                    <td className="font-mono-op px-3 py-3 text-[0.6875rem] text-base-content/55">
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
                                  <td colSpan={4} className="px-3 py-4 text-center text-[0.8125rem] text-base-content/55">
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

                  {channelMixCard}

                  <div className="rounded-box border border-base-300 bg-base-200">
                    <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                      <div className="flex items-baseline gap-3">
                        <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Usage &amp; limits</h3>
                        <span className="op-label">current period</span>
                      </div>
                      <Link href="/usage" className="btn btn-ghost btn-sm">
                        Details →
                      </Link>
                    </div>
                    {usageRows.length === 0 ? (
                      <p className="px-4 py-4 text-[0.8125rem] text-base-content/55 sm:px-5">
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
              ) : (
                channelMixCard
              )}
            </>
          )}
        </section>
      ) : null}

      {/* ===== REPORTS TAB ===== */}
      {activeTab === "reports" && canAnalytics ? (
        <section className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="op-label">reports · in range</span>
            <span className="text-[0.8125rem] font-semibold tracking-[-0.01em]">{periodLabel}</span>
            <span className="font-mono-op text-[0.6875rem] tracking-[0.04em] text-base-content/50">
              · {range.start} → {range.end} · UTC
            </span>
          </div>

          {reportsLoading && reportsLoadedFor !== `${range.start}|${range.end}` ? (
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="skeleton h-48 rounded-box" />
                <div className="skeleton h-48 rounded-box" />
              </div>
              <div className="skeleton h-56 rounded-box" />
              <div className="skeleton h-40 rounded-box" />
              <div className="skeleton h-40 rounded-box" />
              <div className="skeleton h-48 rounded-box" />
            </div>
          ) : (
            <>
              {/* Conversations + Contact growth */}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-box border border-base-300 bg-base-200">
                  <div className="border-b border-base-300 px-4 py-3 sm:px-5">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Conversations</h3>
                      <span className="op-label">period totals</span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    {conversationsBreakdown ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <MiniStat label="Total" value={conversationsBreakdown.total} />
                          <MiniStat label="Open" value={conversationsBreakdown.open} />
                          <MiniStat label="Closed" value={conversationsBreakdown.closed} />
                          <MiniStat label="Archived" value={conversationsBreakdown.archived} />
                        </div>
                        <div className="rounded-box border border-base-300 bg-base-100 px-3 py-2 text-[0.78125rem] text-base-content/70">
                          Avg first response:{" "}
                          <span className="font-mono-op tabular-nums font-semibold text-base-content">
                            {conversationsBreakdown.avgResponseTimeMinutes != null
                              ? `${conversationsBreakdown.avgResponseTimeMinutes.toFixed(1)} min`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[0.8125rem] text-base-content/55">No conversation data.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-box border border-base-300 bg-base-200">
                  <div className="border-b border-base-300 px-4 py-3 sm:px-5">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Contact growth</h3>
                      <span className="op-label">in period</span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    {contactGrowth ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <MiniStat label="New" value={contactGrowth.newContacts} />
                          <MiniStat label="Total" value={contactGrowth.totalContacts} />
                          <MiniStat label="Active" value={contactGrowth.activeContacts} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 text-[0.78125rem] text-base-content/65">
                          <span>Opted out: <span className="font-mono-op tabular-nums text-base-content">{contactGrowth.optedOut}</span></span>
                          <span>Blocked: <span className="font-mono-op tabular-nums text-base-content">{contactGrowth.blocked}</span></span>
                        </div>
                        {contactGrowth.totalContacts > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[0.6875rem] text-base-content/65">
                              <span className="op-label">Active rate</span>
                              <span className="font-mono-op tabular-nums">
                                {Math.round((contactGrowth.activeContacts / contactGrowth.totalContacts) * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-base-300">
                              <div
                                className="h-full bg-primary transition-[width] duration-300"
                                style={{ width: `${Math.round((contactGrowth.activeContacts / contactGrowth.totalContacts) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-[0.8125rem] text-base-content/55">No contact data.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Agent performance */}
              <div className="rounded-box border border-base-300 bg-base-200">
                <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Agent performance</h3>
                    <span className="op-label">click row for activity</span>
                  </div>
                </div>
                {agents.length === 0 ? (
                  <p className="px-4 py-4 text-[0.8125rem] text-base-content/55 sm:px-5">No agent data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.78125rem]">
                      <thead>
                        <tr className="border-b border-base-300 bg-base-100">
                          <th className="op-label px-3 py-2.5 text-left font-medium">Agent</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Sent</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Conversations</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Avg response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((agent) => {
                          const selected = agentActivityId === agent.userId;
                          return (
                            <tr
                              key={agent.userId}
                              className={`cursor-pointer border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0 ${
                                selected ? "bg-base-300/30" : ""
                              }`}
                              onClick={() => void loadAgentActivity(agent.userId)}
                            >
                              <td className="px-3 py-3 font-medium">
                                {agent.email}
                                {selected ? (
                                  <span className="ml-1.5 op-label text-primary">selected</span>
                                ) : null}
                              </td>
                              <td className="font-mono-op px-3 py-3 text-right tabular-nums">{agent.messagesSent}</td>
                              <td className="font-mono-op px-3 py-3 text-right tabular-nums">{agent.conversationsAssigned}</td>
                              <td className="font-mono-op px-3 py-3 text-right tabular-nums">
                                {agent.firstResponseMinutesAvg != null
                                  ? `${agent.firstResponseMinutesAvg.toFixed(1)} min`
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Agent activity drill-down */}
              {agentActivityId ? (
                <div className="rounded-box border border-base-300 bg-base-200">
                  <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Agent activity</h3>
                      <span className="op-label">
                        {agents.find((a) => a.userId === agentActivityId)?.email ?? agentActivityId}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => { setAgentActivityId(null); setAgentActivity(null); }}
                    >
                      Close
                    </button>
                  </div>
                  {agentActivityLoading ? (
                    <div className="flex justify-center py-6">
                      <span className="loading loading-spinner" />
                    </div>
                  ) : !agentActivity?.length ? (
                    <p className="px-4 py-4 text-[0.8125rem] text-base-content/55 sm:px-5">No activity data for this agent in the selected period.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-[0.78125rem]">
                        <thead className="sticky top-0 bg-base-100">
                          <tr className="border-b border-base-300">
                            <th className="op-label px-3 py-2 text-left font-medium">Action</th>
                            <th className="op-label px-3 py-2 text-left font-medium">Details</th>
                            <th className="op-label px-3 py-2 text-left font-medium">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentActivity.map((entry, i) => (
                            <tr key={i} className="border-b border-base-300 last:border-b-0">
                              <td className="px-3 py-2 font-medium">{entry.action}</td>
                              <td className="max-w-xs truncate px-3 py-2 text-base-content/70">{entry.details ?? "—"}</td>
                              <td className="font-mono-op px-3 py-2 tabular-nums text-base-content/55">
                                {new Date(entry.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Top campaigns (detailed) */}
              <div className="rounded-box border border-base-300 bg-base-200">
                <div className="border-b border-base-300 px-4 py-3 sm:px-5">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Top campaigns</h3>
                    <span className="op-label">delivery breakdown</span>
                  </div>
                </div>
                {topCampaignsDetailed.length === 0 ? (
                  <p className="px-4 py-4 text-[0.8125rem] text-base-content/55 sm:px-5">No campaign data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.78125rem]">
                      <thead>
                        <tr className="border-b border-base-300 bg-base-100">
                          <th className="op-label px-3 py-2.5 text-left font-medium">Campaign</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Sent</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Delivered</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Read</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Failed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topCampaignsDetailed.map((c) => (
                          <tr key={c.campaignId} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                            <td className="px-3 py-3 font-medium">{c.campaignName}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">{c.sent}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">{c.delivered}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">{c.read}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">
                              {c.failed > 0 ? (
                                <span className="text-error">{c.failed}</span>
                              ) : (
                                c.failed
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Template analytics */}
              <div className="rounded-box border border-base-300 bg-base-200">
                <div className="border-b border-base-300 px-4 py-3 sm:px-5">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Template analytics</h3>
                    <span className="op-label">delivery by template</span>
                  </div>
                </div>
                {templates.length === 0 ? (
                  <p className="px-4 py-4 text-[0.8125rem] text-base-content/55 sm:px-5">No template data for this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.78125rem]">
                      <thead>
                        <tr className="border-b border-base-300 bg-base-100">
                          <th className="op-label px-3 py-2.5 text-left font-medium">Template</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Sent</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Delivered</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Read</th>
                          <th className="op-label px-3 py-2.5 text-right font-medium">Failed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.map((tpl) => (
                          <tr key={tpl.templateId} className="border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0">
                            <td className="px-3 py-3 font-medium">{tpl.templateName}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">{tpl.sent}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">{tpl.delivered}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">{tpl.read}</td>
                            <td className="font-mono-op px-3 py-3 text-right tabular-nums">
                              {tpl.failed > 0 ? (
                                <span className="text-error">{tpl.failed}</span>
                              ) : (
                                tpl.failed
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Period summary tabs */}
              <div className="rounded-box border border-base-300 bg-base-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-4 py-3 sm:px-5">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">Period summary</h3>
                    <span className="op-label">aggregated buckets</span>
                  </div>
                  <div className="flex" role="tablist">
                    {(["daily", "weekly", "monthly"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={summaryPeriodTab === t}
                        onClick={() => setSummaryPeriodTab(t)}
                        className={`relative px-2.5 py-1 font-mono-op text-[0.625rem] tracking-[0.08em] uppercase transition-colors ${
                          summaryPeriodTab === t
                            ? "text-primary after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[2px] after:bg-primary"
                            : "text-base-content/45 hover:text-base-content"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  {activeSummary?.delivery ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniStat label="Sent" value={activeSummary.delivery.sent ?? 0} />
                        <MiniStat label="Delivered" value={activeSummary.delivery.delivered ?? 0} />
                        <MiniStat label="Read" value={activeSummary.delivery.read ?? 0} />
                        <MiniStat label="Failed" value={activeSummary.delivery.failed ?? 0} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-[0.6875rem]">
                        <span className="rounded-[3px] border border-success/40 px-1.5 py-[1px] text-success">
                          Delivery {formatPct(activeSummary.delivery.deliveryRate)}
                        </span>
                        <span className="rounded-[3px] border border-info/40 px-1.5 py-[1px] text-info">
                          Read {formatPct(activeSummary.delivery.readRate)}
                        </span>
                        {(activeSummary.delivery.failureRate ?? 0) > 0 ? (
                          <span className="rounded-[3px] border border-error/40 px-1.5 py-[1px] text-error">
                            Failure {formatPct(activeSummary.delivery.failureRate)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-base-content/55">No data for this period.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
