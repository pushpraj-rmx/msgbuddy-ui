"use client";

import { useEffect, useRef, useState } from "react";
import { tasksApi, type TaskPriority } from "@/lib/api";

/**
 * Lightweight "Create task" modal launched from a message bubble's context
 * menu. Pre-bakes `contactId` + `conversationId` so the task is auto-linked
 * to the conversation the agent is reading — no picker needed.
 *
 * Intentionally minimal: subject + due (with preset chips) + priority. The
 * agent can refine notes / reassign later from /tasks. Keeps the path from
 * "I see a customer's message" → "task created" to two clicks + one input.
 *
 * tasksApi.create auto-dispatches TASK_CHANGED_EVENT, so the Topbar badge
 * and the dashboard My-tasks panel refresh without extra wiring.
 */
export function CreateTaskFromMessageModal({
  open,
  contactId,
  conversationId,
  messageId,
  contactName,
  messageText,
  onClose,
  onCreated,
}: {
  open: boolean;
  contactId?: string;
  conversationId?: string;
  /** Pinpoints the task to a specific message — drives the bubble badge. */
  messageId?: string;
  contactName?: string;
  messageText?: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form to a sensible default whenever the modal re-opens so the
  // agent doesn't see leftover state from a previous message.
  useEffect(() => {
    if (!open) return;
    const seed =
      (messageText ?? "").trim().slice(0, 80) ||
      (contactName ? `Follow up with ${contactName}` : "Follow up");
    setSubject(seed);
    setDueAt("");
    setPriority("NORMAL");
    setError(null);
    setBusy(false);
  }, [open, messageText, contactName]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Slight delay so showModal()'s focus default doesn't fight us.
      window.setTimeout(() => subjectRef.current?.select(), 0);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCloseDlg = () => onClose();
    el.addEventListener("close", onCloseDlg);
    return () => el.removeEventListener("close", onCloseDlg);
  }, [onClose]);

  const presets: Array<{ label: string; date: Date }> = (() => {
    const today6pm = new Date();
    today6pm.setHours(18, 0, 0, 0);
    const tomorrow9 = new Date();
    tomorrow9.setDate(tomorrow9.getDate() + 1);
    tomorrow9.setHours(9, 0, 0, 0);
    const in1h = new Date(Date.now() + 60 * 60 * 1000);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0);
    return [
      { label: "+1h", date: in1h },
      { label: "Today 6 PM", date: today6pm },
      { label: "Tomorrow 9 AM", date: tomorrow9 },
      { label: "Next week", date: nextWeek },
    ];
  })();

  const toLocalInputValue = (d: Date): string => {
    // datetime-local needs "YYYY-MM-DDTHH:mm" in the BROWSER zone (not UTC),
    // otherwise the picker shows the wrong wall time.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setError("Add a short subject.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await tasksApi.create({
        subject: trimmedSubject,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        contactId,
        conversationId,
        messageId,
      });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create task.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div className="modal-box max-w-md space-y-3">
        <div>
          <span className="op-label text-primary">new task</span>
          <h3 className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.015em]">
            Create task
            {contactName ? (
              <span className="ml-2 font-normal text-base-content/60">
                · {contactName}
              </span>
            ) : null}
          </h3>
        </div>

        <label className="form-control w-full">
          <span className="op-label mb-1">Subject</span>
          <input
            ref={subjectRef}
            type="text"
            className="input input-bordered input-sm w-full"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Follow up with…"
            maxLength={200}
            disabled={busy}
          />
        </label>

        <div className="form-control w-full">
          <span className="op-label mb-1">Due</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input input-bordered input-xs h-7 w-56 font-mono-op text-[0.6875rem]"
              disabled={busy}
            />
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn btn-ghost btn-xs border border-base-300 font-normal hover:border-primary/40 hover:text-primary"
                onClick={() => setDueAt(toLocalInputValue(p.date))}
                disabled={busy}
              >
                {p.label}
              </button>
            ))}
            {dueAt ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-base-content/55"
                onClick={() => setDueAt("")}
                disabled={busy}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="form-control w-full">
          <span className="op-label mb-1">Priority</span>
          <div className="flex gap-1.5">
            {(["LOW", "NORMAL", "HIGH"] as const).map((p) => {
              const active = priority === p;
              const tone =
                p === "HIGH"
                  ? "border-error/40 text-error"
                  : p === "LOW"
                    ? "border-base-300 text-base-content/55"
                    : "border-base-300";
              return (
                <button
                  key={p}
                  type="button"
                  className={`btn btn-xs border ${tone} ${
                    active ? "bg-base-300/70" : "bg-transparent"
                  }`}
                  onClick={() => setPriority(p)}
                  disabled={busy}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-error">{error}</p>
        ) : null}

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={busy || !subject.trim()}
          >
            {busy ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Create task
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" className="sr-only" aria-label="Close">
          close
        </button>
      </form>
    </dialog>
  );
}
