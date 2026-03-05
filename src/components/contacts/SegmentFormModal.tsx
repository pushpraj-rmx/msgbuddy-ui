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
  const [isBlocked, setIsBlocked] = useState(
    segment?.query?.isBlocked ?? false
  );
  const [isOptedOut, setIsOptedOut] = useState(
    segment?.query?.isOptedOut ?? false
  );
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

  const toggleTag = (tagName: string) => {
    setTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleSubmit = () => {
    const query: SegmentQuery = {
      tags: tags.length ? tags : undefined,
      hasEmail: hasEmail || undefined,
      isBlocked: isBlocked || undefined,
      isOptedOut: isOptedOut || undefined,
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
                className={`btn btn-sm ${tags.includes(tag.name) ? "btn-primary" : "btn-ghost"}`}
                onClick={() => toggleTag(tag.name)}
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
