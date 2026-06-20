"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Eye, Users } from "lucide-react";
import { segmentsApi } from "@/lib/api";
import type { Segment, SegmentQuery } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/states";
import { SegmentFormModal } from "./SegmentFormModal";
import { SegmentPreviewModal } from "./SegmentPreviewModal";

const SEGMENTS_QUERY_KEY = ["segments"] as const;

export function SegmentsPanelContent({
  canManage,
  onSelectSegment,
}: {
  canManage: boolean;
  /** Called when user clicks a segment name to filter contacts. */
  onSelectSegment?: (segmentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [previewingSegment, setPreviewingSegment] = useState<Segment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Segment | null>(null);

  const { data: segments = [], isFetching } = useQuery({
    queryKey: SEGMENTS_QUERY_KEY,
    queryFn: () => segmentsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; query: SegmentQuery }) =>
      segmentsApi.create(data),
    onSuccess: async (created) => {
      try { await segmentsApi.preview(created.id); } catch { /* best effort */ }
      queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
      setModalOpen(false);
      setEditingSegment(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; query?: SegmentQuery } }) =>
      segmentsApi.update(id, data),
    onSuccess: async (updated) => {
      try { await segmentsApi.preview(updated.id); } catch { /* best effort */ }
      queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
      // The query changed — drop the cached preview so reopening it doesn't
      // show stale counts/contacts.
      queryClient.invalidateQueries({ queryKey: ["segmentPreview", updated.id] });
      setModalOpen(false);
      setEditingSegment(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => segmentsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: SEGMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["segmentPreview", id] });
    },
  });

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <span className="op-label">Segments · {segments.length}</span>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary btn-xs gap-1"
            onClick={() => { setEditingSegment(null); setModalOpen(true); }}
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>

      {/* Segment list */}
      {isFetching && segments.length === 0 ? (
        <div className="flex justify-center py-6">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      ) : segments.length === 0 && !modalOpen ? (
        <div className="px-4 py-4">
          <EmptyState
            title="No segments yet"
            description="Create segments to filter contacts by tags, fields, or activity."
          />
        </div>
      ) : (
        <ul className="flex flex-col">
          {segments.map((seg) => (
            <li
              key={seg.id}
              className="flex items-center gap-2.5 border-b border-base-300 px-4 py-2.5 last:border-b-0"
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-base-content/40" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="block truncate text-[0.8125rem] font-medium text-base-content hover:text-primary transition-colors text-left"
                  onClick={() => onSelectSegment?.(seg.id)}
                  title={`Filter contacts by "${seg.name}"`}
                >
                  {seg.name}
                </button>
                {seg.description && (
                  <p className="truncate text-[0.6875rem] text-base-content/50">{seg.description}</p>
                )}
              </div>
              {seg.contactCount != null && (
                <span className="font-mono-op text-[0.625rem] tabular-nums text-base-content/40">
                  {seg.contactCount}
                </span>
              )}
              <div className="flex items-center gap-0.5">
                <div className="tooltip tooltip-left" data-tip="Preview">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    onClick={() => setPreviewingSegment(seg)}
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                </div>
                {canManage && (
                  <>
                    <div className="tooltip tooltip-left" data-tip="Edit">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={() => { setEditingSegment(seg); setModalOpen(true); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="tooltip tooltip-left" data-tip="Delete">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
                        onClick={() => setConfirmDelete(seg)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Form modal (create/edit) */}
      {canManage && (modalOpen || editingSegment) && (
        <SegmentFormModal
          segment={editingSegment}
          onClose={() => { setModalOpen(false); setEditingSegment(null); }}
          onSubmit={(data) => {
            if (editingSegment) {
              updateMutation.mutate({ id: editingSegment.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Preview modal */}
      {previewingSegment && (
        <SegmentPreviewModal
          segment={previewingSegment}
          onClose={() => setPreviewingSegment(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.name ?? ""}"?`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
