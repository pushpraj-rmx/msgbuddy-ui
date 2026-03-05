"use client";

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
  return (
    <div className="drawer min-h-screen bg-base-100 lg:drawer-open">
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-1 flex-col">
        <Topbar drawerId={DRAWER_ID} me={me} />
        <main className="flex-1 overflow-auto p-3 sm:p-4">{children}</main>
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
