"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { contactsApi } from "@/lib/api";
import type { BackgroundTask } from "@/lib/types";

/**
 * 2px-tall floating progress bar pinned to the very top of the viewport.
 * Click the bar (extended hit area) to open a panel with details + Cancel.
 *
 * Shows ONE composite bar driven by the lowest-progress active task — keeps
 * the user oriented without spelling out every task. Clicking expands a
 * popover panel with per-task details and actions.
 */
export function BackgroundTasksBar({ tasks }: { tasks: BackgroundTask[] }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [panelOpen]);

  // Compute "should panel actually be visible" — when tasks drain to zero we
  // simply skip rendering the panel without touching state (keeps `panelOpen`
  // sticky in case tasks repopulate, and avoids effect-triggered rerenders).
  const showPanel = panelOpen && tasks.length > 0;

  if (tasks.length === 0) return null;

  // Pick the worst-case progress across active tasks so the bar reflects the
  // longest in-flight work. Tasks without a known `total` are "indeterminate".
  const indeterminate = tasks.some((t) => t.total == null || t.total === 0);
  let pct = 0;
  if (!indeterminate) {
    let minPct = 100;
    for (const t of tasks) {
      const total = t.total ?? 0;
      if (total <= 0) continue;
      const taskPct = Math.min(100, Math.round((t.processed / total) * 100));
      if (taskPct < minPct) minPct = taskPct;
    }
    pct = minPct;
  }

  return (
    <div ref={wrapperRef} className="fixed inset-x-0 top-0 z-[100]">
      {/* Hit area — 8px tall padding makes the 2px bar comfortably clickable */}
      <button
        type="button"
        className="group relative block h-2 w-full cursor-pointer bg-base-content/5"
        onClick={() => setPanelOpen((v) => !v)}
        aria-label={`${tasks.length} background task${tasks.length === 1 ? "" : "s"} running — click for details`}
        title={`${tasks.length} task${tasks.length === 1 ? "" : "s"} running · click for details`}
      >
        {/* The visible 2px bar — sits at the top of the hit area */}
        <span
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="pointer-events-none absolute inset-x-0 top-0 block h-[2px] overflow-hidden bg-transparent"
        >
          {indeterminate ? (
            <span
              className="absolute inset-y-0 block w-2/5 bg-primary/80"
              style={{
                animation:
                  "msgbuddy-bg-bar-indeterminate 1.6s ease-in-out infinite",
              }}
            />
          ) : (
            <span
              className="block h-full bg-primary/80 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          )}
        </span>
      </button>

      {showPanel ? (
        <BackgroundTasksPanel
          tasks={tasks}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}

      <style jsx>{`
        @keyframes msgbuddy-bg-bar-indeterminate {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(75%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────

function BackgroundTasksPanel({
  tasks,
  onClose,
}: {
  tasks: BackgroundTask[];
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-3 top-3 w-[22rem] rounded-box border border-base-300 bg-base-100 shadow-lg"
      role="dialog"
      aria-label="Background tasks"
    >
      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
        <span className="op-label">background tasks · {tasks.length}</span>
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="max-h-[70vh] overflow-y-auto">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="border-b border-base-300/50 last:border-b-0"
          >
            <TaskRow task={task} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskRow({ task }: { task: BackgroundTask }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = task.total ?? 0;
  const processed = task.processed ?? 0;
  const indeterminate = total <= 0;
  const pct = indeterminate
    ? 0
    : Math.min(100, Math.round((processed / total) * 100));

  const Icon = task.kind === "contact-import" ? Upload : Upload;
  const canCancel = task.kind === "contact-import";

  const handleCancel = async () => {
    if (!canCancel || cancelling) return;
    setError(null);
    setCancelling(true);
    try {
      await contactsApi.cancelImportJob(task.id);
      // Worker stops at next chunk boundary; the SSE flow will move this task
      // to terminal state and remove it from the list.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/55">
          <Icon className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-base-content">
          {task.label}
        </span>
        <span className="font-mono-op text-[0.625rem] tracking-[0.04em] uppercase text-base-content/55">
          {task.status.toLowerCase()}
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-sm bg-base-300">
        {indeterminate ? (
          <div
            className="h-full w-2/5 bg-primary/80"
            style={{
              animation:
                "msgbuddy-bg-bar-indeterminate 1.6s ease-in-out infinite",
            }}
          />
        ) : (
          <div
            className="h-full bg-primary/80 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
          {indeterminate
            ? task.detail ?? "preparing…"
            : `${processed.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`}
        </span>
        <div className="flex items-center gap-1">
          {task.href ? (
            <Link
              href={task.href}
              className="font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-base-content/55 transition-colors hover:text-primary"
            >
              View
            </Link>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-error/70 transition-colors hover:text-error disabled:opacity-50"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-[0.6875rem] text-error">{error}</p>
      ) : null}
    </div>
  );
}
