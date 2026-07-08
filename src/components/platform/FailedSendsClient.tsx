"use client";

import { useState } from "react";
import { usePlatformFailedSends } from "@/hooks/use-platform";
import { getApiError } from "@/lib/api-error";
import { WHATSAPP_DELIVERY_ERROR_HINTS } from "@/lib/whatsappDeliveryErrors";
import {
  Pager,
  NameWithId,
  formatDate,
} from "@/components/platform/PlatformConsoleClient";

/**
 * Platform → Logs → Failed sends. Cross-tenant feed of failed outbound
 * messages so an operator can see delivery failures (Meta error codes +
 * messages) across every workspace without SSHing for `pm2 logs`.
 */
export function FailedSendsClient() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const list = usePlatformFailedSends({
    workspaceId: workspaceId.trim() || undefined,
    errorCode: errorCode.trim() || undefined,
    offset,
    limit,
  });

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-300">
        <div className="gap-3 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Failed Sends Filters</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input input-bordered"
              placeholder="Workspace ID"
              value={workspaceId}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                setOffset(0);
              }}
            />
            <input
              className="input input-bordered"
              placeholder="Error code (e.g. 131026)"
              value={errorCode}
              onChange={(e) => {
                setErrorCode(e.target.value);
                setOffset(0);
              }}
            />
            <select
              className="select select-bordered"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {list.error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">error</span>
          <p className="text-[0.8125rem] text-base-content">{getApiError(list.error)}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
        <table className="w-full text-[0.78125rem]">
          <thead>
            <tr className="border-b border-base-300 bg-base-100">
              <th className="op-label px-3 py-2.5 text-left font-medium">Workspace</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Recipient</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Channel</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Error</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Reason</th>
              <th className="op-label px-3 py-2.5 text-left font-medium">Failed</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => {
              const hint = row.errorCode
                ? WHATSAPP_DELIVERY_ERROR_HINTS[row.errorCode]?.hint
                : undefined;
              return (
                <tr key={row.id} className="border-b border-base-300 align-top transition hover:bg-base-300/40 last:border-b-0">
                  <td className="px-3 py-3">
                    <NameWithId name={row.workspace?.name} id={row.workspaceId} />
                  </td>
                  <td className="px-3 py-3">
                    <NameWithId name={row.contact?.name} id={row.contact?.phone} />
                  </td>
                  <td className="px-3 py-3"><span className="op-tag">{row.channel}</span></td>
                  <td className="px-3 py-3">
                    {row.errorCode ? (
                      <span className="op-tag op-tag-warn font-mono-op">{row.errorCode}</span>
                    ) : (
                      <span className="text-base-content/45">—</span>
                    )}
                  </td>
                  <td className="max-w-md px-3 py-3 text-base-content/80">
                    <div>{row.errorMessage || "—"}</div>
                    {hint ? (
                      <div className="mt-1 text-[0.6875rem] text-base-content/55">{hint}</div>
                    ) : null}
                  </td>
                  <td className="font-mono-op px-3 py-3 text-[0.6875rem] tabular-nums text-base-content/70">
                    {formatDate(row.failedAt ?? row.createdAt)}
                  </td>
                </tr>
              );
            })}
            {!list.isLoading && !list.data?.items.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[0.8125rem] text-base-content/55">
                  No failed sends found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager
        offset={offset}
        limit={limit}
        total={list.data?.total ?? 0}
        onPrev={() => setOffset((v) => Math.max(0, v - limit))}
        onNext={() => setOffset((v) => v + limit)}
      />
    </div>
  );
}
