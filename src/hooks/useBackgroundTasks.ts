"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backgroundTasksApi } from "@/lib/api";
import {
  isContactImportClassified,
  isContactImportProgress,
  isContactImportTerminal,
  isContactImportCompleted,
  isContactImportFailed,
  isContactImportCancelled,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import type { BackgroundTask } from "@/lib/types";

/** Terminal task that lingers in the toast queue briefly after completion. */
export type CompletedTaskNotice = {
  id: string;
  task: BackgroundTask;
  outcome: "completed" | "failed" | "cancelled";
};

const POLL_INTERVAL_MS = 5_000;
/** If we haven't received an SSE event for this long while we have active tasks, fall back to polling. */
const SSE_SILENCE_FALLBACK_MS = 4_000;
/** Keep a finished task on the bar briefly so it can animate to 100% and the user notices. */
const COMPLETION_LINGER_MS = 1_200;

/**
 * Manages the cross-domain "background tasks" feed used by the floating top
 * progress bar and the completion toast. Subscribes to workspace SSE for live
 * updates and falls back to polling if events stall.
 */
export function useBackgroundTasks(workspaceId: string) {
  const [tasks, setTasks] = useState<Map<string, BackgroundTask>>(new Map());
  const [completed, setCompleted] = useState<CompletedTaskNotice[]>([]);

  // Refs so the long-lived SSE handler always sees the latest state without
  // re-creating the EventSource subscription on every change.
  const tasksRef = useRef<Map<string, BackgroundTask>>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const lastSseAtRef = useRef<number>(Date.now());

  const refresh = useCallback(async () => {
    try {
      const fresh = await backgroundTasksApi.listActive();
      setTasks((prev) => {
        const next = new Map<string, BackgroundTask>();
        for (const t of fresh) {
          next.set(t.id, t);
        }
        // If a previously-tracked task disappeared from the active list, treat
        // it as terminal — fire a completion notice so the user sees the toast
        // even if SSE missed the terminal event.
        for (const [id, prevTask] of prev.entries()) {
          if (!next.has(id)) {
            scheduleCompletion(prevTask, "completed");
          }
        }
        return next;
      });
    } catch {
      // best-effort; SSE may catch up
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleCompletion is stable closure
  }, []);

  const scheduleCompletion = useCallback(
    (task: BackgroundTask, outcome: CompletedTaskNotice["outcome"]) => {
      // Push a toast notice (auto-dismissed by the toast component).
      setCompleted((prev) => [
        ...prev,
        {
          id: `${task.id}-${Date.now()}`,
          task: { ...task, status: outcome.toUpperCase() },
          outcome,
        },
      ]);
    },
    [],
  );

  const dismissCompletion = useCallback((id: string) => {
    setCompleted((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Long-lived SSE subscription
  useEffect(() => {
    const source = new EventSource(`/api/sse/workspace/${workspaceId}`);
    source.onmessage = (event) => {
      const ev = parseWorkspaceSseEvent(event.data);
      if (!ev) return;

      // Only react to background-task events.
      if (
        !isContactImportClassified(ev.type) &&
        !isContactImportProgress(ev.type) &&
        !isContactImportTerminal(ev.type)
      ) {
        return;
      }

      lastSseAtRef.current = Date.now();
      const data = ev.data as {
        jobId?: string;
        processed?: number;
        total?: number;
        createdCount?: number;
        updatedCount?: number;
        skippedCount?: number;
        failedCount?: number;
        totalRows?: number;
      };
      const id = data.jobId;
      if (!id) return;

      if (isContactImportProgress(ev.type)) {
        setTasks((prev) => {
          const next = new Map(prev);
          const existing = next.get(id);
          if (existing) {
            next.set(id, {
              ...existing,
              processed: data.processed ?? existing.processed,
              total: data.total ?? existing.total,
              status: "RUNNING",
              detail:
                (data.total ?? existing.total)
                  ? `${(data.processed ?? 0).toLocaleString()} / ${(data.total ?? 0).toLocaleString()} rows`
                  : existing.detail,
            });
          } else {
            // We received an event for a task we don't yet know about — refresh.
            void refresh();
          }
          return next;
        });
      } else if (isContactImportClassified(ev.type)) {
        setTasks((prev) => {
          const next = new Map(prev);
          const existing = next.get(id);
          if (existing) {
            next.set(id, {
              ...existing,
              total: data.totalRows ?? existing.total,
              status: "RUNNING",
            });
          } else {
            void refresh();
          }
          return next;
        });
      } else if (isContactImportTerminal(ev.type)) {
        // Move to "completing" state visually, then drop after linger.
        setTasks((prev) => {
          const existing = prev.get(id);
          if (!existing) return prev;
          const outcome: CompletedTaskNotice["outcome"] =
            isContactImportCompleted(ev.type)
              ? "completed"
              : isContactImportFailed(ev.type)
                ? "failed"
                : isContactImportCancelled(ev.type)
                  ? "cancelled"
                  : "completed";
          const finished: BackgroundTask = {
            ...existing,
            status: "COMPLETED",
            processed: existing.total ?? existing.processed,
          };
          const next = new Map(prev);
          next.set(id, finished);

          window.setTimeout(() => {
            setTasks((p2) => {
              if (!p2.has(id)) return p2;
              const n2 = new Map(p2);
              n2.delete(id);
              return n2;
            });
            scheduleCompletion(finished, outcome);
          }, COMPLETION_LINGER_MS);

          return next;
        });
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [workspaceId, refresh, scheduleCompletion]);

  // Auto-poll fallback: if we have active tasks and SSE has been silent for
  // > SSE_SILENCE_FALLBACK_MS, poll the active list every 5s until we get
  // events again.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const haveActive = tasksRef.current.size > 0;
      if (!haveActive) return;
      const silent = Date.now() - lastSseAtRef.current > SSE_SILENCE_FALLBACK_MS;
      if (silent) void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return {
    tasks: Array.from(tasks.values()),
    completed,
    dismissCompletion,
  };
}
