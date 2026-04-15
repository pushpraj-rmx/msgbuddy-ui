"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { segmentsApi } from "@/lib/api";
import type { Segment, SegmentQuery } from "@/lib/types";
import { SegmentFormModal } from "./SegmentFormModal";
import { SegmentPreviewModal } from "./SegmentPreviewModal";

const SEGMENTS_QUERY_KEY = ["segments"] as const;

export function SegmentsPageClient({
  canManageSegments,
}: {
  canManageSegments: boolean;
}) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [previewingSegment, setPreviewingSegment] = useState<Segment | null>(null);

  const { data: segments = [] } = useQuery({
    queryKey: SEGMENTS_QUERY_KEY,
    queryFn: () => segmentsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      query: SegmentQuery;
    }) => segmentsApi.create(data),
    onSuccess: async (created) => {
      try {
        await segmentsApi.preview(created.id);
      } catch {
        // Best effort; preview is still available via explicit action.
      }
      queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
      setModalOpen(false);
      setEditingSegment(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string; query?: SegmentQuery };
    }) => segmentsApi.update(id, data),
    onSuccess: async (updated) => {
      try {
        await segmentsApi.preview(updated.id);
      } catch {
        // Best effort
      }
      queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
      setModalOpen(false);
      setEditingSegment(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => segmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
      setEditingSegment(null);
    },
  });

  const handleDelete = (seg: Segment) => {
    if (confirm(`Delete segment "${seg.name}"?`)) deleteMutation.mutate(seg.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Segments</h1>
          <p className="text-sm text-base-content/60">
            Saved filters to quickly view a subset of contacts on the Contacts page.
          </p>
        </div>
        {canManageSegments ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingSegment(null);
              setModalOpen(true);
            }}
          >
            + New segment
          </button>
        ) : null}
      </div>

      {segments.length === 0 && !modalOpen && (
        <div className="rounded-box border border-base-300 bg-base-200 p-8 text-center">
          <p className="text-sm text-base-content/70">
            {canManageSegments
              ? "No segments yet. Create a segment to filter contacts by tags, email, blocked/opted-out, or last message date."
              : "No segments available yet."}
          </p>
          {canManageSegments ? (
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={() => setModalOpen(true)}
            >
              Create your first segment
            </button>
          ) : null}
        </div>
      )}

      {segments.length > 0 && (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Contacts</th>
                <th className="w-0">{canManageSegments ? "Actions" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.id}>
                  <td className="font-medium">
                    <Link
                      href={`/people/contacts?segment=${seg.id}`}
                      className="link link-hover"
                    >
                      {seg.name}
                    </Link>
                  </td>
                  <td className="text-base-content/70">
                    {seg.description || "—"}
                  </td>
                  <td>
                    {seg.contactCount != null ? (
                      <span>{seg.contactCount}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPreviewingSegment(seg)}
                        aria-label={`Preview ${seg.name}`}
                      >
                        Preview
                      </button>
                      {canManageSegments ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditingSegment(seg);
                            setModalOpen(true);
                          }}
                          aria-label={`Edit ${seg.name}`}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canManageSegments ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-error"
                          onClick={() => handleDelete(seg)}
                          aria-label={`Delete ${seg.name}`}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManageSegments && (modalOpen || editingSegment) && (
        <SegmentFormModal
          segment={editingSegment}
          onClose={() => {
            setModalOpen(false);
            setEditingSegment(null);
          }}
          onSubmit={(data) => {
            if (editingSegment) {
              updateMutation.mutate({
                id: editingSegment.id,
                data: {
                  name: data.name,
                  description: data.description,
                  query: data.query,
                },
              });
            } else {
              createMutation.mutate(data);
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {previewingSegment ? (
        <SegmentPreviewModal
          segment={previewingSegment}
          onClose={() => setPreviewingSegment(null)}
        />
      ) : null}
    </div>
  );
}
