"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X, PanelLeft, Bell, Search, FileText } from "lucide-react";
import type { MeResponse } from "@/lib/api";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { logoutAction } from "@/app/actions/auth";
import { clearToken } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { useNotificationSSE, useNotifications } from "@/hooks/use-notifications";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { getPageTitle } from "@/lib/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";

import { SHORTCUT_EVENTS } from "@/lib/shortcuts";
import { formatRelativeTime } from "@/lib/format";

export function Topbar({
  drawerId,
  me,
  workspaceId,
}: {
  drawerId: string;
  me: MeResponse;
  workspaceId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);
  const { listQuery, unreadCountQuery, markRead, markAllRead } = useNotifications({
    page: 1,
    limit: 8,
  });
  const { connectionState: sseState } = useNotificationSSE(workspaceId);
  const { permission, requestAndSubscribe } = usePushSubscription(workspaceId);
  const {
    isOpen: isRightPanelOpen,
    open: openRightPanel,
    close: closeRightPanel,
    panel: rightPanel,
  } = useRightPanel();

  const handleLogout = async () => {
    clearToken();
    await logoutAction();
    router.replace("/login");
  };

  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const notifications = listQuery.data?.items ?? [];

  useEffect(() => {
    const onOpenSearchShortcut = () => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(min-width: 768px)").matches) return;
      setMobileSearchOpen(true);
    };
    window.addEventListener(SHORTCUT_EVENTS.OPEN_GLOBAL_SEARCH, onOpenSearchShortcut);
    return () =>
      window.removeEventListener(SHORTCUT_EVENTS.OPEN_GLOBAL_SEARCH, onOpenSearchShortcut);
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    window.requestAnimationFrame(() => {
      document.getElementById("global-search-input-mobile")?.focus();
    });
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setMobileSearchOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mobileSearchOpen]);

  return (
    <header className="sticky top-0 z-10 relative flex min-h-15 shrink-0 items-center border-b border-base-300 pt-[env(safe-area-inset-top,0px)]">
      {/* Mobile hamburger */}
      <div className="flex shrink-0 items-center px-4 lg:hidden">
        <label
          htmlFor={drawerId}
          className="btn btn-ghost btn-square drawer-button"
          aria-label="open menu"
        >
          <PanelLeft className="h-6 w-6" />
        </label>
      </div>

      {/* Absolutely centered search — true center of the full header */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto hidden w-full max-w-xl px-4 md:block">
          <GlobalSearch variant="desktop" />
        </div>
      </div>

      {/* Breadcrumb + live signal (xl only) */}
      <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
        <div className="hidden shrink-0 items-center gap-2 text-[0.75rem] text-base-content/60 xl:flex">
          <span className="max-w-[140px] truncate">{me.workspace.name}</span>
          <span className="text-base-content/30">/</span>
          <span className="font-medium text-base-content">{pageTitle}</span>
        </div>
        <span
          className={`op-signal hidden xl:inline-flex ${
            sseState === "live"
              ? ""
              : sseState === "reconnecting"
                ? "[&_.dot]:bg-warning [&_.dot]:shadow-none [&_.dot]:animate-none"
                : sseState === "connecting"
                  ? "[&_.dot]:bg-base-content/30 [&_.dot]:shadow-none"
                  : "[&_.dot]:bg-error [&_.dot]:shadow-none [&_.dot]:animate-none"
          }`}
          title={
            sseState === "live"
              ? "Real-time: updates streaming"
              : sseState === "reconnecting"
                ? "Connection lost — reconnecting…"
                : sseState === "connecting"
                  ? "Connecting to server…"
                  : "Offline — updates paused"
          }
        >
          <span className="dot" />
          {sseState === "live" ? "live" : sseState === "reconnecting" ? "reconnecting" : sseState === "connecting" ? "connecting" : "offline"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 px-4">
        <button
          type="button"
          className="btn btn-ghost btn-square md:hidden"
          aria-label="Open global search"
          title="Search (⌘K)"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </button>
        <ThemeToggle />
        {rightPanel?.content ? (
          <div className="tooltip tooltip-bottom" data-tip="Toggle details (.)" >
            <button
              type="button"
              className="btn btn-ghost btn-square"
              aria-label={isRightPanelOpen ? "Close details" : "Open details"}
              onClick={() =>
                isRightPanelOpen ? closeRightPanel() : openRightPanel()
              }
            >
              <FileText className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        <div className="dropdown dropdown-end">
          <div className="tooltip tooltip-bottom" data-tip={unreadCount > 0 ? `${unreadCount} unread` : "Notifications"}>
          <button
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-square relative"
            aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="font-mono-op absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-[3px] bg-primary px-1 text-[0.625rem] font-semibold leading-[16px] text-primary-content tabular-nums">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          </div>
          <div
            tabIndex={0}
            className="dropdown-content z-20 mt-2 w-80 rounded-box border border-base-300 bg-base-100 shadow-lg"
          >
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending || unreadCount === 0}
                >
                  Mark all as read
                </button>
              </div>
              {permission === "default" && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-box border border-base-300 bg-base-200 px-3 py-2 text-left text-xs transition-colors hover:bg-base-300"
                  onClick={requestAndSubscribe}
                >
                  <Bell className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium">Enable push notifications</span>
                    <span className="block text-base-content/60">
                      Get alerted even when the tab is closed
                    </span>
                  </span>
                </button>
              )}
              {permission === "denied" && (
                <div className="rounded-box border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-content">
                  Push notifications are blocked. Allow them in your browser
                  settings to receive alerts.
                </div>
              )}
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {listQuery.isLoading ? (
                  <div className="text-xs text-base-content/60">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="text-xs text-base-content/60">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((item) => {
                    const href =
                      item.data &&
                        typeof item.data.href === "string" &&
                        item.data.href.startsWith("/")
                        ? item.data.href
                        : "/notifications";
                    const isUnread = !item.readAt;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-box border px-3 py-2 ${isUnread
                          ? "border-primary/20 bg-primary/5"
                          : "border-base-300"
                          }`}
                      >
                        <Link href={href} className="block">
                          <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-base-content/60 line-clamp-2">
                            {item.body}
                          </p>
                        </Link>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-xs text-base-content/40">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                          {isUnread ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-xs"
                              onClick={() => markRead.mutate(item.id)}
                              disabled={markRead.isPending}
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <Link href="/notifications" className="btn btn-outline btn-sm w-full">
                View all
              </Link>
            </div>
          </div>
        </div>
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-square avatar placeholder"
            aria-label="User menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-base-300 bg-base-200">
              <span className="font-mono-op text-[0.6875rem] font-semibold text-base-content">
                {me.user.email.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </button>
          <div
            tabIndex={0}
            className="dropdown-content z-20 mt-2 w-60 rounded-box border border-base-300 bg-base-100 shadow-lg"
          >
            <div className="border-b border-base-300 px-4 py-3">
              <p className="op-label">Signed in as</p>
              <p className="mt-1 truncate text-sm font-medium text-base-content">
                {me.user.email}
              </p>
              <p className="font-mono-op mt-0.5 text-[0.6875rem] text-base-content/50">{me.workspace.name}</p>
            </div>
            <ul className="menu menu-sm p-2">
              <li>
                <button type="button" onClick={handleLogout} className="text-error hover:bg-error/10">
                  Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="fixed inset-0 z-50 bg-base-content/40 md:hidden">
          <div className="mx-auto mt-[max(env(safe-area-inset-top,0px),0.75rem)] w-[min(96vw,36rem)] rounded-box border border-base-300 bg-base-100 p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Search</h2>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                aria-label="Close search"
                onClick={() => setMobileSearchOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <GlobalSearch variant="mobile" />
          </div>
          <button
            type="button"
            aria-label="Close search overlay"
            className="absolute inset-0 -z-10"
            onClick={() => setMobileSearchOpen(false)}
          />
        </div>
      ) : null}
    </header>
  );
}
