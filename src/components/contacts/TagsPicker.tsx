"use client";

import type { Tag } from "@/lib/types";

/** Minimal tag shape for display (ContactTag or Tag) */
type TagLike = { id: string; name: string; color?: string };

export function TagsPicker({
  tags,
  allTags,
  onAssign,
  onRemove,
}: {
  tags: TagLike[];
  allTags: Tag[];
  onAssign: (tagIds: string[]) => void;
  onRemove: (tagIds: string[]) => void;
}) {
  const tagIds = new Set(tags.map((t) => t.id));
  const unassigned = allTags.filter((t) => !tagIds.has(t.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="badge badge-lg gap-1"
            style={tag.color ? { borderColor: tag.color } : undefined}
          >
            {tag.name}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onRemove([tag.id])}
              aria-label={`Remove ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {unassigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="label-text">Add tag:</span>
          {unassigned.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => onAssign([tag.id])}
            >
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
