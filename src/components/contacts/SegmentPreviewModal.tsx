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
      <div className="modal-box max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Preview: {segment.name}</h3>
            <p className="text-sm text-base-content/60">
              Uses the last saved segment query and refreshes the cached contact count.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? (
          <div role="alert" className="alert alert-error alert-soft mt-4">
            <span className="text-sm">
              {error instanceof Error ? error.message : "Failed to load preview"}
            </span>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm">
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                Matching contacts:{" "}
                <span className="font-semibold">{data?.contactCount ?? "—"}</span>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {data?.contacts?.length ? (
                data.contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name || c.id}</td>
                    <td className="font-mono text-xs">{c.phone}</td>
                    <td className="text-xs">{c.email || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-sm text-base-content/60">
                    {isLoading ? "Loading..." : "No matching contacts."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}

