"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { tagsApi } from "@/lib/api";
import type { Segment, SegmentQuery } from "@/lib/types";
import { InfoTip } from "@/components/ui/InfoTip";

const TAGS_QUERY_KEY = ["tags"] as const;

type TriState = "any" | "yes" | "no";

function triToBool(v: TriState): boolean | undefined {
  return v === "yes" ? true : v === "no" ? false : undefined;
}

function boolToTri(v: boolean | undefined): TriState {
  return v === true ? "yes" : v === false ? "no" : "any";
}

export function SegmentFormModal({
  segment,
  onClose,
  onSubmit,
  isPending,
}: {
  segment: Segment | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    query: SegmentQuery;
  }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  // Seed from tagIds ONLY. Legacy segments that stored tag *names* in
  // query.tags are resolved to IDs in the effect below — never treated as IDs
  // directly (doing so would write names into tagIds and match zero contacts).
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    segment?.query?.tagIds ?? []
  );
  const [unresolvedTags, setUnresolvedTags] = useState<string[]>([]);
  const [tagsMatch, setTagsMatch] = useState<"all" | "any">(
    // New segments default to "any" (the intuitive multi-tag behaviour);
    // existing ones reflect their stored mode (absent = the old "all").
    segment ? (segment.query?.tagsMatch === "any" ? "any" : "all") : "any"
  );
  const [hasEmail, setHasEmail] = useState<TriState>(
    boolToTri(segment?.query?.hasEmail)
  );
  const [blocked, setBlocked] = useState<TriState>(
    boolToTri(segment?.query?.isBlocked)
  );
  const [optedOut, setOptedOut] = useState<TriState>(
    boolToTri(segment?.query?.isOptedOut)
  );
  const [customFields, setCustomFields] = useState<
    NonNullable<SegmentQuery["customFields"]>
  >(segment?.query?.customFields ?? []);
  const [lastMessageAfter, setLastMessageAfter] = useState(
    segment?.query?.lastMessageAfter ?? ""
  );
  const [lastMessageBefore, setLastMessageBefore] = useState(
    segment?.query?.lastMessageBefore ?? ""
  );

  const { data: allTags = [] } = useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: () => tagsApi.list(),
  });

  // One-shot migration of a legacy name-based segment to tag IDs, performed
  // during render (the React-recommended way to derive state from freshly
  // loaded data — no effect) once the tag list arrives. The `legacyResolved`
  // state flag makes it run exactly once. Unresolvable names (renamed/deleted
  // tags) are dropped and surfaced so the user knows the segment will widen.
  const [legacyResolved, setLegacyResolved] = useState(false);
  const legacyTags = segment?.query?.tags;
  if (
    !legacyResolved &&
    legacyTags?.length &&
    !segment?.query?.tagIds?.length &&
    allTags.length > 0
  ) {
    setLegacyResolved(true);
    const byName = new Map(allTags.map((t) => [t.name.trim().toLowerCase(), t.id]));
    const resolved: string[] = [];
    const missing: string[] = [];
    for (const name of legacyTags) {
      const id = byName.get(name.trim().toLowerCase());
      if (id) resolved.push(id);
      else missing.push(name);
    }
    setSelectedTagIds(resolved);
    setUnresolvedTags(missing);
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    const query: SegmentQuery = {
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      // Only meaningful with >1 tag; harmless otherwise.
      tagsMatch: selectedTagIds.length > 1 ? tagsMatch : undefined,
      hasEmail: triToBool(hasEmail),
      isBlocked: triToBool(blocked),
      isOptedOut: triToBool(optedOut),
      customFields: customFields
        .map((row) => ({ name: row.name.trim(), op: row.op, value: row.value }))
        .filter((row) => row.name && row.value),
      lastMessageAfter: lastMessageAfter || undefined,
      lastMessageBefore: lastMessageBefore || undefined,
    };
    onSubmit({ name: name.trim(), description: description.trim() || undefined, query });
  };

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-lg rounded-box border border-base-300">
        {/* Header */}
        <span className="op-label">{segment ? "Edit" : "New"}</span>
        <h3 className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.015em]">
          {segment ? "Edit segment" : "Create segment"}
        </h3>

        <div className="mt-5 flex flex-col gap-5">
          {/* Name + Description */}
          <div className="flex flex-col gap-3">
            <div>
              <span className="op-label mb-1.5 block">Name</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. VIP customers"
                autoFocus
              />
            </div>
            <div>
              <span className="op-label mb-1.5 block">Description</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional — what this segment filters for"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <span className="op-label mb-1.5 flex items-center gap-1.5">
              Tags
              <InfoTip tip="With multiple tags, choose Any (has at least one) or All (has every one). 'All' often matches 0 contacts." />
            </span>
            {allTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-base-300 bg-base-200 text-base-content/60 hover:bg-base-300"
                    }`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.color ? (
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    ) : null}
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[0.75rem] text-base-content/50">No tags created yet.</p>
            )}
            {selectedTagIds.length > 1 ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[0.6875rem] text-base-content/50">Match</span>
                <div className="join">
                  {(["any", "all"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`btn btn-xs join-item ${
                        tagsMatch === mode ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() => setTagsMatch(mode)}
                    >
                      {mode === "any" ? "Any tag" : "All tags"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {unresolvedTags.length > 0 ? (
              <p className="mt-2 text-[0.6875rem] text-warning">
                {unresolvedTags.length} tag
                {unresolvedTags.length > 1 ? "s" : ""} from this segment no longer
                exist and will be removed on save: {unresolvedTags.join(", ")}.
              </p>
            ) : null}
          </div>

          {/* Contact properties */}
          <div>
            <span className="op-label mb-2 block">Contact properties</span>
            <div className="grid grid-cols-2 gap-2">
              <TriSelect label="Has email" value={hasEmail} onChange={setHasEmail} />
              <TriSelect label="Blocked" value={blocked} onChange={setBlocked} />
              <TriSelect label="Opted out" value={optedOut} onChange={setOptedOut} />
            </div>
          </div>

          {/* Last message date range */}
          <div>
            <span className="op-label mb-1.5 flex items-center gap-1.5">
              Last message
              <InfoTip tip="Filter by when the contact last sent or received a message" />
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input input-bordered input-sm flex-1"
                value={lastMessageAfter ? lastMessageAfter.slice(0, 10) : ""}
                onChange={(e) =>
                  setLastMessageAfter(e.target.value ? `${e.target.value}T00:00:00.000Z` : "")
                }
                title="After this date"
              />
              <span className="text-[0.6875rem] text-base-content/40">to</span>
              <input
                type="date"
                className="input input-bordered input-sm flex-1"
                value={lastMessageBefore ? lastMessageBefore.slice(0, 10) : ""}
                onChange={(e) =>
                  setLastMessageBefore(e.target.value ? `${e.target.value}T23:59:59.999Z` : "")
                }
                title="Before this date"
              />
            </div>
          </div>

          {/* Custom field filters */}
          <div className="rounded-box border border-base-300 bg-base-200 p-3">
            <div className="flex items-center justify-between">
              <span className="op-label">Custom field filters</span>
              <button
                type="button"
                className="btn btn-primary btn-xs gap-1"
                onClick={() => setCustomFields((prev) => [...prev, { name: "", op: "eq", value: "" }])}
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {customFields.length === 0 ? (
              <p className="mt-2 text-[0.6875rem] text-base-content/50">
                Optional. Add rules like &quot;city contains London&quot;.
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {customFields.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      className="input input-bordered input-sm flex-[3]"
                      placeholder="field"
                      value={row.name}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                        )
                      }
                    />
                    <select
                      className="select select-bordered select-sm flex-[2]"
                      value={row.op}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, op: e.target.value as "eq" | "ne" | "contains" } : r
                          )
                        )
                      }
                    >
                      <option value="eq">equals</option>
                      <option value="ne">not equals</option>
                      <option value="contains">contains</option>
                    </select>
                    <input
                      className="input input-bordered input-sm flex-[3]"
                      placeholder="value"
                      value={row.value}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))
                        )
                      }
                    />
                    <div className="tooltip tooltip-left" data-tip="Remove rule">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
                        onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
          >
            {isPending ? <span className="loading loading-spinner loading-xs" /> : segment ? "Save" : "Create"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}

/** Tri-state selector: Any / Yes / No */
function TriSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-base-300 bg-base-100 px-2.5 py-1.5">
      <span className="text-[0.75rem] text-base-content/70">{label}</span>
      <select
        className="select select-bordered select-xs w-20 font-mono-op text-[0.625rem]"
        value={value}
        onChange={(e) => onChange(e.target.value as TriState)}
      >
        <option value="any">Any</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}
