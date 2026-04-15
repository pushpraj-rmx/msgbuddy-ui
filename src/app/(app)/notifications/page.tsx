"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNotifications } from "@/hooks/use-notifications";

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

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="join">
              <button
                type="button"
                className={`btn btn-sm join-item ${!unreadOnly ? "btn-primary" : "btn-outline"}`}
                onClick={() => {
                  setUnreadOnly(false);
                  setPage(1);
                }}
              >
                All
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item ${unreadOnly ? "btn-primary" : "btn-outline"}`}
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
              className="btn btn-sm btn-ghost"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all as read
            </button>
          </div>

          {listQuery.isLoading ? (
            <div className="text-sm text-base-content/70">Loading notifications...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-base-content/70">No notifications found.</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const isUnread = !item.readAt;
                const href =
                  item.data &&
                  typeof item.data.href === "string" &&
                  item.data.href.startsWith("/")
                    ? item.data.href
                    : null;
                return (
                  <article
                    key={item.id}
                    className={`rounded-box border p-3 ${isUnread ? "border-base-300 bg-base-200" : "border-base-300 bg-base-100"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {href ? (
                          <Link href={href} className="block hover:opacity-90">
                            <h2 className="text-sm font-semibold">{item.title}</h2>
                            <p className="mt-1 text-sm text-base-content/75">{item.body}</p>
                          </Link>
                        ) : (
                          <>
                            <h2 className="text-sm font-semibold">{item.title}</h2>
                            <p className="mt-1 text-sm text-base-content/75">{item.body}</p>
                          </>
                        )}
                        <p className="mt-1 text-xs text-base-content/60">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                      {isUnread ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => markRead.mutate(item.id)}
                          disabled={markRead.isPending}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/60">
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
