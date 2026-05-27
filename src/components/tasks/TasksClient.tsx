"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  tasksApi,
  type Task,
  type TaskListParams,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { PriorityPicker } from "./PriorityPicker";

type Scope = "mine" | "all";
type StatusFilter = "open" | "done" | "snoozed" | "cancelled";
type ViewMode = "list" | "cards";

const VIEW_STORAGE_KEY = "tasks:view-mode";

/**
 * /tasks page — the agent's day-view. Filter chips for Scope (Mine/All)
 * and Status; bucketed by Overdue / Today / This week / Later / No due
 * date when looking at OPEN. The DONE/CANCELLED/SNOOZED views are flat.
 */

const STATUS_QUERY: Record<StatusFilter, string> = {
  open: "OPEN",
  done: "DONE",
  snoozed: "SNOOZED",
  cancelled: "CANCELLED",
};

function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function endOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
}

function bucketKey(t: Task): "overdue" | "today" | "this-week" | "later" | "no-due" {
  if (!t.dueAt) return "no-due";
  const due = new Date(t.dueAt);
  const now = new Date();
  if (due.getTime() < now.getTime()) return "overdue";
  if (due.getTime() <= endOfDay(now).getTime()) return "today";
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  if (due.getTime() <= inSevenDays.getTime()) return "this-week";
  return "later";
}

const BUCKET_LABELS = {
  overdue: "Overdue",
  today: "Today",
  "this-week": "This week",
  later: "Later",
  "no-due": "No due date",
} as const;

function formatDueLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function TasksClient({ canManage }: { canManage: boolean }) {
  const [scope, setScope] = useState<Scope>("mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View toggle. Default to "cards" — friendlier first impression. The user's
  // pick persists in localStorage so it sticks across reloads.
  const [view, setView] = useState<ViewMode>("cards");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "list" || saved === "cards") setView(saved);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  // Inline new-task form
  const [addOpen, setAddOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params: TaskListParams = {
        status: STATUS_QUERY[statusFilter],
        limit: 200,
      };
      if (scope === "mine") params.assignedUserId = "me";
      if (search.trim()) params.search = search.trim();
      // For open view, also surface SNOOZED-but-due so nothing slips
      // through; for explicit "snoozed" view we keep snoozed-only.
      if (statusFilter === "open") {
        params.status = "OPEN,SNOOZED";
        params.includeSnoozed = "false";
      }
      const res = await tasksApi.list(params);
      setTasks(res.tasks);
      setError(null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!subject.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.create({
        subject: subject.trim(),
        priority,
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      setSubject("");
      setDueAt("");
      setPriority("NORMAL");
      setAddOpen(false);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await tasksApi.complete(id);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to complete task");
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await tasksApi.reopen(id);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to reopen task");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to delete task");
    }
  };

  // Bucket only in OPEN view; other statuses render flat with most-recent first.
  const buckets = useMemo(() => {
    if (statusFilter !== "open") return null;
    const map: Record<string, Task[]> = {
      overdue: [],
      today: [],
      "this-week": [],
      later: [],
      "no-due": [],
    };
    for (const t of tasks) map[bucketKey(t)].push(t);
    return map;
  }, [tasks, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-base-300 bg-base-200 p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded px-2.5 py-1 font-mono-op text-[0.6875rem] uppercase tracking-[0.08em] transition-colors ${
                scope === s ? "bg-base-100 text-primary" : "text-base-content/55 hover:text-base-content"
              }`}
              onClick={() => setScope(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-base-300 bg-base-200 p-0.5">
          {(["open", "done", "snoozed", "cancelled"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded px-2.5 py-1 font-mono-op text-[0.6875rem] uppercase tracking-[0.08em] transition-colors ${
                statusFilter === s ? "bg-base-100 text-primary" : "text-base-content/55 hover:text-base-content"
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search subject + notes…"
          className="input input-bordered input-sm w-56 text-[0.8125rem]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div
          role="tablist"
          aria-label="View mode"
          className="flex items-center gap-0.5 rounded-md border border-base-300 bg-base-200 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "cards"}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              view === "cards"
                ? "bg-base-100 text-primary"
                : "text-base-content/55 hover:text-base-content"
            }`}
            onClick={() => setView("cards")}
            title="Card view"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              view === "list"
                ? "bg-base-100 text-primary"
                : "text-base-content/55 hover:text-base-content"
            }`}
            onClick={() => setView("list")}
            title="List view"
          >
            <ListIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {canManage ? (
          <button
            type="button"
            className="btn btn-primary btn-sm ml-auto gap-1"
            onClick={() => setAddOpen((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> New task
          </button>
        ) : null}
      </div>

      {addOpen ? (
        <div className="flex flex-col gap-1.5 rounded-box border border-base-300 bg-base-200 p-3">
          <input
            type="text"
            placeholder="What needs to happen?"
            className="input input-bordered input-sm w-full"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoFocus
            disabled={submitting}
            data-esc-clearable="true"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="datetime-local"
              className="input input-bordered input-xs h-7 w-52 font-mono-op text-[0.6875rem]"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              min={toLocalInputValue(new Date(Date.now() + 60_000))}
              disabled={submitting}
            />
            <PriorityPicker
              value={priority}
              onChange={setPriority}
              disabled={submitting}
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs ml-auto"
              onClick={() => {
                setAddOpen(false);
                setSubject("");
                setDueAt("");
                setPriority("NORMAL");
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAdd}
              disabled={!subject.trim() || submitting}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      {/* Body */}
      {loading && tasks.length === 0 ? (
        <p className="text-sm text-base-content/55">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="card border border-base-300 bg-base-100 p-6 text-center">
          <p className="text-sm text-base-content/70">
            {statusFilter === "open"
              ? scope === "mine"
                ? "You're all caught up. No open tasks assigned to you."
                : "No open tasks in this workspace."
              : `No ${statusFilter} tasks.`}
          </p>
        </div>
      ) : buckets ? (
        <div className="space-y-6">
          {(["overdue", "today", "this-week", "later", "no-due"] as const).map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            return (
              <section key={key} className="space-y-2">
                <h3 className="op-label">
                  {BUCKET_LABELS[key]}{" "}
                  <span className="font-mono-op text-base-content/40">· {items.length}</span>
                </h3>
                {view === "cards" ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        canManage={canManage}
                        bucket={key}
                        onComplete={handleComplete}
                        onReopen={handleReopen}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="overflow-x-auto rounded-box border border-base-300 divide-y divide-base-300/60">
                    {items.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        canManage={canManage}
                        bucket={key}
                        onComplete={handleComplete}
                        onReopen={handleReopen}
                        onDelete={handleDelete}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              canManage={canManage}
              status={statusFilter}
              onComplete={handleComplete}
              onReopen={handleReopen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <ul className="overflow-x-auto rounded-box border border-base-300 divide-y divide-base-300/60">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              canManage={canManage}
              status={statusFilter}
              onComplete={handleComplete}
              onReopen={handleReopen}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task,
  canManage,
  bucket,
  status,
  onComplete,
  onReopen,
  onDelete,
}: {
  task: Task;
  canManage: boolean;
  bucket?: "overdue" | "today" | "this-week" | "later" | "no-due";
  status?: StatusFilter;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const dueLabel = formatDueLabel(task.dueAt);
  const isDone = task.status === "DONE";
  const isCancelled = task.status === "CANCELLED";
  const isSnoozed = task.status === "SNOOZED";
  return (
    <li className="flex items-start gap-2 px-3 py-2 text-[0.8125rem]">
      {!isDone && !isCancelled && canManage ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square shrink-0"
          title="Mark done"
          onClick={() => onComplete(task.id)}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
          {isDone ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : null}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`line-clamp-2 ${isDone || isCancelled ? "text-base-content/55 line-through" : "text-base-content"}`}
        >
          {task.subject}
        </p>
        {(dueLabel || isSnoozed || (status === "done" && task.completedAt)) ? (
          <p
            className={`mt-0.5 inline-flex items-center gap-1 font-mono-op text-[0.6875rem] ${
              bucket === "overdue" ? "text-error" : "text-base-content/55"
            }`}
          >
            <Clock className="h-3 w-3" aria-hidden />
            {isSnoozed && task.snoozedUntil
              ? `Snoozed until ${formatDueLabel(task.snoozedUntil)}`
              : status === "done" && task.completedAt
                ? `Completed ${formatDueLabel(task.completedAt)}`
                : dueLabel}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {(isDone || isCancelled) && canManage ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            title="Reopen"
            onClick={() => onReopen(task.id)}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
        {canManage ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
            title="Delete"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

const PRIORITY_BADGE: Record<
  Task["priority"],
  { label: string; className: string }
> = {
  LOW: {
    label: "Low",
    className: "border-base-300 bg-base-200 text-base-content/60",
  },
  NORMAL: {
    label: "Normal",
    className: "border-base-300 bg-base-200 text-base-content/70",
  },
  HIGH: {
    label: "High",
    className: "border-error/40 bg-error/10 text-error",
  },
};

function TaskCard({
  task,
  canManage,
  bucket,
  status,
  onComplete,
  onReopen,
  onDelete,
}: {
  task: Task;
  canManage: boolean;
  bucket?: "overdue" | "today" | "this-week" | "later" | "no-due";
  status?: StatusFilter;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const dueLabel = formatDueLabel(task.dueAt);
  const isDone = task.status === "DONE";
  const isCancelled = task.status === "CANCELLED";
  const isSnoozed = task.status === "SNOOZED";
  const overdue = bucket === "overdue";
  const priorityBadge = PRIORITY_BADGE[task.priority];

  // Visual variant per state. Overdue gets an error border accent; high
  // priority gets a subtle left-bar; done/cancelled fade out.
  const accent = overdue
    ? "border-error/40"
    : task.priority === "HIGH"
      ? "border-l-2 border-l-error/60"
      : "border-base-300";
  const dim = isDone || isCancelled ? "opacity-60" : "";

  return (
    <article
      className={`flex flex-col gap-2 rounded-box border bg-base-100 p-3 transition-colors hover:bg-base-200/40 ${accent} ${dim}`}
    >
      <header className="flex items-start gap-2">
        {!isDone && !isCancelled && canManage ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square shrink-0"
            title="Mark done"
            onClick={() => onComplete(task.id)}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
            {isDone ? (
              <Check className="h-3.5 w-3.5 text-success" aria-hidden />
            ) : null}
          </span>
        )}
        <h4
          className={`min-w-0 flex-1 text-[0.875rem] font-medium leading-snug ${
            isDone || isCancelled
              ? "text-base-content/55 line-through"
              : "text-base-content"
          }`}
        >
          {task.subject}
        </h4>
        <span
          className={`shrink-0 rounded-[3px] border px-1.5 py-[1px] font-mono-op text-[0.625rem] uppercase tracking-[0.04em] ${priorityBadge.className}`}
          title={`Priority: ${priorityBadge.label}`}
        >
          {priorityBadge.label}
        </span>
      </header>

      {task.notes?.trim() ? (
        <p className="line-clamp-2 pl-8 text-[0.75rem] text-base-content/65">
          {task.notes.trim()}
        </p>
      ) : null}

      <footer className="flex items-center justify-between gap-2 pl-8">
        <span
          className={`inline-flex items-center gap-1 font-mono-op text-[0.6875rem] ${
            overdue
              ? "text-error"
              : isSnoozed
                ? "text-warning"
                : "text-base-content/55"
          }`}
        >
          <Clock className="h-3 w-3" aria-hidden />
          {isSnoozed && task.snoozedUntil
            ? `Snoozed until ${formatDueLabel(task.snoozedUntil)}`
            : status === "done" && task.completedAt
              ? `Done ${formatDueLabel(task.completedAt)}`
              : dueLabel || "No due date"}
          {overdue ? " · overdue" : ""}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {(isDone || isCancelled) && canManage ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              title="Reopen"
              onClick={() => onReopen(task.id)}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
              title="Delete"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
