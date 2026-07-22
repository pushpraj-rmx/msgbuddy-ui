"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useObsProviderRequest,
  useObsProviderRequests,
} from "@/hooks/use-observability";
import type {
  ObsProviderRequestDetail,
  ObsProviderRequestsParams,
} from "@/lib/observability-types";
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

function buildCurl(d: ObsProviderRequestDetail): string {
  const parts = [`curl -X ${d.method} '${d.url}'`];
  for (const [k, v] of Object.entries(d.requestHeaders ?? {})) {
    parts.push(`  -H '${k}: ${v}'`);
  }
  if (d.requestBody != null) {
    const body =
      typeof d.requestBody === "string"
        ? d.requestBody
        : JSON.stringify(d.requestBody);
    parts.push(`  -d '${body}'`);
  }
  return parts.join(" \\\n");
}

export function ProviderRequestsClient() {
  const [ok, setOk] = useState("");
  const [operation, setOperation] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: ObsProviderRequestsParams = {
    limit: PAGE,
    offset,
    ...(ok && { ok }),
    ...(operation && { operation }),
  };
  const { data, isLoading, isError, error } = useObsProviderRequests(params);
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <ObsHeader
        title="Provider calls"
        subtitle="Every outbound provider HTTP call — destination, timing, status, and redacted request/response. Replay with copy-as-cURL."
      />

      <div className="flex flex-wrap items-end gap-2">
        <select
          className="select select-bordered select-sm"
          value={ok}
          onChange={(e) => {
            setOk(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All outcomes</option>
          <option value="true">Success (2xx)</option>
          <option value="false">Failed</option>
        </select>
        <input
          className="input input-bordered input-sm font-mono"
          placeholder="operation (send_text…)"
          value={operation}
          onChange={(e) => {
            setOperation(e.target.value);
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
              <th>Started</th>
              <th>Operation</th>
              <th>Method</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Att.</th>
              <th>Message</th>
              <th>Error</th>
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
              data.items.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer hover"
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="whitespace-nowrap text-xs">
                    {fmtTime(p.startedAt)}
                  </td>
                  <td className="text-xs">{p.operation}</td>
                  <td className="text-xs">{p.method}</td>
                  <td>
                    <StatusBadge
                      status={p.ok ? "ok" : String(p.responseStatus ?? "error")}
                    />
                  </td>
                  <td className="text-xs">{fmtDuration(p.durationMs)}</td>
                  <td>{p.attempt}</td>
                  <td>
                    <IdCell value={p.messageId} />
                  </td>
                  <td className="text-xs">{p.errorKind ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center opacity-60">
                  No provider calls match.
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
        <ProviderRequestDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function ProviderRequestDetailModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useObsProviderRequest(id);

  return (
    <dialog className="modal modal-open" onClose={onClose}>
      <div className="modal-box max-w-3xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {data ? data.operation : "Provider call"}
            {data ? (
              <StatusBadge
                status={data.ok ? "ok" : String(data.responseStatus ?? "error")}
              />
            ) : null}
          </h3>
          <div className="flex gap-2">
            {data ? (
              <CopyButton text={buildCurl(data)} label="Copy as cURL" />
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
          <div className="mt-3 flex flex-col gap-3 text-xs">
            <div className="break-all font-mono">
              <span className="badge badge-ghost badge-sm mr-2">
                {data.method}
              </span>
              {data.url}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
              <Field k="Duration" v={fmtDuration(data.durationMs)} />
              <Field k="Attempt" v={String(data.attempt)} />
              <Field
                k="Retryable"
                v={data.retryable == null ? "—" : String(data.retryable)}
              />
              <Field k="Error kind" v={data.errorKind} />
              <Field k="Started" v={fmtTime(data.startedAt)} />
              <Field k="Correlation" v={data.correlationId} />
            </dl>
            {data.messageId ? (
              <Link
                href={`/platform/observability/messages/${data.messageId}`}
                className="link link-primary w-fit"
              >
                → View message timeline
              </Link>
            ) : null}
            <div>
              <span className="font-semibold opacity-70">Request body</span>
              <JsonBlock value={data.requestBody} className="mt-1" />
            </div>
            <div>
              <span className="font-semibold opacity-70">
                Response {data.responseStatus ?? ""}
              </span>
              <JsonBlock value={data.responseBody} className="mt-1" />
            </div>
            {data.errorMessage ? (
              <div className="alert alert-error text-xs">
                <span>{data.errorMessage}</span>
              </div>
            ) : null}
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
