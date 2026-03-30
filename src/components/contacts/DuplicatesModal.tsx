"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { contactsApi } from "@/lib/api";
import type { Contact, DuplicateGroup } from "@/lib/types";

export function DuplicatesModal({
  onClose,
  onMerged,
}: {
  onClose: () => void;
  onMerged: () => void;
}) {
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["contacts", "duplicates"],
    queryFn: () => contactsApi.findDuplicates(),
    enabled: true,
  });

  const mergeMutation = useMutation({
    mutationFn: (payload: { primaryId: string; duplicateId: string }) =>
      contactsApi.merge(payload),
    onSuccess: () => {
      onMerged();
      setMergeGroup(null);
      setPrimaryId(null);
      refetch();
    },
  });

  const mergeAllMutation = useMutation({
    mutationFn: async (payload: { primaryId: string; duplicateIds: string[] }) => {
      for (const duplicateId of payload.duplicateIds) {
        await contactsApi.merge({ primaryId: payload.primaryId, duplicateId });
      }
    },
    onSuccess: () => {
      onMerged();
      setMergeGroup(null);
      setPrimaryId(null);
      refetch();
    },
  });

  const groups = data?.duplicateGroups ?? [];

  const handleMerge = (group: DuplicateGroup) => {
    setMergeGroup(group);
    setPrimaryId(group.contacts[0]?.id ?? null);
  };

  const handleConfirmMerge = () => {
    if (!mergeGroup || !primaryId) return;
    const duplicate = mergeGroup.contacts.find((c) => c.id !== primaryId);
    if (!duplicate) return;
    mergeMutation.mutate({ primaryId, duplicateId: duplicate.id });
  };

  const handleConfirmMergeAll = () => {
    if (!mergeGroup || !primaryId) return;
    const duplicateIds = mergeGroup.contacts
      .map((c) => c.id)
      .filter((id) => id !== primaryId);
    if (duplicateIds.length === 0) return;
    mergeAllMutation.mutate({ primaryId, duplicateIds });
  };

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-2xl max-h-[80vh] flex flex-col">
        <h3 className="text-lg font-semibold">Find duplicates</h3>
        <p className="mt-1 text-sm text-base-content/70">
          Groups of contacts that share the same phone or email.
        </p>

        {mergeGroup ? (
          <div className="mt-4 space-y-3 flex-1 overflow-auto">
            <p className="text-sm font-medium">Choose primary contact (the one to keep):</p>
            <div className="space-y-2">
              {mergeGroup.contacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-box border border-base-300 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="primary"
                    className="radio radio-primary"
                    checked={primaryId === c.id}
                    onChange={() => setPrimaryId(c.id)}
                  />
                  <span className="font-medium">{c.name || "Unnamed"}</span>
                  <span className="text-sm text-base-content/60">{c.phone}</span>
                  {c.email && (
                    <span className="text-sm text-base-content/60">{c.email}</span>
                  )}
                </label>
              ))}
            </div>
            <div className="modal-action mt-4">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMergeGroup(null);
                  setPrimaryId(null);
                }}
                disabled={mergeMutation.isPending || mergeAllMutation.isPending}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-outline btn-primary"
                onClick={handleConfirmMergeAll}
                disabled={!primaryId || mergeMutation.isPending || mergeAllMutation.isPending}
              >
                {mergeAllMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Merge All into Primary"
                )}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmMerge}
                disabled={!primaryId || mergeMutation.isPending || mergeAllMutation.isPending}
                title="Merge one duplicate into the selected primary"
              >
                {mergeMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Merge one"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex-1 overflow-auto">
            {isFetching ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-base-content/60 py-4">
                No duplicate groups found.
              </p>
            ) : (
              <ul className="space-y-3">
                {groups.map((group, idx) => (
                  <li
                    key={idx}
                    className="rounded-box border border-base-300 p-3 bg-base-200"
                  >
                    <p className="text-xs text-base-content/60 mb-2">
                      Matched on: <strong>{group.matchedOn}</strong>
                    </p>
                    <ul className="space-y-1">
                      {group.contacts.map((c: Contact) => (
                        <li key={c.id} className="flex flex-wrap gap-2 text-sm">
                          <span className="font-medium">{c.name || "Unnamed"}</span>
                          <span>{c.phone}</span>
                          {c.email && (
                            <span className="text-base-content/70">{c.email}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-primary mt-2"
                      onClick={() => handleMerge(group)}
                    >
                      Merge
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-action mt-4">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
