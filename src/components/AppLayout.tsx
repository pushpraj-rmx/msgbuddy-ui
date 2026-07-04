"use client";

import { useEffect, useState } from "react";
import { AppDock } from "./AppDock";
import { PwaInstallPrompt } from "./PwaInstallPrompt";
import { AppUpdateToast } from "./AppUpdateToast";
import { BackgroundTasksBar } from "./BackgroundTasksBar";
import { BackgroundTaskToast } from "./BackgroundTaskToast";
import { useBackgroundTasks } from "@/hooks/useBackgroundTasks";
import { SessionRefresh } from "./SessionRefresh";
import { DesktopBridge } from "./DesktopBridge";
import { AppShortcuts } from "./shortcuts/AppShortcuts";
import { GlobalRightPanel } from "./right-panel/GlobalRightPanel";
import { RightPanelProvider } from "./right-panel/RightPanelProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TrialBanner } from "./billing/TrialBanner";
import { UsageWarningBanner } from "./billing/UsageWarningBanner";
import type { MeResponse } from "@/lib/api";
import { conversationsApi } from "@/lib/api";

const DRAWER_ID = "app-drawer";
const SIDEBAR_KEY = "sidebar-collapsed";
const DENSITY_KEY = "display-density";

export function AppLayout({
  children,
  me,
}: {
  children: React.ReactNode;
  me: MeResponse;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync with localStorage after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard: localStorage unavailable during SSR
      if (stored === "true") setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  // Sync display density from server-fetched user → html[data-density] + localStorage.
  // The inline boot script in app/layout.tsx reads localStorage on first paint to avoid FOUC.
  useEffect(() => {
    const density = (me.user?.displayDensity ?? "MEDIUM").toLowerCase();
    document.documentElement.setAttribute("data-density", density);
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      // ignore
    }
  }, [me.user?.displayDensity]);

  // Cross-domain background tasks (imports + future campaigns / etc).
  const { tasks: bgTasks, completed: bgCompleted, dismissCompletion } =
    useBackgroundTasks(me.workspace.id);

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

  const mainContent = (
    <>
      <TrialBanner workspace={me.workspace} />
      <UsageWarningBanner />
      <Topbar
        drawerId={DRAWER_ID}
        me={me}
        workspaceId={me.workspace.id}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 lg:p-5">
            {children}
          </div>
          <GlobalRightPanel />
        </div>
      </main>
      <AppDock
        platformRole={me.platformRole ?? "NONE"}
        workspaceRole={String(me.role)}
      />
    </>
  );

  return (
    <RightPanelProvider>
      <SessionRefresh />
      <DesktopBridge />
      <AppShortcuts />
      <PwaInstallPrompt />
      <AppUpdateToast />
      <BackgroundTasksBar tasks={bgTasks} />
      <BackgroundTaskToast notices={bgCompleted} onDismiss={dismissCompletion} />

      {/* Desktop: sidebar + content side by side */}
      <div className="hidden h-[100dvh] overflow-hidden lg:flex">
        <Sidebar
          drawerId={DRAWER_ID}
          me={me}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {mainContent}
        </div>
      </div>

      {/* Mobile: drawer wraps everything, content inside drawer-content */}
      <div className="drawer h-[100dvh] overflow-hidden lg:hidden">
        <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex min-h-0 flex-1 flex-col overflow-hidden">
          {mainContent}
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
    </RightPanelProvider>
  );
}
