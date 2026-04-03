"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "@/lib/api";

type Summary = {
  totalMessages?: number;
  messagesSent?: number;
  messagesReceived?: number;
  deliveryRate?: number;
  readRate?: number;
  totalConversations?: number;
  activeConversations?: number;
};

type ChannelBreakdown = {
  channel: string;
  messagesSent: number;
  messagesReceived: number;
  deliveryRate: number;
};

type TimeseriesPoint = {
  timestamp: string;
  messagesSent: number;
  messagesReceived: number;
};

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Failed to load analytics.";
}

function KpiCard({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className="text-2xl font-semibold">{value ?? "-"}</div>
      </div>
    </div>
  );
}

export function AnalyticsClient() {
  const today = useMemo(() => new Date(), []);
  const thirtyAgo = useMemo(
    () => new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
    [today]
  );
  const [start, setStart] = useState(fmtDateInput(thirtyAgo));
  const [end, setEnd] = useState(fmtDateInput(today));
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<Summary>({});
  const [delivery, setDelivery] = useState<Record<string, unknown>>({});
  const [channels, setChannels] = useState<ChannelBreakdown[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [conversations, setConversations] = useState<Record<string, unknown> | null>(null);
  const [contacts, setContacts] = useState<Record<string, unknown> | null>(null);
  const [agents, setAgents] = useState<unknown[]>([]);
  const [templates, setTemplates] = useState<Record<string, unknown> | null>(null);
  const [summaryDaily, setSummaryDaily] = useState<Record<string, unknown> | null>(null);
  const [summaryWeekly, setSummaryWeekly] = useState<Record<string, unknown> | null>(
    null
  );
  const [summaryMonthly, setSummaryMonthly] = useState<Record<string, unknown> | null>(
    null
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseParams = { start, end };
      const [
        s,
        d,
        c,
        t,
        conv,
        cont,
        ag,
        sumDaily,
        sumWeekly,
        sumMonthly,
      ] = await Promise.all([
        analyticsApi.summary(baseParams),
        analyticsApi.delivery(baseParams),
        analyticsApi.channels(baseParams),
        analyticsApi.timeseries(baseParams),
        analyticsApi.conversations(baseParams),
        analyticsApi.contacts(baseParams),
        analyticsApi.agents(baseParams),
        analyticsApi.summaryByPeriod("daily"),
        analyticsApi.summaryByPeriod("weekly"),
        analyticsApi.summaryByPeriod("monthly"),
      ]);
      setSummary((s ?? {}) as Summary);
      setDelivery((d ?? {}) as Record<string, unknown>);
      setChannels((c ?? []) as ChannelBreakdown[]);
      setTimeseries((t ?? []) as TimeseriesPoint[]);
      setConversations((conv ?? null) as Record<string, unknown> | null);
      setContacts((cont ?? null) as Record<string, unknown> | null);
      setAgents((ag ?? []) as unknown[]);
      setSummaryDaily((sumDaily ?? null) as Record<string, unknown> | null);
      setSummaryWeekly((sumWeekly ?? null) as Record<string, unknown> | null);
      setSummaryMonthly((sumMonthly ?? null) as Record<string, unknown> | null);

      if (templateId.trim()) {
        const tpl = await analyticsApi.templates({
          start,
          end,
          templateId: templateId.trim(),
        });
        setTemplates((tpl ?? null) as Record<string, unknown> | null);
      } else {
        setTemplates(null);
      }
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxSent = Math.max(1, ...timeseries.map((point) => point.messagesSent || 0));

  return (
    <div className="space-y-4">
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
          <label className="form-control min-w-56">
            <span className="label-text text-xs">Template analytics (optional)</span>
            <input
              className="input input-bordered input-sm"
              placeholder="templateId"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total messages" value={summary.totalMessages} />
        <KpiCard label="Sent" value={summary.messagesSent} />
        <KpiCard label="Received" value={summary.messagesReceived} />
        <KpiCard label="Delivery rate" value={`${Math.round((summary.deliveryRate || 0) * 100)}%`} />
        <KpiCard label="Read rate" value={`${Math.round((summary.readRate || 0) * 100)}%`} />
        <KpiCard label="Conversations" value={summary.totalConversations} />
        <KpiCard label="Active conv." value={summary.activeConversations} />
        <KpiCard label="Failed" value={delivery?.failed as number | string | undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Message volume</h2>
            <div className="mt-2 space-y-2">
              {timeseries.map((point) => (
                <div key={point.timestamp} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-base-content/60">
                    {new Date(point.timestamp).toLocaleDateString()}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-full rounded-full bg-base-300">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(point.messagesSent / maxSent) * 100}%` }} />
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs text-base-content/60">{point.messagesSent}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">Channel mix</h2>
            <div className="mt-2 space-y-3">
              {channels.map((channel) => (
                <div key={channel.channel} className="rounded-box border border-base-300 bg-base-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{channel.channel}</span>
                    <span className="text-xs text-base-content/60">{Math.round(channel.deliveryRate * 100)}% delivered</span>
                  </div>
                  <div className="mt-2 text-xs text-base-content/60">
                    Sent: {channel.messagesSent} · Received: {channel.messagesReceived}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonCard title="Conversations stats" data={conversations} />
        <JsonCard title="Contacts growth stats" data={contacts} />
        <JsonCard title="Agent performance" data={agents} />
        <JsonCard title="Template analytics" data={templates} />
        <JsonCard title="Summary daily" data={summaryDaily} />
        <JsonCard title="Summary weekly" data={summaryWeekly} />
        <JsonCard title="Summary monthly" data={summaryMonthly} />
      </div>
    </div>
  );
}

function JsonCard({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">{title}</h2>
        <pre className="max-h-60 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 text-xs">
          {data == null ? "—" : JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

