"use client";

import { useState } from "react";
import { useObsWebhook, useObsWebhooks, useRetryWebhook } from "@/hooks/use-observability";
import type { ObsWebhooksParams } from "@/lib/observability-types";
import {
  CopyButton,
  fmtDuration,
  fmtTime,
  IdCell,
  JsonBlock,
  ObsHeader,
  StatusBadge,
} from "./obs-ui";

const PAGE = 50;

export function WebhookInspectorClient() {
  const [provider, setProvider] = useState("");
  const [processed, setProcessed] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: ObsWebhooksParams = {
    limit: PAGE,
    offset,
    ...(provider && { provider }),
    ...(processed && { processed }),
    ...(q && { q }),
  };
  const { data, isLoading, isError, error } = useObsWebhooks(params);
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <ObsHeader
        title="Webhook inspector"
        subtitle="Every inbound provider webhook — raw payload, redacted headers, processing result. Reprocess stuck or failed events."
      />

      <div className="flex flex-wrap items-end gap-2">
        <select
          className="select select-bordered select-sm"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All providers</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </select>
        <select
          className="select select-bordered select-sm"
          value={processed}
          onChange={(e) => {
            setProcessed(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Any status</option>
          <option value="true">Processed</option>
          <option value="false">Unprocessed</option>
        </select>
        <input
          className="input input-bordered input-sm font-mono"
          placeholder="reference / correlation / error"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
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
              <th>Received</th>
              <th>Provider</th>
              <th>Event</th>
              <th>Status</th>
              <th>Att.</th>
              <th>Duration</th>
              <th>Reference</th>
              <th>Workspace</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center">
                  <span className="loading loading-spinner" />
                </td>
              </tr>
            ) : data && data.items.length > 0 ? (
              data.items.map((w) => (
                <tr
                  key={w.id}
                  className="cursor-pointer hover"
                  onClick={() => setSelectedId(w.id)}
                >
                  <td className="whitespace-nowrap text-xs">
                    {fmtTime(w.createdAt)}
                  </td>
                  <td>{w.provider}</td>
                  <td className="text-xs">{w.eventType ?? "—"}</td>
                  <td>
                    <StatusBadge status={w.status} />
                  </td>
                  <td>{w.attempts}</td>
                  <td className="text-xs">{fmtDuration(w.durationMs)}</td>
                  <td>
                    <IdCell value={w.referenceId} />
                  </td>
                  <td>
                    <IdCell value={w.workspaceId} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center opacity-60">
                  No webhooks match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="opacity-60">
          {total > 0
            ? `${offset + 1}–${Math.min(offset + PAGE, total)} of ${total}`
            : "—"}
        </span>
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
            disabled={offset + PAGE >= total}
            onClick={() => setOffset(offset + PAGE)}
          >
            Next
          </button>
        </div>
      </div>

      {selectedId ? (
        <WebhookDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function WebhookDetailModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useObsWebhook(id);
  const retry = useRetryWebhook();

  return (
    <dialog className="modal modal-open" onClose={onClose}>
      <div className="modal-box max-w-3xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            Webhook <IdCell value={id} />
            {data ? <StatusBadge status={data.status} /> : null}
          </h3>
          <div className="flex gap-2">
            {data?.provider === "WHATSAPP" ? (
              <button
                className="btn btn-primary btn-sm"
                disabled={retry.isPending}
                onClick={() => retry.mutate(id)}
              >
                {retry.isPending ? "Reprocessing…" : "Reprocess"}
              </button>
            ) : null}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="flex justify-center py-10">
            <span className="loading loading-spinner" />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {retry.isError ? (
              <div className="alert alert-error text-xs">
                <span>
                  {(retry.error as Error)?.message ?? "Reprocess failed"}
                </span>
              </div>
            ) : null}
            {retry.isSuccess ? (
              <div className="alert alert-success text-xs">
                <span>Reprocessed — status now {retry.data?.status}.</span>
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
              <Field k="Event" v={data.eventType} />
              <Field k="Reference" v={data.referenceId} />
              <Field k="Message id" v={data.messageId} />
              <Field k="Correlation" v={data.correlationId} />
              <Field k="Attempts" v={String(data.attempts)} />
              <Field k="Error" v={data.error} />
            </dl>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold opacity-70">Payload</span>
                <CopyButton text={JSON.stringify(data.payload, null, 2)} />
              </div>
              <JsonBlock value={data.payload} />
            </div>
            <div>
              <span className="text-xs font-semibold opacity-70">
                Headers (redacted)
              </span>
              <JsonBlock value={data.headers} className="mt-1" />
            </div>
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="opacity-50">{k}</dt>
      <dd className="truncate font-mono" title={v ?? ""}>
        {v ?? "—"}
      </dd>
    </div>
  );
}
