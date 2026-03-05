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
      <div>
        <label className="label">
          <span className="label-text">Add note</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full"
          placeholder="Write a note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm mt-2"
          onClick={() => {
            if (!content.trim()) return;
            createMutation.mutate(content.trim());
          }}
          disabled={!content.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Add note"
          )}
        </button>
      </div>
      <ul className="space-y-2">
        {notes.map((note) => (
          <li
            key={note.id}
            className="rounded-box border border-base-300 bg-base-200 p-3"
          >
            <p className="text-sm">{note.content}</p>
            <p className="mt-1 text-xs text-base-content/60">
              {new Date(note.createdAt).toLocaleString()}
              {canDelete(note) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs ml-2 text-error"
                  onClick={() => deleteMutation.mutate(note.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
