"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNotifications } from "@/hooks/use-notifications";
import { LoadingState, EmptyState } from "@/components/ui/states";

function formatRelativeTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return formatter.format(diffSec, "second");
  if (abs < 3600) return formatter.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(diffSec / 3600), "hour");
  return formatter.format(Math.round(diffSec / 86400), "day");
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const limit = 20;
  const { listQuery, markRead, markAllRead } = useNotifications({
    page,
    limit,
    unreadOnly,
  });

  const total = listQuery.data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);
  const items = listQuery.data?.items ?? [];

  return (
    <PageContainer className="mx-auto w-full max-w-4xl">
      <PageHeader title="Notifications" description="Workspace notifications" />

      <section className="rounded-box border border-base-300 bg-base-200">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="join">
              <button
                type="button"
                className={`btn btn-sm join-item ${!unreadOnly ? "btn-primary" : ""}`}
                aria-pressed={!unreadOnly}
                onClick={() => {
                  setUnreadOnly(false);
                  setPage(1);
                }}
              >
                All
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item ${unreadOnly ? "btn-primary" : ""}`}
                aria-pressed={unreadOnly}
                onClick={() => {
                  setUnreadOnly(true);
                  setPage(1);
                }}
              >
                Unread
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all as read
            </button>
          </div>

          {listQuery.isLoading ? (
            <LoadingState label="Loading notifications…" />
          ) : items.length === 0 ? (
            <EmptyState
              title="No notifications found"
              description={unreadOnly ? "All notifications have been read." : "Workspace notifications will appear here."}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const isUnread = !item.readAt;
                const href =
                  item.data &&
                  typeof item.data.href === "string" &&
                  item.data.href.startsWith("/")
                    ? item.data.href
                    : null;
                return (
                  <li
                    key={item.id}
                    className={`rounded-box border bg-base-100 ${
                      isUnread ? "border-base-300 border-l-2 border-l-primary" : "border-base-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        {href ? (
                          <Link href={href} className="block hover:opacity-90">
                            <h2 className={`text-[13px] ${isUnread ? "font-semibold" : "font-medium"}`}>{item.title}</h2>
                            <p className="mt-1 text-[13px] text-base-content/75">{item.body}</p>
                          </Link>
                        ) : (
                          <>
                            <h2 className={`text-[13px] ${isUnread ? "font-semibold" : "font-medium"}`}>{item.title}</h2>
                            <p className="mt-1 text-[13px] text-base-content/75">{item.body}</p>
                          </>
                        )}
                        <p className="font-mono-op mt-1.5 text-[10px] tracking-[0.04em] tabular-nums text-base-content/50">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                      {isUnread ? (
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => markRead.mutate(item.id)}
                          disabled={markRead.isPending}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-between">
            <span className="font-mono-op text-[10px] tracking-[0.04em] tabular-nums text-base-content/50">
              Page {page} of {totalPages}
            </span>
            <div className="join">
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
