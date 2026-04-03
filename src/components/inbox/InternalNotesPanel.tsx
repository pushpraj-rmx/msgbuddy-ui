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
    <div className="rounded-none bg-base-100 p-3 space-y-2">
      <h3 className="text-sm font-medium">Internal notes</h3>
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
        <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
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

