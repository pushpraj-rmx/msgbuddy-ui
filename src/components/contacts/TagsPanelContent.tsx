"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { tagsApi } from "@/lib/api";
import type { Tag } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/states";

const TAGS_QUERY_KEY = ["tags"] as const;

export function TagsPanelContent({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Tag | null>(null);

  const { data: tags = [], isFetching } = useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: () => tagsApi.list(),
  });

  // A tag rename/delete is visible on contacts (tag chips/columns) and segments
  // (tag-based membership/counts), so invalidate those too — not just the tag
  // list. Create only changes the available-tags list.
  const invalidateTagDependents = () => {
    queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["segments"] });
    queryClient.invalidateQueries({ queryKey: ["segmentPreview"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) => tagsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY }); setCreating(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) => tagsApi.update(id, data),
    onSuccess: () => { invalidateTagDependents(); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tagsApi.delete(id),
    onSuccess: () => { invalidateTagDependents(); },
  });

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <span className="op-label">Tags · {tags.length}</span>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary btn-xs gap-1"
            onClick={() => { setEditing(null); setCreating(true); }}
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      {/* Inline create/edit form */}
      {(creating || editing) && canManage && (
        <TagInlineForm
          tag={editing}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(data) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      )}

      {/* Tag list */}
      {isFetching && tags.length === 0 ? (
        <div className="flex justify-center py-6">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      ) : tags.length === 0 && !creating ? (
        <div className="px-4 py-4">
          <EmptyState
            title="No tags yet"
            description="Create tags to organize contacts and use them in segments."
          />
        </div>
      ) : (
        <ul className="flex flex-col">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-2.5 border-b border-base-300 px-4 py-2.5 last:border-b-0"
            >
              {tag.color ? (
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-base-300"
                  style={{ backgroundColor: tag.color }}
                />
              ) : (
                <span className="h-3 w-3 shrink-0 rounded-full border border-base-300 bg-base-300" />
              )}
              <span className="flex-1 truncate text-[0.8125rem] font-medium">{tag.name}</span>
              {canManage && (
                <div className="flex items-center gap-0.5">
                  <div className="tooltip tooltip-left" data-tip="Edit">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square"
                      onClick={() => { setCreating(false); setEditing(tag); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="tooltip tooltip-left" data-tip="Delete">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
                      onClick={() => setConfirmDelete(tag)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.name ?? ""}"?`}
        description="Tag will be removed from all contacts."
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function TagInlineForm({
  tag,
  isPending,
  onSubmit,
  onCancel,
}: {
  tag: Tag | null;
  isPending: boolean;
  onSubmit: (data: { name: string; color?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? "");

  // Mirror the backend's hex validation (create-tag DTO) so an invalid free-text
  // hex doesn't silently 400. Empty is allowed (color is optional).
  const trimmedColor = color.trim();
  const colorValid = trimmedColor === "" || /^#[0-9a-fA-F]{3,8}$/.test(trimmedColor);

  return (
    <div className="border-b border-base-300 bg-base-200 px-4 py-3 space-y-2">
      <span className="op-label">{tag ? "Edit tag" : "New tag"}</span>
      <input
        type="text"
        className="input input-bordered input-sm w-full"
        placeholder="Tag name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded border border-base-300"
          value={colorValid && trimmedColor ? trimmedColor : "#6b7280"}
          onChange={(e) => setColor(e.target.value)}
        />
        <input
          type="text"
          className={`input input-bordered input-sm flex-1 font-mono-op text-[0.6875rem] ${
            colorValid ? "" : "input-error"
          }`}
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#hex"
        />
      </div>
      {!colorValid ? (
        <p className="text-[0.6875rem] text-error">
          Enter a valid hex colour, e.g. #16a34a.
        </p>
      ) : null}
      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn btn-ghost btn-xs" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-xs"
          onClick={() => onSubmit({ name: name.trim(), color: trimmedColor || undefined })}
          disabled={!name.trim() || !colorValid || isPending}
        >
          {isPending ? <span className="loading loading-spinner loading-xs" /> : tag ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );
}
