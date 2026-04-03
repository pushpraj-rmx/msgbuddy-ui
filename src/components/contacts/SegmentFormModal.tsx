"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { tagsApi } from "@/lib/api";
import type { Segment, SegmentQuery } from "@/lib/types";

const TAGS_QUERY_KEY = ["tags"] as const;

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
  const [description, setDescription] = useState(
    segment?.description ?? ""
  );
  const [tags, setTags] = useState<string[]>(segment?.query?.tags ?? []);
  const [hasEmail, setHasEmail] = useState(segment?.query?.hasEmail ?? false);
  const [hasPhone, setHasPhone] = useState(segment?.query?.hasPhone ?? false);
  const [isBlocked, setIsBlocked] = useState(
    segment?.query?.isBlocked ?? false
  );
  const [isOptedOut, setIsOptedOut] = useState(
    segment?.query?.isOptedOut ?? false
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

  const toggleTag = (tagId: string) => {
    setTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { name: "", op: "eq", value: "" },
    ]);
  };

  const updateCustomField = (
    idx: number,
    next: Partial<NonNullable<SegmentQuery["customFields"]>[number]>
  ) => {
    setCustomFields((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...next } : row))
    );
  };

  const removeCustomField = (idx: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const query: SegmentQuery = {
      tags: tags.length ? tags : undefined,
      hasEmail: hasEmail || undefined,
      hasPhone: hasPhone || undefined,
      isBlocked: isBlocked || undefined,
      isOptedOut: isOptedOut || undefined,
      customFields: customFields
        .map((row) => ({
          name: row.name.trim(),
          op: row.op,
          value: row.value,
        }))
        .filter((row) => row.name && row.value),
      lastMessageAfter: lastMessageAfter || undefined,
      lastMessageBefore: lastMessageBefore || undefined,
    };
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      query,
    });
  };

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-md">
        <h3 className="text-lg font-semibold">
          {segment ? "Edit segment" : "New segment"}
        </h3>
        <div className="mt-4 space-y-3">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
          />
          <label className="label">
            <span className="label-text">Description (optional)</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
          <label className="label">
            <span className="label-text">Tags (contact has all)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`btn btn-sm ${tags.includes(tag.id) ? "btn-primary" : "btn-ghost"}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={hasEmail}
                onChange={(e) => setHasEmail(e.target.checked)}
              />
              <span className="text-sm">Has email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={hasPhone}
                onChange={(e) => setHasPhone(e.target.checked)}
              />
              <span className="text-sm">Has phone</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
              />
              <span className="text-sm">Blocked</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={isOptedOut}
                onChange={(e) => setIsOptedOut(e.target.checked)}
              />
              <span className="text-sm">Opted out</span>
            </label>
          </div>

          <div className="mt-2 rounded-box border border-base-300 bg-base-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Custom field filters</div>
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={addCustomField}
              >
                + Add
              </button>
            </div>
            {customFields.length === 0 ? (
              <p className="mt-2 text-xs text-base-content/60">
                Optional. Add rules like “city contains London”.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {customFields.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      className="input input-bordered input-sm col-span-4"
                      placeholder="field name"
                      value={row.name}
                      onChange={(e) =>
                        updateCustomField(idx, { name: e.target.value })
                      }
                    />
                    <select
                      className="select select-bordered select-sm col-span-3"
                      value={row.op}
                      onChange={(e) =>
                        updateCustomField(idx, {
                          op: e.target.value as "eq" | "ne" | "contains",
                        })
                      }
                    >
                      <option value="eq">equals</option>
                      <option value="ne">not equals</option>
                      <option value="contains">contains</option>
                    </select>
                    <input
                      className="input input-bordered input-sm col-span-4"
                      placeholder="value"
                      value={row.value}
                      onChange={(e) =>
                        updateCustomField(idx, { value: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm col-span-1"
                      onClick={() => removeCustomField(idx)}
                      aria-label="Remove custom field rule"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="label">
            <span className="label-text">Last message after (ISO date)</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={lastMessageAfter ? lastMessageAfter.slice(0, 10) : ""}
            onChange={(e) =>
              setLastMessageAfter(
                e.target.value ? `${e.target.value}T00:00:00.000Z` : ""
              )
            }
          />
          <label className="label">
            <span className="label-text">Last message before (ISO date)</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={lastMessageBefore ? lastMessageBefore.slice(0, 10) : ""}
            onChange={(e) =>
              setLastMessageBefore(
                e.target.value ? `${e.target.value}T23:59:59.999Z` : ""
              )
            }
          />
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
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
          >
            {isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : segment ? (
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
