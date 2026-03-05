"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { contactsApi } from "@/lib/api";
import type { TimelineItem } from "@/lib/types";

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
            className="flex gap-3 rounded-box border border-base-300 bg-base-200 p-3"
          >
            <span className="badge badge-ghost badge-sm shrink-0">
              {item.type}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              {item.type === "note" && item.data.content && (
                <p>{item.data.content}</p>
              )}
              {item.type === "message" && (
                <p>
                  {item.data.direction}: {item.data.text ?? "—"}
                </p>
              )}
              <p className="mt-1 text-xs text-base-content/60">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {isFetching && !data && (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-md" />
        </div>
      )}
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
