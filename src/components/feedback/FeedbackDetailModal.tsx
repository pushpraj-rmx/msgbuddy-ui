"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbackApi } from "@/lib/api";
import type { FeedbackReport, FeedbackStatus } from "@/lib/types";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { StatusTag } from "@/components/ui/StatusTag";

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
  { value: "WONT_FIX", label: "Won't Fix" },
];

const STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = {
  OPEN: "neutral",
  IN_REVIEW: "info",
  PLANNED: "info",
  IN_PROGRESS: "warning",
  DONE: "success",
  WONT_FIX: "neutral",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface FeedbackDetailModalProps {
  report: FeedbackReport;
  isAdmin: boolean;
  onClose: () => void;
}

export function FeedbackDetailModal({ report, isAdmin, onClose }: FeedbackDetailModalProps) {
  const queryClient = useQueryClient();

  const [adminStatus, setAdminStatus] = useState<FeedbackStatus>(report.status);
  const [adminNote, setAdminNote] = useState(report.adminNote ?? "");

  const adminUpdate = useMutation({
    mutationFn: () =>
      feedbackApi.adminUpdate(report.id, {
        status: adminStatus,
        adminNote: adminNote || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueriesData<{ items: FeedbackReport[] }>(
        { queryKey: ["feedback"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((r) => (r.id === updated.id ? updated : r)),
          };
        }
      );
      onClose();
    },
  });

  return (
    <dialog className="modal modal-open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>

        {/* Header */}
        <div className="pr-8 mb-4">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <StatusTag tone={report.type === "BUG" ? "danger" : "info"}>
              {report.type === "BUG" ? "Bug" : "Feature"}
            </StatusTag>
            <StatusTag tone={STATUS_TONE[report.status] ?? "neutral"}>
              {STATUS_OPTIONS.find((s) => s.value === report.status)?.label ?? report.status}
            </StatusTag>
            {report.type === "BUG" && (
              <span className="op-tag">
                {report.priority.charAt(0) + report.priority.slice(1).toLowerCase()}
              </span>
            )}
            {report.type === "FEATURE_REQUEST" && (
              <span className="op-tag">▲ {report.voteCount}</span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold tracking-[-0.015em]">{report.title}</h3>
          <p className="font-mono-op mt-1 text-[11px] tabular-nums text-base-content/50">
            {report.submittedBy ? `${report.submittedBy} · ` : ""}
            {formatDate(report.createdAt)}
          </p>
        </div>

        {/* Description */}
        <div className="mb-4">
          <RichTextEditor value={report.description} readOnly />
        </div>

        {/* Attachments */}
        {report.attachments && report.attachments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-base-content/60 mb-2">Attachments</p>
            <div className="flex flex-wrap gap-2">
              {report.attachments.map((att, i) => (
                <div key={i} className="rounded border border-base-300 overflow-hidden bg-base-200">
                  {att.mimeType.startsWith("image/") ? (
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic user content */}
                      <img
                        src={att.url}
                        alt={att.name}
                        className="w-24 h-24 object-cover hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ) : att.mimeType.startsWith("video/") ? (
                    <video
                      src={att.url}
                      controls
                      className="w-40 h-28 object-cover"
                    />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-base-300 transition-colors"
                    >
                      📎 {att.name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin note (read-only for non-admins) */}
        {report.adminNote && !isAdmin && (
          <div className="mb-4 rounded-box border border-info/30 bg-info/10 p-3">
            <p className="text-xs font-medium text-info mb-1">Admin Note</p>
            <p className="text-sm">{report.adminNote}</p>
          </div>
        )}

        {/* Admin panel */}
        {isAdmin && (
          <div className="border-t border-base-300 pt-4 mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-3">
              Admin
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Status</label>
                <select
                  className="select select-bordered select-sm w-full max-w-xs"
                  value={adminStatus}
                  onChange={(e) => setAdminStatus(e.target.value as FeedbackStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Admin Note</label>
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  rows={3}
                  placeholder="Optional note visible to the submitter…"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {adminUpdate.isError && (
          <p className="text-sm text-error mt-2">Failed to save. Please try again.</p>
        )}

        <div className="modal-action mt-5">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => adminUpdate.mutate()}
              disabled={adminUpdate.isPending}
            >
              {adminUpdate.isPending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
