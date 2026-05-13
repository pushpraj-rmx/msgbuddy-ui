"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { contactsApi } from "@/lib/api";
import type { TimelineItem } from "@/lib/types";
import { LoadingState } from "@/components/ui/states";

export function ActivityTimeline({ contactId }: { contactId: string }) {
  const { data, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["contacts", contactId, "timeline"],
      queryFn: async ({ pageParam }: { pageParam?: string }) =>
        contactsApi.getTimeline(contactId, {
          limit: 20,
          cursor: pageParam,
        }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    });

  const items: TimelineItem[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={`${item.type}-${item.id}`}
            className="flex gap-3 border-l-2 border-base-300 bg-base-200 rounded-box pl-3 py-2.5 pr-3 relative"
          >
            <span className="absolute -left-[3px] top-4 h-1 w-1 bg-primary rounded-full" aria-hidden />
            <span className="op-tag shrink-0">{item.type}</span>
            <div className="min-w-0 flex-1 text-[13px]">
              {item.type === "note" && item.data.content && (
                <p>{item.data.content}</p>
              )}
              {item.type === "message" && (
                <p>
                  <span className="font-mono-op text-[10px] tracking-[0.08em] uppercase text-base-content/50">
                    {item.data.direction}
                  </span>
                  {": "}{item.data.text ?? "—"}
                </p>
              )}
              <p className="font-mono-op mt-1 text-[10px] tracking-[0.04em] tabular-nums text-base-content/45">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {isFetching && !data && <LoadingState label="Loading activity…" />}
      {hasNextPage && (
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Load more"
          )}
        </button>
      )}
    </div>
  );
}
