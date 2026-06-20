"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiError } from "@/lib/api-error";
import {
  automationApi,
  type AutomationActionType,
  type AutomationRule,
  type AutomationTriggerType,
} from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * List + create/edit drawer for automation rules. The create/edit form is
 * deliberately minimal — picks trigger and action type, captures the per-type
 * config inline, and submits. Validation duplicated server-side; the form
 * just gates the obviously-bad cases.
 */

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  WELCOME: "First inbound from contact (welcome)",
  OUT_OF_HOURS: "Inbound outside business hours",
  KEYWORD: "Inbound contains a keyword",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  SEND_TEMPLATE: "Send template",
  SEND_TEXT: "Send text reply",
  ASSIGN_AGENT: "Assign to agent",
};

type DraftState = {
  id?: string;
  name: string;
  trigger: AutomationTriggerType;
  action: AutomationActionType;
  priority: number;
  isActive: boolean;
  // trigger config — KEYWORD only
  keywords: string[];
  // action config
  channelTemplateVersionId: string;
  text: string;
  userId: string;
};

const blankDraft = (): DraftState => ({
  name: "",
  trigger: "WELCOME",
  action: "SEND_TEMPLATE",
  priority: 0,
  isActive: true,
  keywords: [],
  channelTemplateVersionId: "",
  text: "",
  userId: "",
});

function ruleToDraft(rule: AutomationRule): DraftState {
  const cfg = (rule.actionConfig ?? {}) as Record<string, unknown>;
  const trig = (rule.triggerConfig ?? {}) as Record<string, unknown>;
  const keywords = Array.isArray(trig.keywords)
    ? (trig.keywords as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    action: rule.action,
    priority: rule.priority,
    isActive: rule.isActive,
    keywords,
    channelTemplateVersionId: String(cfg.channelTemplateVersionId ?? ""),
    text: String(cfg.text ?? ""),
    userId: String(cfg.userId ?? ""),
  };
}

function draftToActionConfig(d: DraftState): Record<string, unknown> {
  switch (d.action) {
    case "SEND_TEMPLATE":
      return { channelTemplateVersionId: d.channelTemplateVersionId.trim() };
    case "SEND_TEXT":
      return { text: d.text };
    case "ASSIGN_AGENT":
      return { userId: d.userId.trim() };
  }
}

function draftToTriggerConfig(
  d: DraftState,
): Record<string, unknown> | undefined {
  if (d.trigger === "KEYWORD") {
    return { keywords: d.keywords.map((k) => k.trim()).filter(Boolean) };
  }
  // WELCOME / OUT_OF_HOURS take no config; sending undefined lets the backend
  // clear any stale value via Prisma.JsonNull.
  return undefined;
}

export function AutomationsClient({ initial }: { initial: AutomationRule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState<AutomationRule[]>(initial);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AutomationRule | null>(null);

  const refresh = async () => {
    try {
      const data = await automationApi.listRules();
      setRules(data);
    } catch {
      // non-fatal
    }
    router.refresh();
  };

  const upsert = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const triggerConfig = draftToTriggerConfig(draft);
      const body = {
        name: draft.name.trim(),
        trigger: draft.trigger,
        ...(triggerConfig !== undefined ? { triggerConfig } : {}),
        action: draft.action,
        actionConfig: draftToActionConfig(draft),
        priority: draft.priority,
        isActive: draft.isActive,
      };
      if (draft.id) {
        await automationApi.updateRule(draft.id, body);
      } else {
        await automationApi.createRule(body);
      }
      setDraft(null);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string) => {
    try {
      await automationApi.toggleRule(id);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to toggle rule.");
    }
  };

  const remove = async (id: string) => {
    try {
      await automationApi.deleteRule(id);
      setDeleting(null);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to delete rule.");
    }
  };

  const submitDisabled =
    !draft ||
    saving ||
    draft.name.trim().length === 0 ||
    (draft.trigger === "KEYWORD" &&
      draft.keywords.filter((k) => k.trim().length > 0).length === 0) ||
    (draft.action === "SEND_TEMPLATE" &&
      draft.channelTemplateVersionId.trim().length === 0) ||
    (draft.action === "SEND_TEXT" && draft.text.trim().length === 0) ||
    (draft.action === "ASSIGN_AGENT" && draft.userId.trim().length === 0);

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-base-content/65">
          Out-of-hours rules need{" "}
          <Link href="/settings/business-hours" className="link link-primary">
            business hours
          </Link>{" "}
          configured and active.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setDraft(blankDraft())}
        >
          New rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 p-6 text-center">
          <p className="text-sm text-base-content/70">
            No automation rules yet. Create one to auto-reply to first inbound
            messages or out-of-hours pings.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Action</th>
                <th className="text-right">Priority</th>
                <th className="text-right">Fires</th>
                <th>Last fired</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="align-middle">
                  <td className="font-medium">{r.name}</td>
                  <td>
                    <span className="rounded-[3px] border border-base-300 bg-base-200 px-1.5 py-[1px] font-mono-op text-[0.625rem] uppercase tracking-[0.04em]">
                      {r.trigger}
                    </span>
                  </td>
                  <td>
                    <span className="rounded-[3px] border border-base-300 bg-base-200 px-1.5 py-[1px] font-mono-op text-[0.625rem] uppercase tracking-[0.04em]">
                      {r.action}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{r.priority}</td>
                  <td className="text-right tabular-nums">{r.triggerCount}</td>
                  <td className="text-xs text-base-content/65">
                    {r.lastTriggeredAt
                      ? new Date(r.lastTriggeredAt).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-primary"
                      checked={r.isActive}
                      onChange={() => void toggle(r.id)}
                    />
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setDraft(ruleToDraft(r))}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => setDeleting(r)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft ? (
        <dialog className="modal modal-open" aria-modal>
          <div className="modal-box max-w-xl">
            <h3 className="text-lg font-semibold tracking-tight">
              {draft.id ? "Edit rule" : "New automation rule"}
            </h3>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="op-label mb-1 block">Name</span>
                <input
                  className="input input-bordered w-full"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  placeholder="e.g. Welcome message"
                />
              </label>

              <label className="block">
                <span className="op-label mb-1 block">Trigger</span>
                <select
                  className="select select-bordered w-full"
                  value={draft.trigger}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      trigger: e.target.value as AutomationTriggerType,
                    })
                  }
                >
                  {(Object.keys(TRIGGER_LABELS) as AutomationTriggerType[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {TRIGGER_LABELS[k]}
                      </option>
                    ),
                  )}
                </select>
                {draft.trigger === "OUT_OF_HOURS" ? (
                  <p className="mt-1 text-xs text-base-content/55">
                    Requires <Link href="/settings/business-hours" className="link">business hours</Link> to be configured + active.
                  </p>
                ) : null}
                {draft.trigger === "KEYWORD" ? (
                  <p className="mt-1 text-xs text-base-content/55">
                    Match is case-insensitive and word-boundary, so &quot;STOP&quot; matches &quot;please STOP.&quot; but not &quot;stopwatch.&quot; Cooldown: 1 hour per contact per rule.
                  </p>
                ) : null}
              </label>

              {draft.trigger === "KEYWORD" ? (
                <KeywordsInput
                  keywords={draft.keywords}
                  onChange={(next) => setDraft({ ...draft, keywords: next })}
                />
              ) : null}

              <label className="block">
                <span className="op-label mb-1 block">Action</span>
                <select
                  className="select select-bordered w-full"
                  value={draft.action}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      action: e.target.value as AutomationActionType,
                    })
                  }
                >
                  {(Object.keys(ACTION_LABELS) as AutomationActionType[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {ACTION_LABELS[k]}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {draft.action === "SEND_TEMPLATE" ? (
                <label className="block">
                  <span className="op-label mb-1 block">
                    Channel template version id
                  </span>
                  <input
                    className="input input-bordered w-full font-mono-op"
                    value={draft.channelTemplateVersionId}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        channelTemplateVersionId: e.target.value,
                      })
                    }
                    placeholder="ctv_…"
                  />
                  <p className="mt-1 text-xs text-base-content/55">
                    Find this on the template detail page. Required for SEND_TEMPLATE — out-of-hours and welcome to never-seen contacts both need a template (freeform sends are blocked outside the 24h window).
                  </p>
                </label>
              ) : null}

              {draft.action === "SEND_TEXT" ? (
                <label className="block">
                  <span className="op-label mb-1 block">Reply text</span>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={draft.text}
                    onChange={(e) =>
                      setDraft({ ...draft, text: e.target.value })
                    }
                    placeholder="Hi! Thanks for reaching out. We&apos;ll get back to you shortly."
                  />
                  <p className="mt-1 text-xs text-warning">
                    Freeform replies only work inside the 24h customer-care window. For WELCOME on never-seen contacts, use SEND_TEMPLATE instead.
                  </p>
                </label>
              ) : null}

              {draft.action === "ASSIGN_AGENT" ? (
                <label className="block">
                  <span className="op-label mb-1 block">Agent user id</span>
                  <input
                    className="input input-bordered w-full font-mono-op"
                    value={draft.userId}
                    onChange={(e) =>
                      setDraft({ ...draft, userId: e.target.value })
                    }
                    placeholder="usr_…"
                  />
                </label>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="op-label mb-1 block">Priority</span>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        priority: Number(e.target.value) || 0,
                      })
                    }
                    min={0}
                  />
                </label>
                <label className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={draft.isActive}
                    onChange={(e) =>
                      setDraft({ ...draft, isActive: e.target.checked })
                    }
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void upsert()}
                disabled={submitDisabled}
              >
                {saving ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Saving…
                  </>
                ) : draft.id ? (
                  "Save"
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            onClick={() => setDraft(null)}
            aria-label="Close"
          />
        </dialog>
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title="Delete rule"
        description={
          deleting
            ? `Delete "${deleting.name}"? This stops future fires immediately and removes the fire history.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (deleting) void remove(deleting.id);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/**
 * Tag-style keyword editor. Type a keyword and press Enter (or comma) to add;
 * click × on a chip to remove. Empty-trimmed entries dropped on save; dedupe
 * is enforced server-side too but we suppress duplicate visual entries here.
 */
function KeywordsInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (next: string[]) => void;
}) {
  const [pending, setPending] = useState("");

  const commit = () => {
    const v = pending.trim();
    if (!v) return;
    const lower = v.toLowerCase();
    if (keywords.some((k) => k.toLowerCase() === lower)) {
      setPending("");
      return;
    }
    onChange([...keywords, v]);
    setPending("");
  };

  return (
    <label className="block">
      <span className="op-label mb-1 block">Keywords</span>
      <div className="rounded-box border border-base-300 bg-base-100 p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {keywords.map((k, i) => (
            <span
              key={`${k}-${i}`}
              className="inline-flex items-center gap-1 rounded-[3px] border border-base-300 bg-base-200 px-1.5 py-0.5 font-mono-op text-[0.6875rem] uppercase tracking-[0.04em]"
            >
              {k}
              <button
                type="button"
                className="text-base-content/55 hover:text-error"
                onClick={() =>
                  onChange(keywords.filter((_, idx) => idx !== i))
                }
                aria-label={`Remove ${k}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="input input-sm flex-1 min-w-[10rem] border-0 bg-transparent focus:outline-none"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              } else if (
                e.key === "Backspace" &&
                pending.length === 0 &&
                keywords.length > 0
              ) {
                onChange(keywords.slice(0, -1));
              }
            }}
            onBlur={commit}
            placeholder={
              keywords.length === 0
                ? 'Type a keyword and press Enter (e.g. "STOP", "HELP", "opt out")'
                : "Add another…"
            }
            maxLength={100}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-base-content/55">
        Up to 50 keywords. Multi-word phrases match as a literal sequence.
      </p>
    </label>
  );
}
