"use client";

import { useQuery } from "@tanstack/react-query";
import { segmentsApi } from "@/lib/api";
import type { Segment } from "@/lib/types";

export function SegmentPreviewModal({
  segment,
  onClose,
}: {
  segment: Segment;
  onClose: () => void;
}) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["segmentPreview", segment.id],
    queryFn: () => segmentsApi.preview(segment.id),
  });

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-2xl rounded-box border border-base-300 !bg-base-100 p-0">
        <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <span className="op-label">preview</span>
            <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">{segment.name}</h3>
            <p className="mt-1 text-[0.78125rem] text-base-content/55">
              Uses the saved query and refreshes the cached contact count.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2">
              <span className="op-label mb-1 block text-error">error</span>
              <span className="text-[0.8125rem] text-base-content">
                {error instanceof Error ? error.message : "Failed to load preview"}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.8125rem]">
              <span className="op-label mr-2">matching</span>
              {isLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <span className="font-mono-op text-[1.125rem] font-semibold tabular-nums">
                  {data?.contactCount ?? "—"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Refresh"
              )}
            </button>
          </div>

          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
            <table className="w-full text-[0.78125rem]">
              <thead>
                <tr className="border-b border-base-300 bg-base-100">
                  <th className="op-label px-3 py-2.5 text-left font-medium">Contact</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Phone</th>
                  <th className="op-label px-3 py-2.5 text-left font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {data?.contacts?.length ? (
                  data.contacts.map((c) => (
                    <tr key={c.id} className="border-b border-base-300/50 transition-colors last:border-b-0 hover:bg-base-300/40">
                      <td className="px-3 py-2.5 font-medium">{c.name || c.id}</td>
                      <td className="font-mono-op px-3 py-2.5 tabular-nums text-base-content/80">{c.phone}</td>
                      <td className="px-3 py-2.5 text-base-content/70">{c.email || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-[0.8125rem] text-base-content/55">
                      {isLoading ? "Loading…" : "No matching contacts."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
