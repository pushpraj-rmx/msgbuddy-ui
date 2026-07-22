"use client";

import Link from "next/link";
import { useMessageTimeline, useRetryMessage } from "@/hooks/use-observability";
import type { ObsMessageTimeline, ObsTimelineEvent } from "@/lib/observability-types";
import {
  CopyButton,
  fmtTime,
  IdCell,
  JsonBlock,
  ObsHeader,
  StatusBadge,
} from "./obs-ui";

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return String(v);
}

const SOURCE_ACCENT: Record<ObsTimelineEvent["source"], string> = {
  message_event: "border-primary",
  provider_request: "border-secondary",
  webhook: "border-accent",
};

const SOURCE_LABEL: Record<ObsTimelineEvent["source"], string> = {
  message_event: "lifecycle",
  provider_request: "provider",
  webhook: "webhook",
};

function TimelineEventRow({ event }: { event: ObsTimelineEvent }) {
  const hasDetail =
    event.detail && Object.values(event.detail).some((v) => v != null);
  return (
    <li className={`ml-2 border-l-2 pl-4 pb-4 ${SOURCE_ACCENT[event.source]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-ghost badge-sm">
          {SOURCE_LABEL[event.source]}
        </span>
        <span className="font-medium">{event.label}</span>
        {event.status ? <StatusBadge status={event.status} /> : null}
        <span className="text-xs opacity-50">{fmtTime(event.at)}</span>
      </div>
      {hasDetail ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs opacity-60">
            details
          </summary>
          <JsonBlock value={event.detail} className="mt-1" />
        </details>
      ) : null}
    </li>
  );
}

/** Pure render of an assembled message timeline (reused by Global Search). */
export function TimelineView({ timeline }: { timeline: ObsMessageTimeline }) {
  const m = timeline.message;
  const messageId = str(m.id) ?? "";
  const status = str(m.status);
  const retry = useRetryMessage();

  const fields: [string, string | null][] = [
    ["Workspace", str(m.workspaceId)],
    ["Direction", str(m.direction)],
    ["Channel", str(m.channel)],
    ["Provider msg id", str(m.providerMessageId)],
    ["Correlation id", str(m.correlationId)],
    ["Retry count", str(m.retryCount)],
    ["Created", fmtTime(str(m.createdAt))],
    ["Error", str(m.errorCode) ?? str(m.errorMessage)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-60">Message</span>
              <IdCell value={messageId} />
              <StatusBadge status={status} />
            </div>
            {status === "FAILED" ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={retry.isPending}
                onClick={() => retry.mutate(messageId)}
              >
                {retry.isPending ? "Retrying…" : "Retry message"}
              </button>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
            {fields.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs opacity-50">{k}</dt>
                <dd className="truncate font-mono text-xs" title={v ?? ""}>
                  {v ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
          {retry.isError ? (
            <p className="text-xs text-error">
              {(retry.error as Error)?.message ?? "Retry failed"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="card border border-base-300 bg-base-100">
        <div className="card-body gap-2 p-4">
          <h2 className="text-sm font-semibold opacity-70">
            Lifecycle ({timeline.events.length} events)
          </h2>
          {timeline.events.length === 0 ? (
            <p className="text-sm opacity-60">
              No captured events yet. (Events are recorded going forward; older
              messages predate capture.)
            </p>
          ) : (
            <ul className="mt-2">
              {timeline.events.map((e) => (
                <TimelineEventRow key={`${e.source}-${e.refId}-${e.at}`} event={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageTimelineClient({ messageId }: { messageId: string }) {
  const { data, isLoading, isError, error } = useMessageTimeline(messageId);

  return (
    <div className="flex flex-col gap-4">
      <ObsHeader title="Message timeline" subtitle={messageId}>
        <CopyButton text={messageId} label="Copy id" />
        <Link href="/platform/observability" className="btn btn-ghost btn-sm">
          ← Search
        </Link>
      </ObsHeader>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner" />
        </div>
      ) : isError ? (
        <div className="alert alert-error">
          <span>{(error as Error)?.message ?? "Failed to load timeline"}</span>
        </div>
      ) : data ? (
        <TimelineView timeline={data} />
      ) : null}
    </div>
  );
}
