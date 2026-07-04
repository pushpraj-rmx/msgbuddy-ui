"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import { notificationQueryKeys } from "@/hooks/use-notifications";

/**
 * Progressive enhancement for the msgbuddy-desktop Electron shell. Renders
 * nothing and is a complete no-op in a normal browser (guarded on
 * `window.msgbuddyDesktop?.isDesktop`). When running inside the desktop app it:
 *  - mirrors the unread notification count onto the OS dock/taskbar badge, and
 *  - routes deep links (msgbuddy://…, e.g. notification click-through) via the
 *    Next router without a full reload.
 */
export function DesktopBridge() {
  const router = useRouter();
  const isDesktop =
    typeof window !== "undefined" && Boolean(window.msgbuddyDesktop?.isDesktop);

  // Shares the exact query key + fn as the Topbar bell, so react-query dedupes
  // to a single poll rather than adding a second one.
  const { data } = useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 15_000,
    enabled: isDesktop,
  });

  useEffect(() => {
    if (!isDesktop) return;
    window.msgbuddyDesktop?.setBadgeCount(data?.count ?? 0);
  }, [isDesktop, data?.count]);

  useEffect(() => {
    if (!isDesktop) return;
    const off = window.msgbuddyDesktop?.onDeepLink((url) => {
      const target = deepLinkToPath(url);
      if (target) router.push(target);
    });
    return () => off?.();
  }, [isDesktop, router]);

  return null;
}

/**
 * Maps a msgbuddy:// deep link to an in-app path.
 *  - msgbuddy://open?path=/inbox            → /inbox
 *  - msgbuddy://open?conversationId=abc     → /inbox?conversationId=abc
 *  - msgbuddy://conversation/abc            → /inbox?conversationId=abc
 */
function deepLinkToPath(raw: string): string | null {
  try {
    const u = new URL(raw);
    const explicitPath = u.searchParams.get("path");
    if (explicitPath && explicitPath.startsWith("/")) return explicitPath;

    const conversationId =
      u.searchParams.get("conversationId") ??
      (u.host === "conversation" ? u.pathname.replace(/^\/+/, "") : null);
    if (conversationId) {
      return `/inbox?conversationId=${encodeURIComponent(conversationId)}`;
    }
    return null;
  } catch {
    return null;
  }
}
