"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  statusBadgeClasses,
  type CampaignRunSummary,
} from "@/lib/campaignUi";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";

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

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100">
      <div className="gap-1 p-4 sm:p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-base-content/60">
          {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? (
          <div className="text-xs text-base-content/50">{hint}</div>
        ) : null}
      </div>
    </div>
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


export function DashboardClient({ meRole }: { meRole: string }) {
  const isViewer = !roleHasWorkspacePermission(meRole, "contacts.create");
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { start: fmtDateInput(start), end: fmtDateInput(end) };
  }, []);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [limits, setLimits] = useState<Record<string, unknown> | null>(null);
  const [convStats, setConvStats] = useState<Record<string, unknown> | null>(null);
  const [inFlightCampaigns, setInFlightCampaigns] = useState<CampaignRow[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sum, lim, cs, campRes] = await Promise.all([
        analyticsApi.summary({ start: range.start, end: range.end }).catch(() => null),
        isViewer ? Promise.resolve(null) : usageApi.limits().catch(() => null),
        isViewer ? Promise.resolve(null) : conversationsApi.stats().catch(() => null),
        isViewer ? Promise.resolve([]) : campaignsApi.list().catch(() => []),
      ]);
      if (cancelled) return;

      setSummary((sum ?? null) as AnalyticsSummary | null);
      setLimits((lim ?? null) as Record<string, unknown> | null);
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
  const timeSeries = summary?.timeSeries ?? [];
  const topCampaigns = (summary?.topCampaigns ?? []).slice(0, 4);
  const openCount = pickOpenCount(convStats);
  const usageRows = useMemo(() => usageRowsFromLimits(limits), [limits]);
  const totalInbound = useMemo(
    () => timeSeries.reduce((a, p) => a + (p.inbound ?? 0), 0),
    [timeSeries]
  );

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Last 7 days</h2>
          <p className="text-sm text-base-content/60">
            {range.start} → {range.end} · Outcomes from your workspace analytics
          </p>
        </div>
        {!isViewer ? (
          <Link href="/analytics" className="btn btn-outline btn-sm">
            Full analytics
          </Link>
        ) : null}
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
          hint={`${delivery?.delivered ?? 0} delivered / ${delivery?.sent ?? 0} sent`}
        />
        <KpiCard
          label="Read rate"
          value={formatPct(delivery?.readRate)}
          hint={`${delivery?.read ?? 0} read`}
        />
      </div>

      <div className="rounded-box border border-base-300 bg-base-100">
        <div className="gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">Activity</span>
            <span className="text-xs text-base-content/50">Daily volume</span>
          </div>
          <LineGraph points={timeSeries} />
          {timeSeries.length > 0 ? (
            <div className="flex flex-wrap justify-between gap-1 text-xs text-base-content/60">
              {timeSeries.map((p) => (
                <span key={p.date} className="min-w-0 flex-1 truncate text-center">
                  {p.date.slice(5)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {!isViewer ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-100">
              <div className="gap-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Needs attention</h3>
                  <Link href="/inbox" className="btn btn-primary btn-sm">
                    Open inbox
                  </Link>
                </div>
                <p className="text-sm text-base-content/70">
                  {openCount != null ? (
                    <>
                      <span className="font-semibold text-base-content">{openCount}</span> open
                      conversation{openCount === 1 ? "" : "s"}
                    </>
                  ) : (
                    "Conversation stats unavailable."
                  )}
                </p>
                <div className="divider my-0" />
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-base-content/50">
                    In-flight campaigns
                  </div>
                  {inFlightCampaigns.length === 0 ? (
                    <p className="text-sm text-base-content/60">No active or paused campaigns.</p>
                  ) : (
                    <ul className="space-y-2">
                      {inFlightCampaigns.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span className="truncate font-medium">{c.name}</span>
                          <span
                            className={`badge badge-sm ${statusBadgeClasses(
                              campaignStatusTone(c.status)
                            )}`}
                          >
                            {normalizeStatus(c.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/campaigns" className="btn btn-ghost btn-sm mt-2 px-0">
                    All campaigns →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-box border border-base-300 bg-base-100">
              <div className="gap-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Usage & limits</h3>
                  <Link href="/usage" className="btn btn-ghost btn-sm">
                    Details
                  </Link>
                </div>
                {usageRows.length === 0 ? (
                  <p className="text-sm text-base-content/60">
                    Limits will appear here when your plan exposes quotas.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {usageRows.map((row) => (
                      <div key={row.title} className="space-y-1">
                        <div className="flex justify-between text-xs text-base-content/70">
                          <span>{row.title}</span>
                          <span className="tabular-nums">
                            {row.current} / {row.max}
                          </span>
                        </div>
                        <progress
                          className="progress progress-primary w-full"
                          value={Math.min(100, Math.round((row.current / row.max) * 100))}
                          max={100}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {recentCampaigns.length > 0 ? (
            <div className="rounded-box border border-base-300 bg-base-100">
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Recent campaigns</h3>
                  <Link href="/campaigns" className="btn btn-ghost btn-xs">
                    All campaigns
                  </Link>
                </div>
                <ul className="space-y-3">
                  {recentCampaigns.map((c) => {
                    const rTone = campaignStatusTone(c.status);
                    const latestRun = c.runs?.[0];
                    const line = campaignRunSummaryLine(rTone, latestRun);
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/campaigns?id=${c.id}`}
                          className="group flex items-center justify-between gap-3 rounded-btn px-2 py-1.5 -mx-2 transition hover:bg-base-200"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium truncate block group-hover:text-primary transition-colors">
                              {c.name}
                            </span>
                            <span className="text-xs text-base-content/60">
                              {c.channel ?? "\u2014"}
                              {line ? ` \u00b7 ${line}` : ""}
                            </span>
                          </div>
                          <span
                            className={`badge badge-sm shrink-0 ${statusBadgeClasses(rTone)}`}
                          >
                            {normalizeStatus(c.status)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          {topCampaigns.length > 0 ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Top campaigns (period)</h3>
                <Link href="/campaigns" className="btn btn-ghost btn-xs">
                  Campaigns
                </Link>
              </div>
              <div className="overflow-x-auto rounded-box border border-base-300">
                <table className="table table-sm">
                  <thead>
                    <tr className="border-base-300">
                      <th>Campaign</th>
                      <th>Channel</th>
                      <th className="text-right">Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map((c) => (
                      <tr key={c.campaignId ?? c.campaignName} className="border-base-300">
                        <td className="font-medium">{c.campaignName ?? c.campaignId ?? "—"}</td>
                        <td className="text-base-content/70">{c.channel ?? "—"}</td>
                        <td className="text-right tabular-nums">
                          {c.totals?.successRate != null
                            ? formatPct(c.totals.successRate)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href="/people/contacts" className="btn btn-sm btn-ghost">
              People
            </Link>
            <Link href="/templates" className="btn btn-sm btn-ghost">
              Templates
            </Link>
            <Link href="/settings/integrations" className="btn btn-sm btn-ghost">
              Integrations
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
