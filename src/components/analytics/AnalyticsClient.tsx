"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "@/lib/api";

// ========== Types matching backend DTOs ==========

type DeliveryStats = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
};

type ChannelStats = {
  channel: string;
  outbound: DeliveryStats;
  inbound: number;
};

type TimeseriesPoint = {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  inbound: number;
};

type ConversationStats = {
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

type TemplateAnalyticsRow = {
  templateId: string;
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

type TopCampaignRow = {
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
  period: { start: string; end: string };
  delivery: DeliveryStats;
  byChannel: ChannelStats[];
  topCampaigns: unknown[];
  timeSeries: TimeseriesPoint[];
};

type Summary = {
  totalMessages?: number;
  messagesSent?: number;
  messagesReceived?: number;
  deliveryRate?: number;
  readRate?: number;
  totalConversations?: number;
  activeConversations?: number;
};

// ========== Helpers ==========

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Failed to load analytics.";
}

function formatPct(rate: number | undefined | null): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  const p = rate <= 1 ? rate * 100 : rate;
  return `${p.toFixed(1)}%`;
}

// ========== Reusable components ==========

function KpiCard({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value ?? "—"}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-base-content/60">{label}</div>
    </div>
  );
}

function LineGraph({ points }: { points: TimeseriesPoint[] }) {
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
      <div className="flex h-24 items-center justify-center rounded-box bg-base-300/30 text-sm text-base-content/60">
        No activity in this range
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-32 w-full overflow-visible"
        aria-label="Message volume over time"
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
          <path d={paths.sentArea} style={{ fill: "oklch(var(--p) / 0.12)" }} />
        )}
        {paths?.inboundArea && (
          <path d={paths.inboundArea} style={{ fill: "oklch(var(--s) / 0.12)" }} />
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
      {n > 0 && (
        <div className="flex flex-wrap justify-between gap-1 text-xs text-base-content/60">
          {points.map((p) => (
            <span key={p.date} className="min-w-0 flex-1 truncate text-center">
              {p.date.slice(5)}
            </span>
          ))}
        </div>
      )}
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

// ========== Main Component ==========

export function AnalyticsClient() {
  const today = useMemo(() => new Date(), []);
  const thirtyAgo = useMemo(
    () => new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
    [today]
  );
  const [start, setStart] = useState(fmtDateInput(thirtyAgo));
  const [end, setEnd] = useState(fmtDateInput(today));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<Summary>({});
  const [delivery, setDelivery] = useState<DeliveryStats | null>(null);
  const [channels, setChannels] = useState<ChannelStats[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [conversations, setConversations] = useState<ConversationStats | null>(null);
  const [contacts, setContacts] = useState<ContactGrowth | null>(null);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [templates, setTemplates] = useState<TemplateAnalyticsRow[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaignRow[]>([]);
  const [agentActivityId, setAgentActivityId] = useState<string | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivityEntry[] | null>(null);
  const [agentActivityLoading, setAgentActivityLoading] = useState(false);
  const [summaryDaily, setSummaryDaily] = useState<PeriodSummary | null>(null);
  const [summaryWeekly, setSummaryWeekly] = useState<PeriodSummary | null>(null);
  const [summaryMonthly, setSummaryMonthly] = useState<PeriodSummary | null>(null);
  const [periodTab, setPeriodTab] = useState<"daily" | "weekly" | "monthly">("daily");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseParams = { start, end };
      const [s, d, c, t, conv, cont, ag, tpl, topCamp, sumDaily, sumWeekly, sumMonthly] =
        await Promise.all([
          analyticsApi.summary(baseParams),
          analyticsApi.delivery(baseParams),
          analyticsApi.channels(baseParams),
          analyticsApi.timeseries(baseParams),
          analyticsApi.conversations(baseParams),
          analyticsApi.contacts(baseParams),
          analyticsApi.agents(baseParams),
          analyticsApi.templates(baseParams),
          analyticsApi.campaigns({ ...baseParams, limit: 10 }),
          analyticsApi.summaryByPeriod("daily"),
          analyticsApi.summaryByPeriod("weekly"),
          analyticsApi.summaryByPeriod("monthly"),
        ]);
      setSummary((s ?? {}) as Summary);
      setDelivery((d ?? null) as DeliveryStats | null);
      setChannels((c ?? []) as ChannelStats[]);
      setTimeseries((t ?? []) as TimeseriesPoint[]);
      setConversations((conv ?? null) as ConversationStats | null);
      setContacts((cont ?? null) as ContactGrowth | null);
      setAgents((ag ?? []) as AgentPerformance[]);
      setTemplates((tpl ?? []) as TemplateAnalyticsRow[]);
      setTopCampaigns((topCamp ?? []) as TopCampaignRow[]);
      setAgentActivityId(null);
      setAgentActivity(null);
      setSummaryDaily((sumDaily ?? null) as PeriodSummary | null);
      setSummaryWeekly((sumWeekly ?? null) as PeriodSummary | null);
      setSummaryMonthly((sumMonthly ?? null) as PeriodSummary | null);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAgentActivity = async (userId: string) => {
    setAgentActivityId(userId);
    setAgentActivityLoading(true);
    setAgentActivity(null);
    try {
      const data = await analyticsApi.agentActivity(userId, { start, end });
      setAgentActivity((data ?? []) as AgentActivityEntry[]);
    } catch {
      setAgentActivity([]);
    } finally {
      setAgentActivityLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePeriod =
    periodTab === "daily" ? summaryDaily : periodTab === "weekly" ? summaryWeekly : summaryMonthly;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="form-control">
            <span className="label-text text-xs">Start</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">End</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading\u2026" : "Apply"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => void analyticsApi.exportCsv({ type: "summary", start, end })}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total messages" value={summary.totalMessages} />
        <KpiCard label="Sent" value={summary.messagesSent} />
        <KpiCard label="Received" value={summary.messagesReceived} />
        <KpiCard label="Delivery rate" value={formatPct(summary.deliveryRate)} />
        <KpiCard label="Read rate" value={formatPct(summary.readRate)} />
        <KpiCard label="Conversations" value={summary.totalConversations} />
        <KpiCard label="Active conv." value={summary.activeConversations} />
        <KpiCard label="Failed" value={delivery?.failed} />
      </div>

      {/* Message volume + Channel mix */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Message volume</h2>
            <LineGraph points={timeseries} />
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Channel mix</h2>
            <div className="mt-2 space-y-3">
              {channels.length === 0 ? (
                <p className="text-sm text-base-content/60">No channel data for this period.</p>
              ) : (
                channels.map((ch) => (
                  <div key={ch.channel} className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ch.channel}</span>
                      <span className="badge badge-ghost badge-sm">
                        {ch.outbound.sent + ch.inbound} total
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-base-content/70">
                        <span>Delivery</span>
                        <span>{formatPct(ch.outbound.deliveryRate)}</span>
                      </div>
                      <progress
                        className="progress progress-primary h-1.5 w-full"
                        value={Math.min(100, Math.round((ch.outbound.deliveryRate <= 1 ? ch.outbound.deliveryRate * 100 : ch.outbound.deliveryRate)))}
                        max={100}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-base-content/70">
                        <span>Read</span>
                        <span>{formatPct(ch.outbound.readRate)}</span>
                      </div>
                      <progress
                        className="progress progress-secondary h-1.5 w-full"
                        value={Math.min(100, Math.round((ch.outbound.readRate <= 1 ? ch.outbound.readRate * 100 : ch.outbound.readRate)))}
                        max={100}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-base-content/60">
                      <span>Sent: {ch.outbound.sent}</span>
                      <span>Inbound: {ch.inbound}</span>
                      {ch.outbound.failed > 0 && (
                        <span className="text-error">Failed: {ch.outbound.failed}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conversations + Contacts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Conversations</h2>
            {conversations ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Total" value={conversations.total} />
                  <MiniStat label="Open" value={conversations.open} />
                  <MiniStat label="Closed" value={conversations.closed} />
                  <MiniStat label="Archived" value={conversations.archived} />
                </div>
                <div className="rounded-box bg-base-300/30 px-3 py-2 text-sm text-base-content/70">
                  Avg first response:{" "}
                  <span className="font-semibold text-base-content">
                    {conversations.avgResponseTimeMinutes != null
                      ? `${conversations.avgResponseTimeMinutes.toFixed(1)} min`
                      : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-base-content/60">No conversation data.</p>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Contact growth</h2>
            {contacts ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="New (period)" value={contacts.newContacts} />
                  <MiniStat label="Total" value={contacts.totalContacts} />
                  <MiniStat label="Active" value={contacts.activeContacts} />
                </div>
                <div className="flex flex-wrap gap-x-4 text-sm text-base-content/60">
                  <span>Opted out: {contacts.optedOut}</span>
                  <span>Blocked: {contacts.blocked}</span>
                </div>
                {contacts.totalContacts > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-base-content/70">
                      <span>Active rate</span>
                      <span>
                        {Math.round((contacts.activeContacts / contacts.totalContacts) * 100)}%
                      </span>
                    </div>
                    <progress
                      className="progress progress-success h-2 w-full"
                      value={Math.round((contacts.activeContacts / contacts.totalContacts) * 100)}
                      max={100}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-base-content/60">No contact data.</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Agent performance</h2>
          {agents.length === 0 ? (
            <p className="text-sm text-base-content/60">No agent data for this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr className="border-base-300">
                    <th>Agent</th>
                    <th className="text-right">Messages sent</th>
                    <th className="text-right">Conversations</th>
                    <th className="text-right">Avg response</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr
                      key={agent.userId}
                      className="border-base-300 cursor-pointer hover:bg-base-200/60"
                      onClick={() => void loadAgentActivity(agent.userId)}
                    >
                      <td className="font-medium">
                        {agent.email}
                        {agentActivityId === agent.userId && (
                          <span className="ml-1 text-xs text-primary">(selected)</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{agent.messagesSent}</td>
                      <td className="text-right tabular-nums">{agent.conversationsAssigned}</td>
                      <td className="text-right tabular-nums">
                        {agent.firstResponseMinutesAvg != null
                          ? `${agent.firstResponseMinutesAvg.toFixed(1)} min`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Agent Activity Drill-down */}
      {agentActivityId && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">
                Agent activity
                <span className="text-sm font-normal text-base-content/60">
                  {agents.find((a) => a.userId === agentActivityId)?.email ?? agentActivityId}
                </span>
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => { setAgentActivityId(null); setAgentActivity(null); }}
              >
                Close
              </button>
            </div>
            {agentActivityLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner" />
              </div>
            ) : !agentActivity?.length ? (
              <p className="text-sm text-base-content/60">No activity data for this agent in the selected period.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-box border border-base-300">
                <table className="table table-xs">
                  <thead>
                    <tr className="border-base-300">
                      <th>Action</th>
                      <th>Details</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentActivity.map((entry, i) => (
                      <tr key={i} className="border-base-300">
                        <td className="font-medium">{entry.action}</td>
                        <td className="max-w-xs truncate text-base-content/70">{entry.details ?? "—"}</td>
                        <td className="tabular-nums text-base-content/60">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Campaigns */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Top campaigns</h2>
          {topCampaigns.length === 0 ? (
            <p className="text-sm text-base-content/60">No campaign data for this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr className="border-base-300">
                    <th>Campaign</th>
                    <th className="text-right">Sent</th>
                    <th className="text-right">Delivered</th>
                    <th className="text-right">Read</th>
                    <th className="text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((c) => (
                    <tr key={c.campaignId} className="border-base-300">
                      <td className="font-medium">{c.campaignName}</td>
                      <td className="text-right tabular-nums">{c.sent}</td>
                      <td className="text-right tabular-nums">{c.delivered}</td>
                      <td className="text-right tabular-nums">{c.read}</td>
                      <td className="text-right tabular-nums">
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
      </div>

      {/* Template Analytics */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Template analytics</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-base-content/60">No template data for this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm">
                <thead>
                  <tr className="border-base-300">
                    <th>Template</th>
                    <th className="text-right">Sent</th>
                    <th className="text-right">Delivered</th>
                    <th className="text-right">Read</th>
                    <th className="text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.templateId} className="border-base-300">
                      <td className="font-medium">{tpl.templateName}</td>
                      <td className="text-right tabular-nums">{tpl.sent}</td>
                      <td className="text-right tabular-nums">{tpl.delivered}</td>
                      <td className="text-right tabular-nums">{tpl.read}</td>
                      <td className="text-right tabular-nums">
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
      </div>

      {/* Period Summary (tabbed) */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">Period summary</h2>
          <div role="tablist" className="tabs tabs-bordered">
            <button
              type="button"
              role="tab"
              className={`tab ${periodTab === "daily" ? "tab-active" : ""}`}
              onClick={() => setPeriodTab("daily")}
            >
              Daily
            </button>
            <button
              type="button"
              role="tab"
              className={`tab ${periodTab === "weekly" ? "tab-active" : ""}`}
              onClick={() => setPeriodTab("weekly")}
            >
              Weekly
            </button>
            <button
              type="button"
              role="tab"
              className={`tab ${periodTab === "monthly" ? "tab-active" : ""}`}
              onClick={() => setPeriodTab("monthly")}
            >
              Monthly
            </button>
          </div>
          {activePeriod?.delivery ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Sent" value={activePeriod.delivery.sent} />
                <MiniStat label="Delivered" value={activePeriod.delivery.delivered} />
                <MiniStat label="Read" value={activePeriod.delivery.read} />
                <MiniStat label="Failed" value={activePeriod.delivery.failed} />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-primary badge-outline">
                  Delivery: {formatPct(activePeriod.delivery.deliveryRate)}
                </span>
                <span className="badge badge-secondary badge-outline">
                  Read: {formatPct(activePeriod.delivery.readRate)}
                </span>
                {activePeriod.delivery.failureRate > 0 && (
                  <span className="badge badge-error badge-outline">
                    Failure: {formatPct(activePeriod.delivery.failureRate)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-base-content/60">No data for this period.</p>
          )}
        </div>
      </div>
    </div>
  );
}
