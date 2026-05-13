"use client";

import { useEffect, useState } from "react";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";
import { internalApi, type InternalNote } from "@/lib/api";

export function InternalNotesPanel({
  conversationId,
}: {
  conversationId: string;
}) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await internalApi.listNotes("CONVERSATION", conversationId);
      setNotes(rows ?? []);
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Failed to load internal notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const add = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await internalApi.createNote({
        targetType: "CONVERSATION",
        targetId: conversationId,
        content: draft.trim(),
      });
      setDraft("");
      await load();
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Failed to create internal note.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await internalApi.deleteNote(id);
      await load();
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Failed to delete internal note.");
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await internalApi.toggleNotePin(id);
      await load();
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Failed to toggle note pin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-l-2 border-warning bg-warning/5 p-3 space-y-2">
      <span className="op-label text-warning">Internal note</span>
      <div className="flex items-center gap-2">
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Add internal note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={add}
          disabled={busy || !draft.trim()}
        >
          Add
        </button>
      </div>
      {error ? (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {loading ? (
        <span className="loading loading-spinner loading-sm" />
      ) : notes.length ? (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-none p-2">
              <p className="text-xs">{note.content}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-base-content/60">
                <span>{note.authorId || "unknown"}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => togglePin(note.id)}
                    disabled={busy}
                  >
                    {note.isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => remove(note.id)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-base-content/60">No internal notes yet.</p>
      )}
    </div>
  );
}

