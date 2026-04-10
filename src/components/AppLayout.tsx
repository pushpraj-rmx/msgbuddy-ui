"use client";

import { useEffect, useState } from "react";
import { AppDock } from "./AppDock";
import { SessionRefresh } from "./SessionRefresh";
import { AppShortcuts } from "./shortcuts/AppShortcuts";
import { GlobalRightPanel } from "./right-panel/GlobalRightPanel";
import { RightPanelProvider } from "./right-panel/RightPanelProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { MeResponse } from "@/lib/api";
import { conversationsApi } from "@/lib/api";

const DRAWER_ID = "app-drawer";
const DESKTOP_SIDEBAR_KEY = "desktop-sidebar-open";

export function AppLayout({
  children,
  me,
}: {
  children: React.ReactNode;
  me: MeResponse;
}) {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(DESKTOP_SIDEBAR_KEY);
      if (raw === "true" || raw === "false") {
        return raw === "true";
      }
    } catch {
      // ignore
    }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_SIDEBAR_KEY, String(isDesktopSidebarOpen));
    } catch {
      // ignore
    }
  }, [isDesktopSidebarOpen]);

  // Handle inline reply actions from push notification service worker
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = async (event: MessageEvent) => {
      if (event.data?.type !== "NOTIFICATION_REPLY") return;
      const { conversationId, text } = event.data as { conversationId: string; text: string };
      if (!conversationId || !text?.trim()) return;
      try {
        const conversation = await conversationsApi.getById(conversationId) as {
          contactId?: string; channel?: string;
        };
        if (!conversation?.contactId) return;
        await conversationsApi.sendMessage({
          contactId: conversation.contactId,
          text: text.trim(),
          channel: (conversation.channel as "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS") ?? "WHATSAPP",
        });
      } catch {
        // best-effort; user will see the reply wasn't sent if they open the app
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  return (
    <RightPanelProvider>
      <SessionRefresh />
      <AppShortcuts />
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <Topbar
          drawerId={DRAWER_ID}
          me={me}
          workspaceId={me.workspace.id}
          isDesktopSidebarOpen={isDesktopSidebarOpen}
          onDesktopSidebarToggle={() =>
            setIsDesktopSidebarOpen((prev) => {
              if (prev) {
                // Closing: reset mobile drawer-toggle. If it stays :checked, DaisyUI
                // still shows drawer-side (overlay/fixed) after lg:drawer-open is removed,
                // which flashes the wrong layout vs sticky desktop nav.
                const input = document.getElementById(
                  DRAWER_ID
                ) as HTMLInputElement | null;
                if (input?.checked) input.checked = false;
              }
              return !prev;
            })
          }
        />
        <div
          className={`app-shell-drawer drawer h-full min-h-0 flex-1 overflow-hidden bg-base-100 ${isDesktopSidebarOpen ? "lg:drawer-open" : ""
            }`}
        >
          <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
              <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                {/* Main + details pane: split row so content shrinks when details is open (no overlay). */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4">
                  {children}
                </div>
                <GlobalRightPanel />
              </div>
            </main>
            <AppDock platformRole={me.platformRole ?? "NONE"} />
          </div>
          <div className="drawer-side z-30">
            <label
              htmlFor={DRAWER_ID}
              aria-label="close sidebar"
              className="drawer-overlay"
            />
            <Sidebar drawerId={DRAWER_ID} me={me} />
          </div>
        </div>
      </div>
    </RightPanelProvider>
  );
}
