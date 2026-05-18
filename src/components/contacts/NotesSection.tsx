"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { contactsApi } from "@/lib/api";
import type { ContactNote } from "@/lib/types";

export function NotesSection({
  contactId,
  currentUserId,
}: {
  contactId: string;
  currentUserId?: string;
}) {
  const [content, setContent] = useState("");

  const { data: notes = [], refetch } = useQuery({
    queryKey: ["contacts", contactId, "notes"],
    queryFn: () => contactsApi.listNotes(contactId),
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => contactsApi.createNote(contactId, text),
    onSuccess: () => {
      setContent("");
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) =>
      contactsApi.deleteNote(contactId, noteId),
    onSuccess: () => refetch(),
  });

  const canDelete = (note: ContactNote) =>
    currentUserId && note.authorUserId === currentUserId;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="op-label block">Add note</span>
        <textarea
          className="textarea textarea-bordered w-full text-[0.8125rem]"
          placeholder="Write a note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (!content.trim()) return;
              createMutation.mutate(content.trim());
            }}
            disabled={!content.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Add note"
            )}
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="text-[0.8125rem] text-base-content/55">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-box border border-base-300 bg-base-200 px-3 py-2.5"
            >
              <p className="text-[0.8125rem] text-base-content">{note.content}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="font-mono-op text-[0.625rem] tracking-[0.04em] tabular-nums text-base-content/50">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
                {canDelete(note) && (
                  <button
                    type="button"
                    className="font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-error/70 transition-colors hover:text-error disabled:opacity-50"
                    onClick={() => deleteMutation.mutate(note.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
