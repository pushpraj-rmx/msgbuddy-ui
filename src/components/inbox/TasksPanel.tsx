"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, Plus, Trash2 } from "lucide-react";
import { tasksApi, type Task, type TaskPriority } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { PriorityPicker } from "@/components/tasks/PriorityPicker";

/**
 * Per-contact tasks list shown inside the inbox right panel. Lists OPEN +
 * SNOOZED-but-due tasks for the contact and offers a quick-add row. Heavier
 * editing (priority, notes, reassign) lives on the `/tasks` page — this is
 * the agent's "remind me to call them back" affordance.
 */

function shortDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `today · ${time}`;
  if (isTomorrow) return `tomorrow · ${time}`;
  const withinWeek = d.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000 &&
    d.getTime() - now.getTime() > 0;
  return withinWeek
    ? `${d.toLocaleDateString(undefined, { weekday: "short" })} · ${time}`
    : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function quickDuePresets() {
  const now = new Date();
  const inHours = (h: number) => {
    const d = new Date(now);
    d.setHours(d.getHours() + h);
    return d;
  };
  const tomorrowAt = (h: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(h, 0, 0, 0);
    return d;
  };
  return [
    { label: "+1h", date: inHours(1) },
    { label: "+3h", date: inHours(3) },
    { label: "Tomorrow 9 AM", date: tomorrowAt(9) },
  ];
}

export function TasksPanel({
  contactId,
  conversationId,
}: {
  contactId: string;
  conversationId?: string | null;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline create form
  const [adding, setAdding] = useState(false);
  const [subject, setSubject] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const res = await tasksApi.list({
        contactId,
        status: "OPEN,SNOOZED",
        includeSnoozed: "true",
        limit: 50,
      });
      setTasks(res.tasks);
      setError(null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!subject.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.create({
        subject: subject.trim(),
        contactId,
        priority,
        ...(conversationId ? { conversationId } : {}),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      setSubject("");
      setDueAt("");
      setPriority("NORMAL");
      setAdding(false);
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
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to complete task");
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

  const visibleTasks = useMemo(() => {
    // Hide SNOOZED tasks that are still asleep — agent doesn't need to see
    // them now (they'll auto-reappear at wake time on next refresh).
    return tasks.filter((t) => {
      if (t.status !== "SNOOZED") return true;
      if (!t.snoozedUntil) return true;
      return new Date(t.snoozedUntil).getTime() <= Date.now();
    });
  }, [tasks]);

  const presets = quickDuePresets();

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="op-label">Tasks</span>
        <button
          type="button"
          className="btn btn-ghost btn-xs gap-1"
          onClick={() => setAdding((v) => !v)}
          title={adding ? "Cancel" : "Add task"}
        >
          <Plus className="h-3 w-3" aria-hidden />
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-1.5 rounded-box border border-base-300 bg-base-200 p-2">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Call back, follow up on quote…"
            className="input input-bordered input-sm w-full text-[0.8125rem]"
            autoFocus
            disabled={submitting}
            data-esc-clearable="true"
          />
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input input-bordered input-xs h-7 w-44 font-mono-op text-[0.6875rem]"
              min={toLocalInputValue(new Date(Date.now() + 60_000))}
              disabled={submitting}
            />
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn btn-ghost btn-xs border border-base-300 font-normal hover:border-primary/40 hover:text-primary"
                disabled={submitting}
                onClick={() => setDueAt(toLocalInputValue(p.date))}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-primary btn-xs ml-auto"
              disabled={!subject.trim() || submitting}
              onClick={handleAdd}
            >
              {submitting ? "…" : "Save"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <PriorityPicker
              value={priority}
              onChange={setPriority}
              disabled={submitting}
              size="xs"
            />
          </div>
        </div>
      )}

      {error ? (
        <p className="text-[0.6875rem] text-error">{error}</p>
      ) : null}

      {loading && visibleTasks.length === 0 ? (
        <p className="text-[0.75rem] text-base-content/50">Loading…</p>
      ) : visibleTasks.length === 0 ? (
        <p className="text-[0.75rem] text-base-content/50">
          No open tasks for this contact.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-base-300/60">
          {visibleTasks.map((t) => {
            const due = shortDateLabel(t.dueAt);
            const overdue =
              !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();
            return (
              <li key={t.id} className="flex items-start gap-2 py-1.5">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square shrink-0"
                  title="Mark done"
                  onClick={() => handleComplete(t.id)}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[0.8125rem] text-base-content">
                    {t.subject}
                  </p>
                  {due ? (
                    <p
                      className={`mt-0.5 inline-flex items-center gap-1 font-mono-op text-[0.625rem] ${
                        overdue ? "text-error" : "text-base-content/55"
                      }`}
                    >
                      <Clock className="h-2.5 w-2.5" aria-hidden /> {due}
                      {overdue ? " · overdue" : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square shrink-0 text-error/70 hover:text-error"
                  title="Delete task"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
