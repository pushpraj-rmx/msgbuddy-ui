"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Ban, X } from "lucide-react";
import type { CompletedTaskNotice } from "@/hooks/useBackgroundTasks";

const AUTO_DISMISS_MS = 6_000;

export function BackgroundTaskToast({
  notices,
  onDismiss,
}: {
  notices: CompletedTaskNotice[];
  onDismiss: (id: string) => void;
}) {
  if (notices.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        {notices.map((n) => (
          <ToastItem key={n.id} notice={n} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({
  notice,
  onDismiss,
}: {
  notice: CompletedTaskNotice;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(notice.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [notice.id, onDismiss]);

  const tone =
    notice.outcome === "completed"
      ? "border-success/30 text-success"
      : notice.outcome === "failed"
        ? "border-error/30 text-error"
        : "border-warning/30 text-warning";
  const Icon =
    notice.outcome === "completed"
      ? CheckCircle2
      : notice.outcome === "failed"
        ? XCircle
        : Ban;

  return (
    <div className="flex max-w-md items-center gap-3 rounded-box border border-base-300 bg-base-200 px-4 py-3 shadow-lg">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-base-100 ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <span className={`op-label block ${tone.split(" ")[1]}`}>
          {notice.outcome}
        </span>
        <p className="mt-0.5 truncate text-[0.8125rem] text-base-content">
          {notice.task.label}
        </p>
        {notice.task.detail ? (
          <p className="font-mono-op mt-0.5 truncate text-[0.6875rem] tabular-nums text-base-content/55">
            {notice.task.detail}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {notice.task.href ? (
          <Link
            href={notice.task.href}
            className="btn btn-ghost btn-sm"
            onClick={() => onDismiss(notice.id)}
          >
            View
          </Link>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => onDismiss(notice.id)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
