"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Bars3Icon,
  Bars3BottomLeftIcon,
} from "@heroicons/react/24/outline";
import type { MeResponse } from "@/lib/api";
import { logoutAction } from "@/app/actions/auth";
import { clearToken } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/contacts/segments")) return "Segments";
  if (pathname.startsWith("/contacts/tags")) return "Tags";
  if (pathname.startsWith("/contacts")) return "People & Organizations";
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/media")) return "Media";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/settings/integrations/whatsapp")) return "WhatsApp";
  if (pathname.startsWith("/settings/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/team")) return "Team";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/platform")) return "Platform";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  return "MsgBuddy";
}

export function Topbar({
  drawerId,
  me,
  isDesktopSidebarOpen,
  onDesktopSidebarToggle,
}: {
  drawerId: string;
  me: MeResponse;
  isDesktopSidebarOpen: boolean;
  onDesktopSidebarToggle: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const handleLogout = async () => {
    clearToken();
    await logoutAction();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-10 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300/80 bg-base-100 px-4 pt-[env(safe-area-inset-top,0px)]">
      <label
        htmlFor={drawerId}
        className="btn btn-ghost btn-square drawer-button lg:hidden"
        aria-label="open menu"
      >
        <Bars3Icon className="h-6 w-6" />
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
          <Bars3BottomLeftIcon className="h-5 w-5" />
        ) : (
          <Bars3Icon className="h-5 w-5" />
        )}
      </button>
      <div className="flex flex-1 items-center gap-2">
        <h1 className="truncate text-sm font-medium text-base-content">
          {pageTitle}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle avatar placeholder transition-all duration-150"
            aria-label="User menu"
          >
            <div className="bg-primary/20 text-primary w-9 rounded-full">
              <span className="text-xs font-semibold">
                {me.user.email.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </button>
          <ul
            tabIndex={0}
            className="menu dropdown-content z-1 mt-2 w-56 rounded-xl border border-base-300/80 bg-base-200 p-2"
          >
            <li className="menu-title">
              <span className="truncate text-xs font-medium text-base-content/60">
                {me.user.email}
              </span>
            </li>
            <li>
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
