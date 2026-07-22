"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useObsFailures,
  useRetryMessage,
  useRetryWebhook,
} from "@/hooks/use-observability";
import type { ObsFailureItem, ObsFailuresParams } from "@/lib/observability-types";
import { fmtTime, IdCell, ObsHeader, StatusBadge } from "./obs-ui";

const PAGE = 50;

const SOURCE_LABEL: Record<string, string> = {
  message: "Message",
  provider_request: "Provider call",
  webhook: "Webhook",
  webhook_delivery: "Outbound webhook",
  campaign_job: "Campaign job",
};

function uiLinkFor(f: ObsFailureItem): string | null {
  if (f.source === "message")
    return `/platform/observability/messages/${f.id}`;
  if (f.source === "webhook") return `/platform/observability/webhooks`;
  if (f.source === "provider_request")
    return `/platform/observability/provider-requests`;
  return null;
}

function FailureRow({ f }: { f: ObsFailureItem }) {
  const retryMessage = useRetryMessage();
  const retryWebhook = useRetryWebhook();
  const link = uiLinkFor(f);

  const canRetry =
    (f.source === "message" && f.retryable) || f.source === "webhook";
  const pending = retryMessage.isPending || retryWebhook.isPending;

  const onRetry = () => {
    if (f.source === "message") retryMessage.mutate(f.id);
    else if (f.source === "webhook") retryWebhook.mutate(f.id);
  };

  return (
    <tr>
      <td className="whitespace-nowrap text-xs">{fmtTime(f.occurredAt)}</td>
      <td>
        <span className="badge badge-ghost badge-sm">
          {SOURCE_LABEL[f.source] ?? f.source}
        </span>
      </td>
      <td className="max-w-md">
        <div className="truncate" title={f.title}>
          {f.title}
        </div>
        {f.errorMessage ? (
          <div className="truncate text-xs opacity-50" title={f.errorMessage}>
            {f.errorMessage}
          </div>
        ) : null}
      </td>
      <td>
        {f.failureClass ? <StatusBadge status={f.failureClass} /> : "—"}
        {f.retryable != null ? (
          <div className="mt-0.5 text-[10px] opacity-50">
            {f.retryable ? "retryable" : "permanent"}
          </div>
        ) : null}
      </td>
      <td>
        <IdCell value={f.workspaceId} />
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-1">
          {canRetry ? (
            <button
              className="btn btn-primary btn-xs"
              disabled={pending}
              onClick={onRetry}
            >
              {pending ? "…" : "Retry"}
            </button>
          ) : null}
          {link ? (
            <Link href={link} className="btn btn-ghost btn-xs">
              View
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function FailureCenterClient() {
  const [source, setSource] = useState("");
  const [offset, setOffset] = useState(0);

  const params: ObsFailuresParams = {
    limit: PAGE,
    offset,
    ...(source && { source }),
  };
  const { data, isLoading, isError, error } = useObsFailures(params);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ObsHeader
        title="Failure center"
        subtitle="Every failed operation across the platform — messages, provider calls, webhooks, deliveries, campaign jobs — with retry-safety verdicts."
      />

      <div className="flex flex-wrap items-end gap-2">
        <select
          className="select select-bordered select-sm"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All sources</option>
          <option value="message">Messages</option>
          <option value="provider_request">Provider calls</option>
          <option value="webhook">Webhooks</option>
          <option value="webhook_delivery">Outbound webhooks</option>
          <option value="campaign_job">Campaign jobs</option>
        </select>
      </div>

      {isError ? (
        <div className="alert alert-error">
          <span>{(error as Error)?.message ?? "Failed to load"}</span>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-sm table-zebra">
          <thead>
            <tr>
              <th>When</th>
              <th>Source</th>
              <th>Failure</th>
              <th>Class</th>
              <th>Workspace</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <span className="loading loading-spinner" />
                </td>
              </tr>
            ) : items.length > 0 ? (
              items.map((f) => <FailureRow key={`${f.source}-${f.id}`} f={f} />)
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center opacity-60">
                  No failures 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end text-sm">
        <div className="join">
          <button
            className="btn btn-sm join-item"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            Prev
          </button>
          <button
            className="btn btn-sm join-item"
            disabled={items.length < PAGE}
            onClick={() => setOffset(offset + PAGE)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
