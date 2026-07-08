"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { contactMemoryApi } from "@/lib/api";

/**
 * Per-contact AI memory: durable facts the chatbot saved (via the save_memory
 * tool) and uses to personalise replies across conversations. Read-only list
 * here — facts are created by the bot; staff can delete individually or clear
 * all (this is the "clear the AI's memory" control).
 */
export function MemorySection({ contactId }: { contactId: string }) {
  const {
    data: memories = [],
    refetch,
    isError,
  } = useQuery({
    queryKey: ["contacts", contactId, "memory"],
    queryFn: () => contactMemoryApi.list(contactId),
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) =>
      contactMemoryApi.remove(contactId, memoryId),
    onSuccess: () => refetch(),
  });

  const clearMutation = useMutation({
    mutationFn: () => contactMemoryApi.clear(contactId),
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.75rem] text-base-content/55">
          Durable facts the AI assistant saved about this contact. They&apos;re
          used to personalise replies across conversations. Delete anything the
          bot shouldn&apos;t remember.
        </p>
        {memories.length > 0 && (
          <button
            type="button"
            className="shrink-0 font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-error/70 transition-colors hover:text-error disabled:opacity-50"
            onClick={() => {
              if (window.confirm("Clear all AI memory for this contact?")) {
                clearMutation.mutate();
              }
            }}
            disabled={clearMutation.isPending}
          >
            Clear all
          </button>
        )}
      </div>
      {deleteMutation.isError || clearMutation.isError ? (
        <p className="text-[0.75rem] text-error">
          Couldn&apos;t update memory. Try again.
        </p>
      ) : null}
      {isError ? (
        <p className="text-[0.8125rem] text-error">
          Couldn&apos;t load memory.{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </p>
      ) : memories.length === 0 ? (
        <p className="text-[0.8125rem] text-base-content/55">
          Nothing remembered yet. The assistant saves facts as it learns them.
        </p>
      ) : (
        <ul className="space-y-2">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="rounded-box border border-base-300 bg-base-200 px-3 py-2.5"
            >
              <p className="text-[0.8125rem] text-base-content">{memory.fact}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="font-mono-op text-[0.625rem] tracking-[0.04em] tabular-nums text-base-content/50">
                  {new Date(memory.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-error/70 transition-colors hover:text-error disabled:opacity-50"
                  onClick={() => deleteMutation.mutate(memory.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
