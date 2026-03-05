import { serverFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

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
  conversationsCreated?: number;
};

export default async function AnalyticsPage() {
  let summary: Summary = {};
  let delivery: Record<string, unknown> = {};
  let channels: ChannelBreakdown[] = [];
  let timeseries: TimeseriesPoint[] = [];
  let error: string | null = null;

  try {
    [summary, delivery, channels, timeseries] = await Promise.all([
      serverFetch<Summary>(endpoints.analytics.summary),
      serverFetch<Record<string, unknown>>(endpoints.analytics.delivery),
      serverFetch<ChannelBreakdown[]>(endpoints.analytics.channels),
      serverFetch<TimeseriesPoint[]>(endpoints.analytics.timeseries),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load analytics.";
  }

  const maxSent = Math.max(
    1,
    ...timeseries.map((point) => point.messagesSent || 0)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-base-content/60">
          Track delivery, engagement, and channel performance.
        </p>
      </div>

      {error && (
        <div role="alert" className="alert alert-warning">
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total messages" value={summary.totalMessages} />
        <KpiCard label="Sent" value={summary.messagesSent} />
        <KpiCard label="Received" value={summary.messagesReceived} />
        <KpiCard
          label="Delivery rate"
          value={`${Math.round((summary.deliveryRate || 0) * 100)}%`}
        />
        <KpiCard
          label="Read rate"
          value={`${Math.round((summary.readRate || 0) * 100)}%`}
        />
        <KpiCard label="Conversations" value={summary.totalConversations} />
        <KpiCard label="Active conv." value={summary.activeConversations} />
        <KpiCard
          label="Failed"
          value={
            delivery?.failed != null
              ? (delivery.failed as number | string)
              : undefined
          }
        />
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
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${(point.messagesSent / maxSent) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs text-base-content/60">
                    {point.messagesSent}
                  </div>
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
                <div
                  key={channel.channel}
                  className="rounded-xl border border-base-300 bg-base-100 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{channel.channel}</span>
                    <span className="text-xs text-base-content/60">
                      {Math.round(channel.deliveryRate * 100)}% delivered
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-base-content/60">
                    Sent: {channel.messagesSent} · Received:{" "}
                    {channel.messagesReceived}
                  </div>
                </div>
              ))}
              {!channels.length && (
                <p className="text-sm text-base-content/60">
                  No channel data yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className="text-2xl font-semibold">{value ?? "-"}</div>
      </div>
    </div>
  );
}
