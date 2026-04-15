"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X, Menu, Bell, Search, PanelRight, FileText } from "lucide-react";
import type { MeResponse } from "@/lib/api";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { logoutAction } from "@/app/actions/auth";
import { clearToken } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { useNotificationSSE, useNotifications } from "@/hooks/use-notifications";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { getPageTitle } from "@/lib/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BrandLogo } from "@/components/BrandLogo";
import { SHORTCUT_EVENTS } from "@/lib/shortcuts";

function closeAppDrawer(drawerId: string) {
  const el = document.getElementById(drawerId) as HTMLInputElement | null;
  if (el?.checked) el.click();
}

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

export function Topbar({
  drawerId,
  me,
  workspaceId,
  isDesktopSidebarOpen,
  onDesktopSidebarToggle,
}: {
  drawerId: string;
  me: MeResponse;
  workspaceId: string;
  isDesktopSidebarOpen: boolean;
  onDesktopSidebarToggle: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);
  const { listQuery, unreadCountQuery, markRead, markAllRead } = useNotifications({
    page: 1,
    limit: 8,
  });
  useNotificationSSE(workspaceId);
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
      {/* Sidebar-aligned section — same width as sidebar */}
      <div className="flex shrink-0 items-center gap-2 px-4 lg:w-64">
        <label
          htmlFor={drawerId}
          className="btn btn-ghost btn-square drawer-button lg:hidden"
          aria-label="open menu"
        >
          <Menu className="h-6 w-6" />
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-square hidden lg:inline-flex"
          aria-label={
            isDesktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"
          }
          onClick={onDesktopSidebarToggle}
        >
          {isDesktopSidebarOpen ? (
            <PanelRight className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
        <Link
          href="/dashboard"
          className="inline-flex shrink-0 items-center rounded-none border-0 bg-transparent p-0 shadow-none"
          onClick={() => closeAppDrawer(drawerId)}
          aria-label="MsgBuddy home"
        >
          <BrandLogo className="h-7 w-auto" priority />
        </Link>
      </div>

      {/* Absolutely centered search — true center of the full header */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto hidden w-full max-w-xl px-4 md:block">
          <GlobalSearch variant="desktop" />
        </div>
      </div>

      {/* Page title in flow (xl only) + spacer to push right section to end */}
      <div className="flex min-w-0 flex-1 items-center px-4">
        <h1 className="hidden shrink-0 text-xl font-bold text-base-content/60 xl:block">
          {pageTitle}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 px-4">
        <button
          type="button"
          className="btn btn-ghost btn-square md:hidden"
          aria-label="Open global search"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </button>
        <ThemeToggle />
        {rightPanel?.content ? (
          <button
            type="button"
            className="btn btn-ghost btn-square hidden lg:inline-flex"
            aria-label={isRightPanelOpen ? "Close details" : "Open details"}
            title={
              isRightPanelOpen
                ? "Close details pane"
                : "Open details pane"
            }
            onClick={() =>
              isRightPanelOpen ? closeRightPanel() : openRightPanel()
            }
          >
            <FileText className="h-5 w-5" />
          </button>
        ) : null}
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-square relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="badge badge-primary badge-sm absolute -right-1 -top-1 min-w-5">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          <div
            tabIndex={0}
            className="dropdown-content z-20 mt-2 w-80 rounded-box border border-base-300 bg-base-100 shadow-xl"
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
              <span className="text-xs font-bold text-primary">
                {me.user.email.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </button>
          <div
            tabIndex={0}
            className="dropdown-content z-20 mt-2 w-60 rounded-box border border-base-300 bg-base-100 shadow-xl"
          >
            <div className="border-b border-base-300 px-4 py-3">
              <p className="text-xs font-medium text-base-content/50">Signed in as</p>
              <p className="mt-0.5 truncate text-sm font-medium text-base-content">
                {me.user.email}
              </p>
              <p className="text-xs text-base-content/50">{me.workspace.name}</p>
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
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
          <div className="mx-auto mt-[max(env(safe-area-inset-top,0px),0.75rem)] w-[min(96vw,36rem)] rounded-box border border-base-300 bg-base-100 p-3 shadow-xl">
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
