"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { analyticsApi, campaignsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";

// ========== Types ==========

type SummaryStats = {
  totalContacts: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  replied: number;
};

type FunnelStage = { stage: string; count: number; pct: number };
type FailureRow = { reason: string; count: number };
type Engagement = { deliveryRate: number; readRate: number; replyRate: number };
type TimelinePoint = { date: string; sent: number; delivered: number; replied: number };
type AgentMetric = {
  userId: string;
  email: string;
  repliesHandled: number;
  avgResponseMinutes: number | null;
};
type CostData = {
  totalCost: number;
  costPerMessage: number;
  costPerReply: number;
  currency: string;
};
type RunReport = {
  runId: string;
  runNumber: number;
  status: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  skippedJobs: number;
  successRate: number;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMinutes?: number | null;
};

type DetailedReport = {
  summary: SummaryStats;
  funnel: FunnelStage[];
  failures: FailureRow[];
  engagement: Engagement;
  timeline: TimelinePoint[];
  agents: AgentMetric[];
  cost: CostData | null;
  runs: RunReport[];
};

type ContactRow = {
  jobId: string;
  contactId: string;
  jobStatus: string;
  lastError: string | null;
  contact: { id: string; phone: string; name: string | null; email: string | null };
  message: {
    id: string;
    status: string;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    failedAt: string | null;
    conversationId: string | null;
  } | null;
};

// ========== Sub-components ==========

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "error" | "warning" | "info";
}) {
  const cls =
    accent === "success"
      ? "text-success"
      : accent === "error"
        ? "text-error"
        : accent === "warning"
          ? "text-warning"
          : accent === "info"
            ? "text-info"
            : "text-base-content";
  return (
    <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold tracking-tight text-base-content">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-sm text-base-content/65">{description}</p>
      ) : null}
    </div>
  );
}

function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={s.stage} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-right text-sm font-medium text-base-content/70">
            {s.stage}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="relative h-7 flex-1 overflow-hidden rounded-btn bg-base-200">
                <div
                  className="absolute inset-y-0 left-0 rounded-btn transition-all"
                  style={{
                    width: `${Math.max(1, (s.count / maxCount) * 100)}%`,
                    backgroundColor:
                      i === 0
                        ? "oklch(var(--p))"
                        : i === 1
                          ? "oklch(var(--su))"
                          : i === 2
                            ? "oklch(var(--in))"
                            : "oklch(var(--s))",
                    opacity: 0.75,
                  }}
                />
                <span className="relative z-10 flex h-full items-center px-3 text-xs font-semibold tabular-nums">
                  {s.count.toLocaleString()}
                </span>
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-base-content/60">
                {s.pct}%
              </span>
            </div>
          </div>
          {i < stages.length - 1 ? (
            <span className="text-base-content/30 text-xs">&#x2193;</span>
          ) : (
            <span className="w-3" />
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineChart({ points }: { points: TimelinePoint[] }) {
  const n = points.length;
  if (n === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-box bg-base-200 text-sm text-base-content/60">
        No timeline data
      </div>
    );
  }

  const TOP = 8;
  const BOTTOM = 92;
  const maxVal = Math.max(1, ...points.flatMap((p) => [p.sent, p.delivered, p.replied]));
  const toX = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const toY = (v: number) => BOTTOM - (v / maxVal) * (BOTTOM - TOP);
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(2)},${toY(v).toFixed(2)}`).join(" ");

  const sentVals = points.map((p) => p.sent);
  const deliveredVals = points.map((p) => p.delivered);
  const repliedVals = points.map((p) => p.replied);

  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-28 w-full overflow-visible"
        aria-label="Campaign timeline"
      >
        {[8, 50, 92].map((y) => (
          <line
            key={y}
            x1="0" y1={y} x2="100" y2={y}
            stroke="currentColor" strokeOpacity="0.08"
            style={{ vectorEffect: "non-scaling-stroke" } as React.CSSProperties}
            strokeWidth="0.8"
          />
        ))}
        {n > 1 ? (
          <>
            <path d={line(sentVals)} fill="none" style={{ stroke: "oklch(var(--p))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties} strokeWidth="1.5" strokeLinejoin="round" />
            <path d={line(deliveredVals)} fill="none" style={{ stroke: "oklch(var(--su))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties} strokeWidth="1.5" strokeLinejoin="round" />
            <path d={line(repliedVals)} fill="none" style={{ stroke: "oklch(var(--s))", vectorEffect: "non-scaling-stroke" } as React.CSSProperties} strokeWidth="1.5" strokeLinejoin="round" />
          </>
        ) : null}
        {sentVals.map((v, i) => (
          <circle key={`s${i}`} cx={toX(i)} cy={toY(v)} r="1.2" style={{ fill: "oklch(var(--p))" }}>
            <title>{points[i].date}: {v} sent</title>
          </circle>
        ))}
        {deliveredVals.map((v, i) => (
          <circle key={`d${i}`} cx={toX(i)} cy={toY(v)} r="1.2" style={{ fill: "oklch(var(--su))" }}>
            <title>{points[i].date}: {v} delivered</title>
          </circle>
        ))}
        {repliedVals.map((v, i) => (
          <circle key={`r${i}`} cx={toX(i)} cy={toY(v)} r="1.2" style={{ fill: "oklch(var(--s))" }}>
            <title>{points[i].date}: {v} replied</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-center gap-3 text-xs text-base-content/55">
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-primary/80" />Sent</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-success/80" />Delivered</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-secondary/80" />Replied</span>
      </div>
      {n > 0 ? (
        <div className="flex flex-wrap justify-between gap-1 text-xs text-base-content/60">
          {points.map((p) => (
            <span key={p.date} className="min-w-0 flex-1 truncate text-center">
              {p.date.slice(5)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ========== Main Component ==========

export function CampaignReport({ campaignId }: { campaignId: string }) {
  const [report, setReport] = useState<DetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactFilter, setContactFilter] = useState<string>("ALL");
  const [contactSearch, setContactSearch] = useState("");
  const [contactCursor, setContactCursor] = useState<string | null>(null);
  const [contactHasMore, setContactHasMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.campaignDetailed(campaignId);
      setReport(data as DetailedReport);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const fetchContacts = useCallback(
    async (cursor?: string | null) => {
      setContactsLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (contactFilter !== "ALL") params.status = contactFilter;
        if (contactSearch.trim()) params.search = contactSearch.trim();
        if (cursor) params.cursor = cursor;
        const res = (await campaignsApi.contacts(campaignId, params)) as {
          items: ContactRow[];
          cursor: string | null;
          hasMore: boolean;
        };
        if (cursor) {
          setContacts((prev) => [...prev, ...res.items]);
        } else {
          setContacts(res.items);
        }
        setContactCursor(res.cursor);
        setContactHasMore(res.hasMore);
      } catch {
        // silently ignore drill-down errors
      } finally {
        setContactsLoading(false);
      }
    },
    [campaignId, contactFilter, contactSearch],
  );

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await analyticsApi.campaignExport(campaignId);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }, [campaignId]);

  const summary = report?.summary;
  const funnel = report?.funnel ?? [];
  const failures = report?.failures ?? [];
  const engagement = report?.engagement;
  const timeline = report?.timeline ?? [];
  const agents = report?.agents ?? [];
  const cost = report?.cost;
  const runs = report?.runs ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-28 rounded-box" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-warning">
        <span>{error}</span>
        <button type="button" className="btn btn-sm" onClick={() => void fetchReport()}>
          Retry
        </button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      <section className="space-y-3">
        <SectionHeader title="Summary" description="Overall campaign performance" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total contacts" value={summary?.totalContacts.toLocaleString() ?? 0} />
          <Stat label="Sent" value={summary?.sent.toLocaleString() ?? 0} />
          <Stat label="Delivered" value={summary?.delivered.toLocaleString() ?? 0} accent="success" />
          <Stat label="Read" value={summary?.read.toLocaleString() ?? 0} accent="info" />
          <Stat label="Failed" value={summary?.failed.toLocaleString() ?? 0} accent={summary && summary.failed > 0 ? "error" : undefined} />
          <Stat label="Skipped" value={summary?.skipped.toLocaleString() ?? 0} accent={summary && summary.skipped > 0 ? "warning" : undefined} />
          <Stat label="Replied" value={summary?.replied.toLocaleString() ?? 0} accent="success" />
        </div>
      </section>

      <div className="divider my-0" />

      {/* Funnel */}
      {funnel.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Funnel" description="Message delivery progression" />
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <FunnelChart stages={funnel} />
          </div>
        </section>
      ) : null}

      <div className="divider my-0" />

      {/* Engagement */}
      {engagement ? (
        <section className="space-y-3">
          <SectionHeader title="Engagement" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Delivery rate" value={`${engagement.deliveryRate}%`} accent="success" />
            <Stat label="Read rate" value={`${engagement.readRate}%`} accent="info" />
            <Stat label="Reply rate" value={`${engagement.replyRate}%`} accent="success" />
          </div>
        </section>
      ) : null}

      <div className="divider my-0" />

      {/* Failures */}
      {failures.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Failures" description="Breakdown by error type" />
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr className="border-base-300">
                  <th>Reason</th>
                  <th className="text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.reason} className="border-base-300">
                    <td className="text-sm">{f.reason}</td>
                    <td className="text-right tabular-nums font-medium text-error">
                      {f.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="divider my-0" />

      {/* Timeline */}
      {timeline.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Timeline" description="Messages and replies over time" />
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <TimelineChart points={timeline} />
          </div>
        </section>
      ) : null}

      <div className="divider my-0" />

      {/* Agent Metrics */}
      {agents.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Agent metrics" description="Replies handled from campaign conversations" />
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr className="border-base-300">
                  <th>Agent</th>
                  <th className="text-right">Replies handled</th>
                  <th className="text-right">Avg response time</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.userId} className="border-base-300">
                    <td className="text-sm">{a.email}</td>
                    <td className="text-right tabular-nums">{a.repliesHandled}</td>
                    <td className="text-right tabular-nums text-base-content/70">
                      {a.avgResponseMinutes != null
                        ? `${a.avgResponseMinutes}m`
                        : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="divider my-0" />

      {/* Cost */}
      <section className="space-y-3">
        <SectionHeader title="Cost" />
        {cost ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Total cost"
              value={`${cost.currency} ${cost.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Stat
              label="Cost per message"
              value={`${cost.currency} ${cost.costPerMessage.toFixed(4)}`}
            />
            <Stat
              label="Cost per reply"
              value={`${cost.currency} ${cost.costPerReply.toFixed(4)}`}
            />
          </div>
        ) : (
          <p className="text-sm text-base-content/60">
            No cost data available for this campaign.
          </p>
        )}
      </section>

      <div className="divider my-0" />

      {/* Per-run breakdown */}
      {runs.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title="Per-run breakdown" />
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-xs">
              <thead>
                <tr className="border-base-300">
                  <th>Run</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Done</th>
                  <th className="text-right">Failed</th>
                  <th className="text-right">Skipped</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const statusTone =
                    run.status === "COMPLETED"
                      ? "badge-success"
                      : run.status === "FAILED"
                        ? "badge-error"
                        : run.status === "RUNNING"
                          ? "badge-info"
                          : "badge-neutral";
                  const dur =
                    run.durationMinutes != null
                      ? run.durationMinutes < 1
                        ? "<1m"
                        : `${Math.round(run.durationMinutes)}m`
                      : "\u2014";
                  return (
                    <tr key={run.runId} className="border-base-300">
                      <td className="font-medium">#{run.runNumber}</td>
                      <td><span className={`badge badge-xs ${statusTone}`}>{run.status}</span></td>
                      <td className="text-right tabular-nums">{run.totalJobs.toLocaleString()}</td>
                      <td className="text-right tabular-nums">{run.completedJobs.toLocaleString()}</td>
                      <td className="text-right tabular-nums">{run.failedJobs.toLocaleString()}</td>
                      <td className="text-right tabular-nums">{run.skippedJobs.toLocaleString()}</td>
                      <td className="text-right tabular-nums">{run.successRate}%</td>
                      <td className="text-right tabular-nums">{dur}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="divider my-0" />

      {/* Drill-down */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader title="Contacts" description="Filter and view individual contact delivery" />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Export CSV
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "COMPLETED", "DELIVERED", "READ", "FAILED", "SKIPPED"].map(
            (f) => (
              <button
                key={f}
                type="button"
                className={`btn btn-xs ${contactFilter === f ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setContactFilter(f)}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ),
          )}
          <input
            type="text"
            className="input input-bordered input-xs w-40"
            placeholder="Search phone/name..."
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
          />
        </div>

        {/* Contacts table */}
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr className="border-base-300">
                <th>Contact</th>
                <th>Job</th>
                <th>Delivery</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && !contactsLoading ? (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-base-content/60">
                    No contacts found
                  </td>
                </tr>
              ) : null}
              {contacts.map((c) => {
                const jobTone =
                  c.jobStatus === "COMPLETED"
                    ? "badge-success"
                    : c.jobStatus === "FAILED"
                      ? "badge-error"
                      : c.jobStatus === "SKIPPED"
                        ? "badge-warning"
                        : "badge-neutral";
                const msgStatus = c.message?.status;
                const msgTone =
                  msgStatus === "READ"
                    ? "badge-info"
                    : msgStatus === "DELIVERED"
                      ? "badge-success"
                      : msgStatus === "FAILED"
                        ? "badge-error"
                        : msgStatus
                          ? "badge-neutral"
                          : "";
                return (
                  <tr key={c.jobId} className="border-base-300 align-top">
                    <td>
                      <div>
                        <span className="text-sm font-medium">
                          {c.contact.name || c.contact.phone}
                        </span>
                        {c.contact.name ? (
                          <span className="ml-1.5 text-xs text-base-content/55">
                            {c.contact.phone}
                          </span>
                        ) : null}
                      </div>
                      {c.contact.email ? (
                        <span className="text-xs text-base-content/50">{c.contact.email}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge badge-xs ${jobTone}`}>{c.jobStatus}</span>
                    </td>
                    <td>
                      {msgStatus ? (
                        <span className={`badge badge-xs ${msgTone}`}>{msgStatus}</span>
                      ) : (
                        <span className="text-xs text-base-content/40">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-base-content/65">
                      {c.lastError || c.message?.failedAt ? (c.lastError || "Delivery failed") : "\u2014"}
                    </td>
                    <td>
                      {c.message?.conversationId ? (
                        <Link
                          href={`/inbox?conversationId=${c.message.conversationId}`}
                          className="btn btn-ghost btn-xs"
                        >
                          Open chat
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {contactsLoading ? (
          <div className="flex justify-center py-2">
            <span className="loading loading-spinner loading-sm" />
          </div>
        ) : null}

        {contactHasMore && !contactsLoading ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm w-full"
            onClick={() => void fetchContacts(contactCursor)}
          >
            Load more
          </button>
        ) : null}
      </section>
    </div>
  );
}
