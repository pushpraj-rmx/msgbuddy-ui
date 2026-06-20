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
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="op-tag flex items-center gap-1 pr-1"
              style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            >
              {tag.name}
              <button
                type="button"
                className="font-mono-op text-[0.75rem] leading-none text-current/70 transition-opacity hover:opacity-100 opacity-60"
                onClick={() => onRemove([tag.id])}
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[0.75rem] text-base-content/50">No tags assigned.</p>
      )}
      {unassigned.length > 0 && (
        <div className="space-y-1.5">
          <span className="op-label block">Add tag</span>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="op-tag transition-colors hover:border-primary/60 hover:text-primary"
                onClick={() => onAssign([tag.id])}
              >
                + {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
