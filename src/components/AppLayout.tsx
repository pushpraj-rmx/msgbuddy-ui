"use client";

import { useState } from "react";
import { AppDock } from "./AppDock";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { MeResponse } from "@/lib/api";

const DRAWER_ID = "app-drawer";

export function AppLayout({
  children,
  me,
}: {
  children: React.ReactNode;
  me: MeResponse;
}) {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  return (
    <div
      className={`drawer min-h-[100dvh] bg-base-100 ${
        isDesktopSidebarOpen ? "lg:drawer-open" : ""
      }`}
    >
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-1 flex-col">
        <Topbar
          drawerId={DRAWER_ID}
          me={me}
          isDesktopSidebarOpen={isDesktopSidebarOpen}
          onDesktopSidebarToggle={() =>
            setIsDesktopSidebarOpen((prev) => !prev)
          }
        />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto pb-16 lg:pb-0">
          {children}
        </main>
        <AppDock />
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
  );
}
