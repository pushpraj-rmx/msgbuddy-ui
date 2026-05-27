"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiError } from "@/lib/api-error";
import { cannedResponsesApi, type CannedResponse } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Canned responses (a.k.a. quick replies). The composer in the inbox detects
 * `/<shortcut>` and inserts the canned content; this page is the CRUD home.
 */

const SHORTCUT_RE = /^[a-z0-9_-]+$/;

type Draft = {
  id?: string;
  shortcut: string;
  title: string;
  content: string;
};

const blankDraft = (): Draft => ({ shortcut: "", title: "", content: "" });

function toDraft(c: CannedResponse): Draft {
  return {
    id: c.id,
    shortcut: c.shortcut,
    title: c.title,
    content: c.content,
  };
}

export function CannedResponsesClient({
  initial,
  canManage,
}: {
  initial: CannedResponse[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CannedResponse[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CannedResponse | null>(null);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    try {
      const data = await cannedResponsesApi.list();
      setItems(data);
    } catch {
      // non-fatal
    }
    router.refresh();
  };

  const submitDisabled =
    !draft ||
    saving ||
    draft.shortcut.trim().length === 0 ||
    !SHORTCUT_RE.test(draft.shortcut.trim().toLowerCase()) ||
    draft.title.trim().length === 0 ||
    draft.content.trim().length === 0 ||
    draft.content.length > 4096;

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        shortcut: draft.shortcut.trim().toLowerCase(),
        title: draft.title.trim(),
        content: draft.content,
      };
      if (draft.id) {
        await cannedResponsesApi.update(draft.id, body);
      } else {
        await cannedResponsesApi.create(body);
      }
      setDraft(null);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to save canned response.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await cannedResponsesApi.delete(id);
      setDeleting(null);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to delete canned response.");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.shortcut.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-base-content/65">
          Type{" "}
          <code className="rounded bg-base-200 px-1 font-mono-op text-[0.6875rem]">
            /shortcut
          </code>{" "}
          in the inbox composer to insert canned text.
        </p>
        {canManage ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setDraft(blankDraft())}
          >
            New canned response
          </button>
        ) : null}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Search by shortcut, title or content"
          className="input input-bordered input-sm w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card border border-base-300 bg-base-100 p-6 text-center">
          <p className="text-sm text-base-content/70">
            {items.length === 0
              ? "No canned responses yet. Save your most-used replies as shortcuts so agents can fire them with one keystroke."
              : "No matches for the current search."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Title</th>
                <th className="hidden md:table-cell">Content</th>
                <th className="hidden md:table-cell text-right">Uses</th>
                {canManage ? <th aria-label="actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono-op text-[0.75rem] text-primary">
                    /{c.shortcut}
                  </td>
                  <td className="font-medium">{c.title}</td>
                  <td className="hidden md:table-cell text-base-content/70">
                    <span className="line-clamp-1">{c.content}</span>
                  </td>
                  <td className="hidden md:table-cell text-right font-mono-op text-[0.75rem] tabular-nums text-base-content/55">
                    {c.usageCount}
                  </td>
                  {canManage ? (
                    <td className="whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setDraft(toDraft(c))}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => setDeleting(c)}
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl">
            <h3 className="text-lg font-semibold">
              {draft.id ? "Edit canned response" : "New canned response"}
            </h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="op-label mb-1 block">Shortcut</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono-op text-base-content/55">/</span>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full font-mono-op"
                    placeholder="thanks"
                    value={draft.shortcut}
                    onChange={(e) =>
                      setDraft({ ...draft, shortcut: e.target.value })
                    }
                    autoFocus
                  />
                </div>
                <span className="mt-1 block text-[0.6875rem] text-base-content/55">
                  Lowercase letters, digits, dashes, or underscores.
                </span>
              </label>
              <label className="block">
                <span className="op-label mb-1 block">Title</span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="Thanks reply"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="op-label mb-1 flex items-center justify-between">
                  <span>Content</span>
                  <span className="font-mono-op text-[0.625rem] tabular-nums text-base-content/40">
                    {draft.content.length} / 4096
                  </span>
                </span>
                <textarea
                  className="textarea textarea-bordered w-full text-sm"
                  rows={6}
                  placeholder="Thanks for reaching out! How can we help today?"
                  value={draft.content}
                  onChange={(e) =>
                    setDraft({ ...draft, content: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={save}
                disabled={submitDisabled}
              >
                {saving ? "Saving..." : draft.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDraft(null)} />
        </dialog>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          open
          title="Delete canned response?"
          description={`/${deleting.shortcut} — "${deleting.title}" will be removed.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => remove(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
