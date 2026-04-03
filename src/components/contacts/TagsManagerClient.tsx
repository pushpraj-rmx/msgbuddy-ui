"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { tagsApi } from "@/lib/api";
import type { Tag } from "@/lib/types";

const TAGS_QUERY_KEY = ["tags"] as const;

export function TagsManagerClient() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const { data: tags = [], isFetching } = useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: () => tagsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      tagsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
      setModalOpen(false);
      setEditingTag(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; color?: string };
    }) => tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
      setModalOpen(false);
      setEditingTag(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
      setModalOpen(false);
      setEditingTag(null);
    },
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/people/contacts" className="btn btn-ghost btn-sm">
          ← People
        </Link>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditingTag(null);
            setModalOpen(true);
          }}
        >
          + New tag
        </button>
      </div>

      {isFetching && tags.length === 0 ? (
        <div className="loading loading-spinner loading-lg" />
      ) : tags.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-200 p-8 text-center">
          <p className="text-sm text-base-content/70">
            No tags yet. Create a tag to organize contacts and use them in
            segments.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-4"
            onClick={() => setModalOpen(true)}
          >
            Create your first tag
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Color</th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td className="font-medium">{tag.name}</td>
                  <td>
                    {tag.color ? (
                      <span
                        className="inline-block h-5 w-5 rounded-full border border-base-300"
                        style={{ backgroundColor: tag.color }}
                        aria-hidden
                      />
                    ) : (
                      <span className="text-base-content/50">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setEditingTag(tag);
                          setModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete tag "${tag.name}"? It will be removed from all contacts.`
                            )
                          )
                            deleteMutation.mutate(tag.id);
                        }}
                        disabled={isPending}
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

      {(modalOpen || editingTag) && (
        <TagFormModal
          tag={editingTag}
          onClose={() => {
            setModalOpen(false);
            setEditingTag(null);
          }}
          onSubmit={(data) => {
            if (editingTag) {
              updateMutation.mutate({
                id: editingTag.id,
                data: { name: data.name, color: data.color },
              });
            } else {
              createMutation.mutate(data);
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

function TagFormModal({
  tag,
  onClose,
  onSubmit,
  isPending,
}: {
  tag: Tag | null;
  onClose: () => void;
  onSubmit: (data: { name: string; color?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? "");

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-md rounded-box">
        <h3 className="text-lg font-semibold">
          {tag ? "Edit tag" : "New tag"}
        </h3>
        <div className="mt-4 space-y-4">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. VIP, Newsletter"
          />
          <label className="label">
            <span className="label-text">Color (optional, hex)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded border border-base-300"
              value={color || "#6b7280"}
              onChange={(e) => setColor(e.target.value)}
              title="Color"
            />
            <input
              type="text"
              className="input input-bordered flex-1 font-mono text-sm"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#6b7280"
            />
          </div>
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onSubmit({ name: name.trim(), color: color.trim() || undefined })
            }
            disabled={!name.trim() || isPending}
          >
            {isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : tag ? (
              "Save"
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
